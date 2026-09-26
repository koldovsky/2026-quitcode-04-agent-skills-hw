#!/usr/bin/env node
// Self-test for check-contract.mjs: builds small projects in a temp dir, runs the checker with
// --json and compares the status of selected checks with what the contract expects.
// Node >= 20, no dependencies. Usage: node test-check-contract.mjs [--keep]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CHECKER = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-contract.mjs");
const keep = process.argv.includes("--keep");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "check-contract-"));

const ENV_OK = [
  "N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook",
  "N8N_WEBHOOK_TOKEN=change-me-webhook-token",
  "N8N_CALLBACK_SECRET=change-me-callback-secret",
  "APP_BASE_URL=http://127.0.0.1:3000",
  "",
].join("\n");

const CLIENT_OK = `import "server-only";
export async function triggerN8nWebhook(o: { event: string; data: object; idempotencyKey: string; correlationId: string }) {
  const body = JSON.stringify({ version: 1, event: o.event, data: o.data });
  const res = await fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/\${o.event}\`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-n8n-token": process.env.N8N_WEBHOOK_TOKEN!,
      "idempotency-key": o.idempotencyKey, "x-correlation-id": o.correlationId },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  console.info("n8n.webhook", { event: o.event, status: res.status });
  return res.ok;
}
`;

const ACTION_OK = `"use server";
import { after } from "next/server";
import { triggerN8nWebhook } from "@/lib/n8n/client";
export async function requestQuote(_p: unknown, fd: FormData) {
  const id = String(fd.get("id"));
  after(() => triggerN8nWebhook({ event: "quote-request", data: { id }, idempotencyKey: id, correlationId: id }));
  return { status: "queued", id };
}
`;

const ROUTE_OK = `import crypto from "node:crypto";
const seen = new Set<string>();
export async function POST(req: Request) {
  const mediaType = req.headers.get("content-type")?.split(";")[0].trim();
  if (mediaType !== "application/json") return new Response(null, { status: 415 });
  const raw = await req.text();
  const ts = Number(req.headers.get("x-n8n-timestamp"));
  if (Math.abs(Date.now() / 1000 - ts) > 300) return new Response(null, { status: 401 });
  const expected = Buffer.from("sha256=" + crypto.createHmac("sha256", process.env.N8N_CALLBACK_SECRET!).update(\`\${ts}.\${raw}\`).digest("hex"));
  const signatureBuf = Buffer.from(req.headers.get("x-n8n-signature") ?? "");
  if (signatureBuf.length !== expected.length || !crypto.timingSafeEqual(signatureBuf, expected)) return new Response(null, { status: 401 });
  const key = req.headers.get("idempotency-key") ?? "";
  if (seen.has(key)) return Response.json({ duplicate: true });
  seen.add(key);
  const body = JSON.parse(raw);
  const { correlationId } = body.data;
  console.info("n8n.callback", { correlationId });
  return Response.json({ ok: true }, { status: 202 });
}
`;

const GOOD = {
  ".env.example": ENV_OK,
  "lib/n8n/client.ts": CLIENT_OK,
  "app/quotes/actions.ts": ACTION_OK,
  "app/api/n8n/[event]/route.ts": ROUTE_OK,
};

// name, files (merged over nothing or over GOOD), expected statuses, extra args
const cases = [
  ["contract-compliant project", GOOD, Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`C${i + 1}`, "PASS"]))],
  ["no n8n code at all", { ".env.example": ENV_OK, "app/page.tsx": "export default function P() { return null; }\n" },
    { C3: "N/A", C4: "N/A", C5: "N/A", C9: "N/A", C10: "N/A", C11: "N/A", C12: "N/A", C15: "N/A" }],
  ["legacy call like main (test URL, whole row, awaited)", {
    ".env.example": "N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created\n",
    "app/actions.ts": `"use server";\nexport async function submitLead(lead: object) {\n  await fetch(process.env.N8N_WEBHOOK_URL!, { method: "POST", body: JSON.stringify(lead) });\n  return { status: "ok" };\n}\n`,
  }, { C1: "FAIL", C3: "FAIL", C4: "FAIL", C5: "FAIL", C7: "FAIL", C8: "FAIL", C15: "FAIL" }],
  ["comment explaining the rule is not a test URL", { ...GOOD, ".env.example": "# ends with /webhook, never /webhook-test\n" + ENV_OK }, { C1: "PASS" }],
  ["NEXT_PUBLIC_ n8n variable", { ...GOOD, "components/x.tsx": `"use client";\nexport const u = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;\n` }, { C2: "FAIL" }],
  ["agent-invented env name outside the client", { ...GOOD, "lib/quote-workflow.ts": `export const go = () => fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, { signal: AbortSignal.timeout(5000) });\n` }, { C3: "FAIL" }],
  ["client without server-only and headers", { ...GOOD, "lib/n8n/client.ts": `export const t = (e: string, d: object) => fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/\${e}\`, { method: "POST", body: JSON.stringify(d) });\n` },
    { C4: "FAIL", C5: "FAIL", C6: "FAIL", C15: "FAIL" }],
  ["real-looking token in .env.example", { ...GOOD, ".env.example": ENV_OK.replace("change-me-webhook-token", "s3cr3t-live-token") }, { C7: "FAIL" }],
  ["Server Action awaits n8n without after()", { ...GOOD, "app/quotes/actions.ts": `"use server";\nimport { triggerN8nWebhook } from "@/lib/n8n/client";\nexport async function r() { await triggerN8nWebhook({ event: "q", data: {}, idempotencyKey: "k", correlationId: "c" }); return { status: "ok" }; }\n` }, { C8: "FAIL" }],
  ["callback reads req.json()", { ...GOOD, "app/api/n8n/[event]/route.ts": ROUTE_OK.replace("const raw = await req.text();", "const parsed = await req.json(); const raw = JSON.stringify(parsed);") }, { C9: "FAIL" }],
  ["capped stream read counts as raw body", { ...GOOD, "app/api/n8n/[event]/route.ts": ROUTE_OK.replace("const raw = await req.text();", "const reader = req.body!.getReader(); const raw = await readCapped(reader);") }, { C9: "PASS" }],
  ["JSON.parse before the signature check", { ...GOOD, "app/api/n8n/[event]/route.ts": ROUTE_OK.replace("const raw = await req.text();", "const raw = await req.text();\n  const early = JSON.parse(raw);") }, { C9: "FAIL", C10: "PASS" }],
  ["signature compared with !==", { ...GOOD, "app/api/n8n/[event]/route.ts": ROUTE_OK.replace("signatureBuf.length !== expected.length || !crypto.timingSafeEqual(signatureBuf, expected)", 'req.headers.get("x-n8n-signature") !== expected.toString()') }, { C10: "FAIL" }],
  ["verification in an imported helper (lib/quote-callback.ts)", {
    ...GOOD,
    "lib/quote-callback.ts": `import { timingSafeEqual } from "node:crypto";\nexport const verifyToken = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);\n`,
    "app/api/n8n/[event]/route.ts": `import { verifyToken } from "@/lib/quote-callback";\nexport async function POST(req: Request) {\n  const raw = await req.text();\n  if (!verifyToken(Buffer.from(raw), Buffer.from(raw))) return new Response(null, { status: 401 });\n  return new Response(null, { status: 202 });\n}\n`,
  }, { C10: "PASS", C11: "FAIL", C12: "FAIL" }],
  ['runtime = "edge"', { ...GOOD, "app/api/n8n/[event]/route.ts": 'export const runtime = "edge";\n' + ROUTE_OK }, { C13: "FAIL" }],
  ["logging the raw body and a token", { ...GOOD, "app/api/n8n/[event]/route.ts": ROUTE_OK.replace('console.info("n8n.callback", { correlationId });', 'console.log("n8n.callback", raw, process.env.N8N_CALLBACK_SECRET);') }, { C14: "FAIL" }],
];

