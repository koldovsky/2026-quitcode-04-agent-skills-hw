#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract.
// Node >= 20, no dependencies. Run `node check-contract.mjs --help`.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HELP = `check-contract.mjs — static check of Next.js code against the n8n webhook contract

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>] [--json]

Options:
  --root <dir>             Project to check (default: current directory).
  --changed-since <ref>    Report only findings in files changed after <ref> (new files
                           included); in files that already existed — only changed lines.
                           Needs git in <dir>. Without it the whole project is checked.
  --json                   Print results as JSON instead of text.
  -h, --help               Show this help.

Checks (id — what FAILs):
  C1  test webhook URL "/webhook-test/" in code or .env.example
  C2  N8N_* variable exposed with NEXT_PUBLIC_ prefix
  C3  n8n called (N8N_* env / webhook URL) outside lib/n8n/client.ts
  C4  lib/n8n/client.ts missing or its first statement is not import "server-only"
  C5  fetch() to n8n without a timeout signal (AbortSignal.timeout)
  C6  lib/n8n/client.ts does not send x-n8n-token, idempotency-key, x-correlation-id
  C7  .env.example: missing N8N_WEBHOOK_BASE_URL (…/webhook), N8N_WEBHOOK_TOKEN,
      N8N_CALLBACK_SECRET, APP_BASE_URL, secrets not "change-me-…", or legacy N8N_WEBHOOK_URL
  C8  Server Action calls n8n without after() — the user waits for n8n
  C9  callback route reads the body with .json() or JSON.parse before signature check
  C10 callback signature not compared with crypto.timingSafeEqual (or compared with ===)
  C11 callback has no x-n8n-timestamp check with a 300 s window
  C12 callback does not deduplicate by idempotency-key ({"duplicate": true})
  C13 runtime = "edge" in the project (node:crypto is needed; edge is deprecated)
  C14 n8n code logs bodies, headers, tokens, signatures or personal data
  C15 request body to n8n is not the envelope {version, event, data} (e.g. a whole DB row)

Result per check: PASS, FAIL (with file:line), or N/A (nothing to check, e.g. no callback
route yet). Exit code: 0 — no FAIL, 1 — at least one FAIL, 2 — usage error.
`;

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
let root = process.cwd();
let changedSince = null;
let asJson = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-h" || a === "--help") { process.stdout.write(HELP); process.exit(0); }
  else if (a === "--root") root = args[++i];
  else if (a === "--changed-since") changedSince = args[++i];
  else if (a === "--json") asJson = true;
  else { console.error(`Unknown argument: ${a}\n`); process.stderr.write(HELP); process.exit(2); }
}
if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`--root: not a directory: ${root}`); process.exit(2);
}
if (args.includes("--changed-since") && !changedSince) {
  console.error("--changed-since needs a git ref"); process.exit(2);
}
root = path.resolve(root);

// ---------------------------------------------------------------- files
const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", ".claude", ".agents", ".cursor", ".vercel",
  "out", "build", "dist", "coverage", "tools", "materials", "docs",
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) out.push(...walk(path.join(dir, e.name))); }
    else if (CODE_EXT.test(e.name) && !e.name.endsWith(".d.ts")) out.push(path.join(dir, e.name));
  }
  return out;
}

const rel = (abs) => path.relative(root, abs).split(path.sep).join("/");
const files = walk(root).map((abs) => {
  const text = fs.readFileSync(abs, "utf8");
  return { path: rel(abs), text, lines: text.split("\n") };
});
const envExamplePath = path.join(root, ".env.example");
const envExample = fs.existsSync(envExamplePath)
  ? { path: ".env.example", lines: fs.readFileSync(envExamplePath, "utf8").split("\n") }
  : null;

// Strip string/template literals and comments so identifiers can be matched without false
// positives from messages like "bad signature". Keeps line structure.
function codeOnly(line) {
  return line
    .replace(/\/\/.*$/, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

// Text of a call starting at `index` (the "(" after the callee), up to the matching ")".
function callArgs(text, index) {
  let depth = 0;
  for (let i = index; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(index, i + 1);
  }
  return text.slice(index);
}
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// ---------------------------------------------------------------- facts
const CLIENT = "lib/n8n/client.ts";
const clientFile = files.find((f) => f.path === CLIENT || f.path === "src/" + CLIENT);
// Any N8N_* variable except the callback secret means "this code talks to n8n" — agents invent
// names like N8N_QUOTE_WEBHOOK_URL, so matching only the contract's names would miss them.
const N8N_ENV_USE = /process\.env\.N8N_(?!CALLBACK_SECRET\b)[A-Z0-9_]+|process\.env\[\s*["'`]N8N_(?!CALLBACK_SECRET)/;
const N8N_URL_LITERAL = /["'`][^"'`]*(\/webhook(-test)?\/|:5678)[^"'`]*["'`]/;
// A route that n8n calls back: the contract path, any "callback" route, or a route that mentions n8n.
const isCallbackRoute = (f) =>
  /(^|\/)route\.(ts|js|tsx|jsx)$/.test(f.path) &&
  (/x-n8n-/i.test(f.text) || /\/api\/n8n\/|callback/i.test(f.path) || /\bn8n\b|N8N_/i.test(f.text));

