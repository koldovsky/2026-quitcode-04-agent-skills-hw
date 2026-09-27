#!/usr/bin/env node
// Self-test of check-contract.mjs: a checker that never saw bad code proves nothing.
//   node selftest-check-contract.mjs
// 1. GOOD: the code blocks of references/code-templates.md, written out as a project -> 0 FAIL.
// 2. BAD: one fixture per check that breaks exactly that check -> that id FAILs.
// 3. --changed-since: an old violation is ignored, a new one on a changed line is reported.
// Fixtures live in a temp dir that is removed at the end. Exit 1 if any expectation fails.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = join(HERE, "check-contract.mjs");
const TEMPLATES = readFileSync(join(HERE, "..", "references", "code-templates.md"), "utf8");
const TMP = mkdtempSync(join(tmpdir(), "check-contract-selftest-"));
let failures = 0;

function block(heading) {
  const at = TEMPLATES.indexOf(heading);
  if (at === -1) throw new Error(`heading not found in code-templates.md: ${heading}`);
  const m = /```ts\n([\s\S]*?)```/.exec(TEMPLATES.slice(at));
  return m[1];
}
function project(name, filesByPath) {
  const root = join(TMP, name);
  for (const [path, text] of Object.entries(filesByPath)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
function run(root, extra = []) {
  const r = spawnSync(process.execPath, [CHECK, "--root", root, ...extra], { encoding: "utf8" });
  const status = Object.fromEntries([...r.stdout.matchAll(/^(C\d+)\s+(PASS|FAIL|N\/A)/gm)].map((m) => [m[1], m[2]]));
  return { code: r.status, status, out: r.stdout };
}
const findings = (out) => out.split("\n").filter((l) => /^ {7}\S/.test(l)).join("\n"); // "file:line  msg" rows only
function expect(label, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}${cond ? "" : `\n${detail}`}`);
  if (!cond) failures++;
}

const GOOD_ENV = `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
`;
const good = {
  "lib/n8n/client.ts": block("## 1. `lib/n8n/client.ts`"),
  "app/quotes/actions.ts": block("## 3. Server Action"),
  "app/api/n8n/[event]/route.ts": block("## 4. `app/api/n8n/[event]/route.ts`"),
  ".env.example": GOOD_ENV,
};

// 1. GOOD
{
  const r = run(project("good", good));
  const bad = Object.entries(r.status).filter(([, s]) => s !== "PASS");
  expect("templates from code-templates.md: every check PASS, exit 0", r.code === 0 && bad.length === 0, r.out);
}

// 2. BAD — each fixture breaks one thing
const client = good["lib/n8n/client.ts"];
const route = good["app/api/n8n/[event]/route.ts"];
const action = good["app/quotes/actions.ts"];
const cases = [
  ["C1", { ".env.example": GOOD_ENV + "N8N_LEGACY=http://127.0.0.1:5678/webhook-test/quote-request\n" }],
  ["C2", { "lib/n8n/client.ts": client.replace("process.env.N8N_WEBHOOK_TOKEN", "process.env.NEXT_PUBLIC_N8N_WEBHOOK_TOKEN") }],
  ["C3", { "app/quotes/direct.ts": `"use server";\nimport { after } from "next/server";\nexport async function go() {\n  after(() => fetch(process.env.N8N_WEBHOOK_BASE_URL + "/quote-request", { method: "POST", signal: AbortSignal.timeout(10_000) }));\n}\n` }],
  ["C4", { "lib/n8n/client.ts": client.replace('import "server-only";\n', "") }],
  ["C5", { "lib/n8n/client.ts": client.replace("signal: AbortSignal.timeout(TIMEOUT_MS),", "") }],
  ["C6", { "lib/n8n/client.ts": client.replace('"x-correlation-id": correlationId,', "") }],
  ["C7", { "lib/n8n/client.ts": client.replace("{ version: 1, event, data }", "{ ...data }") }],
  ["C8", { "app/quotes/actions.ts": action.replace("after(async () => {", "await (async () => {").replace(/^import \{ after \} from "next\/server";\n/m, "") }],
  ["C9", { "app/api/n8n/[event]/route.ts": route.replace("const raw = await request.text();", "const parsedEarly = await request.json();\n  const raw = JSON.stringify(parsedEarly);") }],
  ["C10", { "app/api/n8n/[event]/route.ts": route.replace(
    "if (given.length !== expected.length || !timingSafeEqual(given, expected)) return done(401);",
    'if (request.headers.get("x-n8n-signature") !== expected.toString()) return done(401);').replace("timingSafeEqual", "timingSafe") }],
  ["C11", { "app/api/n8n/[event]/route.ts": route.replace("const WINDOW_SECONDS = 300;", "const WINDOW_SECONDS = 86_400;") }],
  ["C12", { "app/api/n8n/[event]/route.ts": route.replaceAll("jobId", "job") }],
  // mentions jobId, but never compares the key with it: the key is only checked for being present
  ["C12", { "app/api/n8n/[event]/route.ts": route.replace("if (!shapeOk || key !== `${d.jobId}:${body.event}`) {", "if (!shapeOk) {") }],
  ["C13", { "app/api/n8n/[event]/route.ts": 'export const runtime = "edge";\n' + route }],
  ["C14", { "app/api/n8n/[event]/route.ts": route.replace("const raw = await request.text();", "const raw = await request.text();\n  console.log(\"callback\", raw);") }],
  // a real-looking secret, generated at run time: a secret-like literal in git trips secret scanners
  ["C15", { ".env.example": GOOD_ENV.replace("change-me-callback-secret", randomBytes(9).toString("hex")) }],
];
for (const [id, change] of cases) {
  const r = run(project(`bad-${id}`, { ...good, ...change }));
  const others = Object.entries(r.status).filter(([k, s]) => k !== id && s === "FAIL").map(([k]) => k);
  expect(`${id} broken on purpose -> ${id} FAIL, exit 1${others.length ? ` (also FAIL: ${others.join(", ")})` : ""}`,
    r.status[id] === "FAIL" && r.code === 1, r.out);
}

// 2b. Known false positive, found on the Task D code: logging error.name is not a data leak
{
  const withName = route.replace("const raw = await request.text();",
    "const raw = await request.text();\n  try { JSON.parse(\"{\"); } catch (error) { console.error(`callback parse: ${error instanceof Error ? error.name : \"error\"}`); }");
  const r = run(project("ok-C14-error-name", { ...good, "app/api/n8n/[event]/route.ts": withName }));
  expect("C14 is not tripped by console.error(error.name)", r.status.C14 === "PASS", r.out);
  const withLead = route.replace("const raw = await request.text();", "const raw = await request.text();\n  console.error(\"lead\", body.name);");
  const r2 = run(project("bad-C14-name", { ...good, "app/api/n8n/[event]/route.ts": withLead }));
  expect("C14 still FAILs on console.error(body.name)", r2.status.C14 === "FAIL", r2.out);
}

// 3. --changed-since
{
  const root = project("changed", {
    ...good,
    "app/legacy.ts": `"use server";\nexport async function old() {\n  await fetch(process.env.N8N_WEBHOOK_URL!, { method: "POST", body: "{}" }); // old n8n call\n}\n`,
  });
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { stdio: "pipe" });
  git("init", "-q"); git("add", "-A");
  git("-c", "user.email=t@example.test", "-c", "user.name=t", "commit", "-qm", "start"); git("tag", "base");
  const unchanged = run(root, ["--changed-since", "base"]);
  expect("--changed-since, nothing changed: old legacy.ts violations ignored, exit 0", unchanged.code === 0, unchanged.out);
  writeFileSync(join(root, "app/new-feature.ts"), `export async function send() {\n  return fetch("http://127.0.0.1:5678/webhook-test/quote-request", { method: "POST" }); // n8n\n}\n`);
  const withNew = run(root, ["--changed-since", "base"]);
  expect("--changed-since, new file with a test URL: C1 FAIL reported at app/new-feature.ts:2",
    withNew.status.C1 === "FAIL" && findings(withNew.out).includes("app/new-feature.ts:2") && !findings(withNew.out).includes("app/legacy.ts"), withNew.out);
  const full = run(root);
  expect("same tree without --changed-since: legacy.ts reported too", findings(full.out).includes("app/legacy.ts:3"), full.out);
}

rmSync(TMP, { recursive: true, force: true });
console.log(failures ? `\n${failures} expectation(s) failed` : "\nall expectations met");
process.exit(failures ? 1 : 0);