let failed = 0;
function run(dir, args = []) {
  const r = spawnSync(process.execPath, [CHECKER, "--root", dir, "--json", ...args], { encoding: "utf8" });
  return { code: r.status, json: r.stdout ? JSON.parse(r.stdout) : null, stderr: r.stderr };
}
function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

cases.forEach(([name, files, expected], i) => {
  const dir = path.join(tmp, `case-${String(i + 1).padStart(2, "0")}`);
  write(dir, files);
  const { code, json } = run(dir);
  const got = Object.fromEntries(json.results.map((r) => [r.id, r.status]));
  const bad = Object.entries(expected).filter(([id, st]) => got[id] !== st).map(([id, st]) => `${id} expected ${st}, got ${got[id]}`);
  const anyFail = json.results.some((r) => r.status === "FAIL");
  if (anyFail !== (code === 1)) bad.push(`exit code ${code} does not match FAIL presence`);
  const noLine = json.results.flatMap((r) => r.findings.filter((f) => !(f.line >= 1)).map((f) => `${r.id} ${f.file}`));
  if (noLine.length) bad.push(`finding without file:line: ${noLine.join(", ")}`);
  if (bad.length) failed++;
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}${bad.length ? "  — " + bad.join("; ") : ""}`);
});

// --changed-since: an old violation is ignored, a new one in the same file is reported
{
  const dir = path.join(tmp, "changed-since");
  write(dir, {
    ".env.example": ENV_OK,
    "app/actions.ts": `"use server";\nimport { after } from "next/server";\nexport async function a() {\n  after(() => fetch(process.env.N8N_WEBHOOK_BASE_URL!, { signal: AbortSignal.timeout(1) }));\n  return { status: "ok" };\n}\n`,
  });
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "pipe" });
  git("init", "-q"); git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-qm", "base"); git("tag", "base");
  fs.appendFileSync(path.join(dir, "app/actions.ts"), `export const b = () => fetch(process.env.N8N_WEBHOOK_BASE_URL!);\n`);
  const whole = run(dir), changed = run(dir, ["--changed-since", "base"]);
  const c3whole = whole.json.results.find((r) => r.id === "C3").findings.map((f) => f.line);
  const c3changed = changed.json.results.find((r) => r.id === "C3").findings.map((f) => f.line);
  const c5changed = changed.json.results.find((r) => r.id === "C5").findings.map((f) => f.line);
  const ok = c3whole.includes(4) && c3whole.includes(7) && !c3changed.includes(4) && c3changed.includes(7) && c5changed.includes(7);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  --changed-since keeps the new line 7, drops the old line 4 (C3 whole: ${c3whole}; changed: ${c3changed}; C5 changed: ${c5changed})`);
  const badRef = run(dir, ["--changed-since", "no-such-ref"]);
  const ok2 = badRef.code === 2;
  if (!ok2) failed++;
  console.log(`${ok2 ? "PASS" : "FAIL"}  unknown git ref -> exit 2 (got ${badRef.code})`);
}

const total = cases.length + 2;
console.log(`\n${failed} failed, ${total - failed} passed (${total} cases)`);
if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
else console.log(`fixtures kept in ${tmp}`);
process.exit(failed ? 1 : 0);