// Sites that talk to n8n: env var use or a webhook URL literal.
const callSites = [];
for (const f of files) {
  f.lines.forEach((line, i) => {
    if (N8N_ENV_USE.test(line) || N8N_URL_LITERAL.test(line)) callSites.push({ file: f, line: i + 1, src: line });
  });
}
const n8nFiles = [...new Set(callSites.map((s) => s.file))];
const callbackRoutes = files.filter(isCallbackRoute);
// Callback code also includes helpers: lib/n8n/* verification modules and any module a callback
// route imports ("@/…" or relative) that does the crypto — agents often move it to lib/<something>.ts.
const byPath = new Map(files.map((f) => [f.path, f]));
function importedFiles(f) {
  const out = [];
  for (const m of f.text.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = m[1];
    let base;
    if (spec.startsWith("@/")) base = spec.slice(2);
    else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(f.path), spec));
    else continue;
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `src/${base}.ts`]) {
      if (byPath.has(cand)) { out.push(byPath.get(cand)); break; }
    }
  }
  return out;
}
const CRYPTO = /timingSafeEqual|x-n8n-signature|createHmac/;
const callbackHelpers = [
  ...files.filter((f) => /(^|\/)lib\/n8n\//.test(f.path) && f !== clientFile && CRYPTO.test(f.text)),
  ...files.filter(isCallbackRoute).flatMap(importedFiles).filter((f) => f !== clientFile && CRYPTO.test(f.text)),
];
const callbackCode = [...new Set([...callbackRoutes, ...callbackHelpers])];

// ---------------------------------------------------------------- checks
const results = [];
function check(id, title, fn) {
  const r = { id, title, status: "PASS", findings: [] };
  const fail = (file, line, msg) => r.findings.push({ file: file?.path ?? file ?? "", line: line ?? 0, msg });
  const outcome = fn(fail);
  if (outcome === "N/A") r.status = "N/A";
  results.push(r);
}

check("C1", "no test webhook URL (/webhook-test/) in code or .env.example", (fail) => {
  // comments may explain the rule ("never /webhook-test") — only code and values count
  const isComment = (l) => /^\s*(\/\/|\*|\/\*|#)/.test(l);
  for (const f of files) f.lines.forEach((l, i) => { if (!isComment(l) && l.replace(/\/\/.*$/, "").includes("/webhook-test")) fail(f, i + 1, l.trim()); });
  envExample?.lines.forEach((l, i) => { if (!isComment(l) && l.includes("/webhook-test")) fail(envExample, i + 1, l.trim()); });
});

check("C2", "no N8N_* variable with NEXT_PUBLIC_ prefix", (fail) => {
  for (const f of files) f.lines.forEach((l, i) => { if (/NEXT_PUBLIC_N8N/.test(l)) fail(f, i + 1, l.trim()); });
  envExample?.lines.forEach((l, i) => { if (/NEXT_PUBLIC_N8N/.test(l)) fail(envExample, i + 1, l.trim()); });
});

check("C3", `n8n is called only from ${CLIENT}`, (fail) => {
  if (callSites.length === 0) return "N/A";
  for (const s of callSites) if (s.file !== clientFile) fail(s.file, s.line, s.src.trim());
});

check("C4", `${CLIENT} exists and starts with import "server-only"`, (fail) => {
  if (callSites.length === 0 && !clientFile) return "N/A";
  if (!clientFile) {
    // one finding per file that talks to n8n, so --changed-since still sees it in new files
    for (const f of n8nFiles) {
      const s = callSites.find((c) => c.file === f);
      fail(s.file, s.line, `n8n is called here, but ${CLIENT} does not exist`);
    }
    return;
  }
  const first = clientFile.lines.findIndex((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l));
  if (!/^\s*import\s+["']server-only["']/.test(clientFile.lines[first] ?? "")) {
    fail(clientFile, first + 1, `first statement is not import "server-only": ${(clientFile.lines[first] ?? "").trim()}`);
  }
});

check("C5", "every fetch() to n8n has a timeout signal", (fail) => {
  const targets = [...new Set([...(clientFile ? [clientFile] : []), ...n8nFiles])];
  if (targets.length === 0) return "N/A";
  for (const f of targets) {
    for (const m of f.text.matchAll(/\bfetch\s*\(/g)) {
      const a = callArgs(f.text, m.index + m[0].length - 1);
      if (!/\bsignal\b/.test(a)) fail(f, lineOf(f.text, m.index), "fetch() without signal: AbortSignal.timeout(10_000)");
      else if (!/AbortSignal\.timeout|timeout/i.test(f.text)) fail(f, lineOf(f.text, m.index), "signal is not a timeout (AbortSignal.timeout)");
    }
  }
});

check("C6", "n8n client sends x-n8n-token, idempotency-key, x-correlation-id", (fail) => {
  if (!clientFile) return "N/A";
  for (const h of ["x-n8n-token", "idempotency-key", "x-correlation-id"]) {
    if (!new RegExp(`["'\`]${h}["'\`]`, "i").test(clientFile.text)) fail(clientFile, 0, `header "${h}" is never set`);
  }
  if (!/N8N_WEBHOOK_TOKEN/.test(clientFile.text)) fail(clientFile, 0, "x-n8n-token is not taken from N8N_WEBHOOK_TOKEN");
});

check("C7", ".env.example lists the contract keys with safe values", (fail) => {
  if (!envExample) return fail(".env.example", 0, ".env.example is missing");
  const kv = new Map();
  envExample.lines.forEach((l, i) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) kv.set(m[1], { value: m[2].trim().replace(/^["']|["']$/g, ""), line: i + 1 });
  });
  const need = ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"];
  for (const k of need) if (!kv.has(k)) fail(envExample, 0, `missing ${k}`);
  const base = kv.get("N8N_WEBHOOK_BASE_URL");
  if (base && !/\/webhook$/.test(base.value)) fail(envExample, base.line, `N8N_WEBHOOK_BASE_URL must end with /webhook: ${base.value}`);
  for (const k of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const v = kv.get(k);
    if (v && !/^change-me/.test(v.value)) fail(envExample, v.line, `${k} must be a change-me-… placeholder`);
  }
  const legacy = kv.get("N8N_WEBHOOK_URL");
  if (legacy) fail(envExample, legacy.line, "legacy N8N_WEBHOOK_URL — use N8N_WEBHOOK_BASE_URL + event path");
});

check("C8", "Server Actions do not wait for n8n (call runs inside after())", (fail) => {
  const clientImport = /from\s+["'][^"']*lib\/n8n(\/client)?["']/;
  const actions = files.filter((f) => /^\s*["']use server["']/m.test(f.text) && (clientImport.test(f.text) || n8nFiles.includes(f)));
  if (actions.length === 0) return "N/A";
  for (const f of actions) {
    const idx = f.lines.findIndex((l) => clientImport.test(l) || N8N_ENV_USE.test(l) || N8N_URL_LITERAL.test(l));
    if (!/\bafter\s*\(/.test(f.text)) fail(f, idx + 1, "Server Action reaches n8n without after(): the user waits for the webhook");
  }
});

check("C9", "callback reads the raw body; no .json()/JSON.parse before the signature check", (fail) => {
  if (callbackRoutes.length === 0) return "N/A";
  for (const f of callbackRoutes) {
    const code = f.lines.map(codeOnly);
    code.forEach((l, i) => { if (/\b(req|request)\s*\.\s*json\s*\(/.test(l)) fail(f, i + 1, "request.json() — read await req.text() and verify first"); });
    if (!code.some((l) => /\.\s*text\s*\(\s*\)/.test(l))) fail(f, 0, "body is not read as raw text (await req.text())");
    const verifyLine = code.findIndex((l) => /timingSafeEqual|\bverify\w*\s*\(|\bcheckSignature\w*\s*\(|\bisValidSignature\w*\s*\(/i.test(l));
    code.forEach((l, i) => {
      if (/JSON\.parse\s*\(/.test(l) && (verifyLine === -1 || i < verifyLine)) fail(f, i + 1, "JSON.parse before the signature is verified");
    });
  }
});

check("C10", "callback signature compared with crypto.timingSafeEqual, not ===", (fail) => {
  if (callbackRoutes.length === 0) return "N/A";
  if (!callbackCode.some((f) => /timingSafeEqual/.test(f.text))) fail(callbackRoutes[0], 0, "no crypto.timingSafeEqual in callback code");
  const cmp = /\b\w*(signature|sig|hmac|digest)\w*\s*[!=]==?|[!=]==?\s*\w*(signature|sig|hmac|digest)\w*\b/i;
  // comparing lengths (signatureBuf.length !== expected.length) before timingSafeEqual is correct
  const noLengths = (l) => codeOnly(l).replace(/[\w$.]+\.(byteLength|length)\b/g, "LEN");
  for (const f of callbackCode) f.lines.forEach((l, i) => { if (cmp.test(noLengths(l))) fail(f, i + 1, l.trim()); });
  for (const f of callbackCode) if (/createHmac/.test(f.text) && !/sha256/i.test(f.text)) fail(f, 0, "HMAC is not SHA-256");
});

check("C11", "callback rejects x-n8n-timestamp outside a 300 s window", (fail) => {
  if (callbackRoutes.length === 0) return "N/A";
  const all = callbackCode.map((f) => f.text).join("\n");
  if (!/x-n8n-timestamp/i.test(all)) fail(callbackRoutes[0], 0, "x-n8n-timestamp is never read");
  else if (!/\b300\b|300_000|300000|5\s*\*\s*60\b/.test(all)) fail(callbackRoutes[0], 0, "no 300 s timestamp window");
});

check("C12", "callback deduplicates by idempotency-key", (fail) => {
  if (callbackRoutes.length === 0) return "N/A";
  const all = callbackCode.map((f) => f.text).join("\n");
  if (!/["'`]idempotency-key["'`]/i.test(all)) fail(callbackRoutes[0], 0, "idempotency-key header is never read");
  if (!/duplicate/i.test(all)) fail(callbackRoutes[0], 0, 'no {"duplicate": true} response for a repeated key');
});

check("C13", 'no runtime = "edge"', (fail) => {
  for (const f of files) f.lines.forEach((l, i) => { if (/export\s+const\s+runtime\s*=\s*["']edge["']/.test(l)) fail(f, i + 1, l.trim()); });
});

check("C14", "n8n code does not log bodies, headers, secrets or personal data", (fail) => {
  const targets = [...new Set([...(clientFile ? [clientFile] : []), ...n8nFiles, ...callbackCode])];
  if (targets.length === 0) return "N/A";
  const bad = /\b(raw|rawBody|body|payload|formData|headers|email|phone|fullName|name|token|secret|signature|ipAddress|lead|data)\b/;
  for (const f of targets) {
    f.lines.forEach((l, i) => {
      const m = l.match(/console\.(log|info|warn|error|debug)\s*\(/);
      if (!m) return;
      const a = codeOnly(callArgs(l, l.indexOf("(", m.index)));
      // allow bare ids like lead.id / data.jobId: strip `.id`, `.jobId`, `.status`, `.length`
      const cleaned = a.replace(/\b\w+\.(id|jobId|status|length|event|correlationId)\b/g, "");
      if (bad.test(cleaned) || /process\.env|TOKEN|SECRET/.test(cleaned)) fail(f, i + 1, l.trim());
    });
  }
});

check("C15", "request body is the envelope {version, event, data}, not a whole DB row", (fail) => {
  const targets = [...new Set([...(clientFile ? [clientFile] : []), ...n8nFiles])];
  if (targets.length === 0) return "N/A";
  for (const f of targets) {
    for (const m of f.text.matchAll(/\bfetch\s*\(/g)) {
      const a = callArgs(f.text, m.index + m[0].length - 1);
      const body = a.match(/\bbody\s*:\s*JSON\.stringify\(\s*([A-Za-z_$][\w$.]*)\s*\)/);
      const line = lineOf(f.text, m.index);
      if (body && !/envelope/i.test(body[1])) {
        // body: JSON.stringify(someVar) — fine only if the file builds an envelope with version + event
        if (!(/\bversion\s*:/.test(f.text) && /\bevent\s*[:,]/.test(f.text))) fail(f, line, `body is JSON.stringify(${body[1]}) — send { version, event, data } with minimal data`);
      } else if (!body && /\bbody\s*:/.test(a) && !/\bversion\b/.test(a) && !(/\bversion\s*:/.test(f.text) && /\bevent\s*[:,]/.test(f.text))) {
        fail(f, line, "request body has no envelope version/event");
      }
    }
  }
});

// ---------------------------------------------------------------- --changed-since
let scope = "whole project";
if (changedSince) {
  const git = (...a) =>
    execFileSync("git", ["-C", root, ...a], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  let diff, untracked;
  try {
    git("rev-parse", "--verify", `${changedSince}^{commit}`);
    diff = git("diff", "-U0", "--no-color", changedSince, "--");
    untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  } catch (e) {
    console.error(`--changed-since: git failed for "${changedSince}" in ${root}: ${String(e.stderr || e.message).trim()}`);
    process.exit(2);
  }
  const changed = new Map(); // file -> Set(lines) | "all"
  let cur = null;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) { cur = l === "+++ /dev/null" ? null : l.slice(6); if (cur && !changed.has(cur)) changed.set(cur, new Set()); }
    else if (l.startsWith("@@") && cur) {
      const m = l.match(/\+(\d+)(?:,(\d+))?/);
      const start = Number(m[1]), count = m[2] === undefined ? 1 : Number(m[2]);
      for (let n = start; n < start + count; n++) changed.get(cur).add(n);
    }
  }
  // A file whose "---" was /dev/null is new: every line counts.
  let prevNew = false;
  for (const l of diff.split("\n")) {
    if (l.startsWith("--- ")) prevNew = l === "--- /dev/null";
    else if (l.startsWith("+++ ") && prevNew && l !== "+++ /dev/null") changed.set(l.slice(6), "all");
  }
  for (const u of untracked) changed.set(u, "all");

  for (const r of results) {
    r.findings = r.findings.filter((f) => {
      const c = changed.get(f.file);
      if (!c) return false;
      if (c === "all" || f.line === 0) return true;
      return c.has(f.line);
    });
  }
  scope = `changed since ${changedSince} (${changed.size} file(s))`;
}

for (const r of results) if (r.findings.length > 0) r.status = "FAIL";

// ---------------------------------------------------------------- output
const counts = { PASS: 0, FAIL: 0, "N/A": 0 };
for (const r of results) counts[r.status]++;

if (asJson) {
  console.log(JSON.stringify({ root, scope, counts, results }, null, 2));
} else {
  console.log(`check-contract: ${root}`);
  console.log(`scope: ${scope}\n`);
  for (const r of results) {
    console.log(`${r.id.padEnd(4)} ${r.status.padEnd(4)}  ${r.title}`);
    for (const f of r.findings) console.log(`      ${f.file}${f.line ? ":" + f.line : ""}  ${f.msg}`);
  }
  console.log(`\n${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts["N/A"]} N/A`);
}
process.exit(counts.FAIL > 0 ? 1 : 0);
