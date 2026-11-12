#!/usr/bin/env node
// check-contract — static check of a Next.js project against the team's Next.js <-> n8n contract
// (skill integrating-n8n-webhooks). Node only, no dependencies.
//
//   node check-contract.mjs [--root <dir>] [--changed-since <git-ref>] [--json] [--help]
//
// Exit code: 0 — no FAIL; 1 — at least one FAIL; 2 — usage error.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const HELP = `check-contract — Next.js <-> n8n contract checks (skill integrating-n8n-webhooks)

Usage:
  node check-contract.mjs [options]

Options:
  --root <dir>             Project to check (default: current directory).
  --changed-since <ref>    Check only what changed after <ref> (committed, staged, unstaged and
                           untracked files). Line checks look at changed lines only; file checks run
                           only for changed files; .env.example only if it changed.
  --json                   Print results as JSON.
  -h, --help               Show this help.

Checks (PASS / FAIL / N/A — N/A means there was nothing to check):
  C1   no-test-url          no /webhook-test/ in code or .env.example
  C2   no-public-n8n-env    no NEXT_PUBLIC_ n8n variables
  C3   single-client        N8N_WEBHOOK_* read and n8n fetched only in lib/n8n/
  C4   server-only          lib/n8n/client.* starts with import "server-only"
  C5   fetch-timeout        every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   contract-headers     n8n requests send x-n8n-token, idempotency-key, x-correlation-id
  C7   non-blocking-action  a "use server" file that starts a workflow does it inside after()
  C8   callback-raw-body    callback route reads request.text(); no .json()/JSON.parse before the signature check
  C9   timing-safe-compare  signature compared with crypto.timingSafeEqual, never with === / !==
  C10  no-edge-runtime      no export const runtime = "edge"
  C11  env-example          .env.example has the 4 contract keys; secrets are change-me-…; base URL ends with /webhook
  C12  no-sensitive-logs    no console.* of bodies, form data, personal data, tokens or signatures in n8n code
  C13  callback-replay      callback code checks x-n8n-timestamp against a 300 s window
  C14  callback-idempotent  callback code uses idempotency-key and matches it with jobId from the body

Examples:
  node check-contract.mjs                                  # whole project
  node check-contract.mjs --root ../leaddesk-main          # another copy, e.g. main
  node check-contract.mjs --root ../copy --changed-since base   # only what an agent run changed
`;

// ---------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opts = { root: ".", since: null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  } else if (a === "--root") opts.root = argv[++i];
  else if (a === "--changed-since") opts.since = argv[++i];
  else if (a === "--json") opts.json = true;
  else {
    process.stderr.write(`Unknown argument: ${a}\n\n${HELP}`);
    process.exit(2);
  }
  if ((a === "--root" || a === "--changed-since") && !argv[i]) {
    process.stderr.write(`${a} needs a value\n`);
    process.exit(2);
  }
}
const ROOT = resolve(opts.root);
if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) {
  process.stderr.write(`--root ${opts.root}: not a directory\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------- files
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", ".agents", ".cursor", ".codex", "tools", "materials", "docs", "coverage", "out", "build", "dist"]);
const toPosix = (p) => p.split(sep).join("/");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(join(dir, entry.name)));
    } else if (CODE_EXT.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(toPosix(relative(ROOT, join(dir, entry.name))));
    }
  }
  return out;
}

const read = (rel) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// Blank comments but keep line numbers (strings with // inside, like URLs, are kept intact).
function blankComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

// --changed-since: which files and lines changed after <ref>
let changed = null; // Map<file, Set<line> | "all">
if (opts.since) {
  const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    git("rev-parse", "--verify", `${opts.since}^{commit}`);
  } catch {
    process.stderr.write(`--changed-since ${opts.since}: not a git ref in ${ROOT}\n`);
    process.exit(2);
  }
  changed = new Map();
  let current = null;
  for (const line of git("diff", "-U0", "--no-color", "--no-ext-diff", opts.since).split("\n")) {
    const file = /^\+\+\+ b\/(.+)$/.exec(line);
    if (file) {
      current = file[1];
      if (!changed.has(current)) changed.set(current, new Set());
      continue;
    }
    if (line.startsWith("+++ /dev/null")) current = null;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n++) changed.get(current).add(n);
    }
  }
  for (const f of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) changed.set(f, "all");
}
const fileChanged = (rel) => !changed || changed.has(rel);
const lineChanged = (rel, n) => {
  if (!changed) return true;
  const lines = changed.get(rel);
  return lines === "all" || (lines instanceof Set && lines.has(n));
};

const allFiles = walk(ROOT);
const files = allFiles.filter(fileChanged);
const sources = new Map(files.map((f) => [f, read(f)]));
const code = new Map([...sources].map(([f, s]) => [f, blankComments(s)]));

const inN8nModule = (f) => /(^|\/)lib\/n8n\//.test(f);
const isClientModule = (f) => /(^|\/)lib\/n8n\/client\.(ts|tsx|js|mjs)$/.test(f);
const N8N_URL_RE = /process\.env\.N8N_WEBHOOK|process\.env\[\s*["']N8N_WEBHOOK|webhook-test\/|\/webhook\/|:5678\b/;
const isCallbackFile = (f, src) =>
  (/(^|\/)app\/api\/n8n\//.test(f) && /route\.(ts|js)$/.test(f)) || /x-n8n-signature/i.test(src);

// ---------------------------------------------------------------------------- checks
const results = [];
function result(id, name, findings, applicable, note = "") {
  const status = !applicable ? "N/A" : findings.length ? "FAIL" : "PASS";
  results.push({ id, name, status, findings, note });
}
function eachLine(filter, fn) {
  for (const [f, src] of code) {
    if (!filter(f)) continue;
    src.split("\n").forEach((line, i) => {
      if (lineChanged(f, i + 1)) fn(f, line, i + 1);
    });
  }
}

// C1 — test URL in code and .env.example
{
  const findings = [];
  eachLine(() => true, (f, line, n) => {
    if (/\/webhook-test\//.test(line)) findings.push(`${f}:${n} test URL /webhook-test/ in code`);
  });
  const env = ".env.example";
  if (existsSync(join(ROOT, env)) && fileChanged(env)) {
    read(env).split("\n").forEach((line, i) => {
      if (!line.trim().startsWith("#") && /webhook-test/.test(line) && lineChanged(env, i + 1)) {
        findings.push(`${env}:${i + 1} test URL /webhook-test/`);
      }
    });
  }
  result("C1", "no-test-url", findings, true);
}

// C2 — NEXT_PUBLIC_ n8n variables
{
  const findings = [];
  const re = /NEXT_PUBLIC_[A-Z0-9_]*(N8N|WEBHOOK|CALLBACK)/;
  eachLine(() => true, (f, line, n) => {
    if (re.test(line)) findings.push(`${f}:${n} ${line.match(re)[0]} would be inlined into the client bundle`);
  });
  const env = ".env.example";
  if (existsSync(join(ROOT, env)) && fileChanged(env)) {
    read(env).split("\n").forEach((line, i) => {
      if (!line.trim().startsWith("#") && re.test(line) && lineChanged(env, i + 1)) findings.push(`${env}:${i + 1} ${line.match(re)[0]}`);
    });
  }
  result("C2", "no-public-n8n-env", findings, true);
}

// C3 — n8n URL/token and fetches to n8n only inside lib/n8n/
{
  const findings = [];
  eachLine((f) => !inN8nModule(f), (f, line, n) => {
    if (/process\.env\.N8N_WEBHOOK|process\.env\[\s*["']N8N_WEBHOOK/.test(line)) {
      findings.push(`${f}:${n} reads N8N_WEBHOOK_* outside lib/n8n/`);
    } else if (/\bfetch\s*\(/.test(line) && N8N_URL_RE.test(line)) {
      findings.push(`${f}:${n} fetch to n8n outside lib/n8n/`);
    }
  });
  result("C3", "single-client", findings, true);
}

// Locate every fetch call that talks to n8n: all fetches in lib/n8n/, plus fetches whose
// call text references the n8n URL/env (anywhere in the project).
function n8nFetchCalls() {
  const calls = [];
  for (const [f, src] of code) {
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (!/\bfetch\s*\(/.test(line) || !lineChanged(f, i + 1)) return;
      const window = lines.slice(i, i + 25).join("\n");
      const end = callEnd(window);
      const callText = window.slice(0, end);
      const fileTalksToN8n = inN8nModule(f) || N8N_URL_RE.test(src);
      if (inN8nModule(f) || N8N_URL_RE.test(callText) || (fileTalksToN8n && /N8N|n8n/.test(callText))) {
        calls.push({ f, n: i + 1, text: callText });
      }
    });
  }
  return calls;
}
// index where the fetch( call closes (paren balance), or the whole window
function callEnd(text) {
  const start = text.search(/\bfetch\s*\(/);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i + 1;
  }
  return text.length;
}
const fetchCalls = n8nFetchCalls();

// C4 — lib/n8n/client.* starts with import "server-only"
{
  const clients = files.filter(isClientModule);
  const findings = [];
  for (const f of clients) {
    const first = code.get(f).split("\n").map((l) => l.trim()).find((l) => l && l !== '"use strict";');
    if (!/^import\s+["']server-only["'];?$/.test(first ?? "")) findings.push(`${f}:1 first statement is not import "server-only"`);
  }
  result("C4", "server-only", findings, clients.length > 0);
}

// C5 — timeout on each n8n fetch
{
  const findings = fetchCalls
    .filter((c) => !/signal\s*:\s*AbortSignal\.timeout\s*\(|AbortSignal\.timeout\s*\(/.test(c.text))
    .map((c) => `${c.f}:${c.n} fetch to n8n without signal: AbortSignal.timeout(...)`);
  result("C5", "fetch-timeout", findings, fetchCalls.length > 0);
}

// C6 — contract headers on n8n requests (in the call or, for lib/n8n/, anywhere in the module)
{
  const findings = [];
  for (const c of fetchCalls) {
    const scope = inN8nModule(c.f) ? code.get(c.f) : c.text;
    const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter((h) => !new RegExp(`["'\`]${h}["'\`]`, "i").test(scope));
    if (missing.length) findings.push(`${c.f}:${c.n} n8n request without ${missing.join(", ")}`);
  }
  result("C6", "contract-headers", findings, fetchCalls.length > 0);
}

// C7 — "use server" files that start a workflow do it in after()
{
  const findings = [];
  let applicable = 0;
  for (const [f, src] of code) {
    if (!/^\s*["']use server["']/.test(src)) continue;
    const startsWorkflow = /from\s+["'][^"']*lib\/n8n\/client["']/.test(src) || /process\.env\.N8N_WEBHOOK/.test(src) || fetchCalls.some((c) => c.f === f);
    if (!startsWorkflow) continue;
    applicable++;
    if (!/\bafter\s*\(/.test(src) || !/import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*["']next\/server["']/.test(src)) {
      const line = src.split("\n").findIndex((l) => /lib\/n8n\/client|process\.env\.N8N_WEBHOOK|\bfetch\s*\(/.test(l)) + 1;
      findings.push(`${f}:${line || 1} Server Action starts an n8n workflow without after() — the user waits for n8n`);
    }
  }
  result("C7", "non-blocking-action", findings, applicable > 0);
}

// callback files (route handlers + helpers that verify x-n8n-signature)
const callbackFiles = files.filter((f) => isCallbackFile(f, sources.get(f)));
const callbackRoutes = callbackFiles.filter((f) => /route\.(ts|js)$/.test(f));
const verifyHelpers = allFiles.filter((f) => inN8nModule(f) && /timingSafeEqual|x-n8n-signature/i.test(read(f)));
const callbackScope = [...new Set([...callbackFiles, ...verifyHelpers.filter(fileChanged)])];
const scopeText = (list) => list.map((f) => (code.get(f) ?? blankComments(read(f)))).join("\n");

// C8 — raw body before signature
{
  const findings = [];
  for (const f of callbackRoutes) {
    const lines = code.get(f).split("\n");
    const jsonCall = lines.findIndex((l) => /\.\s*json\s*\(\s*\)/.test(l) && /\b(req|request)\b/.test(l));
    if (jsonCall >= 0) findings.push(`${f}:${jsonCall + 1} request.json() — read the raw body with request.text()`);
    if (!lines.some((l) => /\.\s*text\s*\(\s*\)/.test(l))) findings.push(`${f}:1 the raw body is never read with request.text()`);
    const verify = lines.findIndex((l) => /timingSafeEqual|verif\w*\s*\(/i.test(l));
    const parse = lines.findIndex((l) => /JSON\.parse\s*\(/.test(l));
    if (parse >= 0 && (verify < 0 || parse < verify)) findings.push(`${f}:${parse + 1} JSON.parse before the signature check`);
  }
  result("C8", "callback-raw-body", findings, callbackRoutes.length > 0);
}

// C9 — timingSafeEqual, never ===/!== on signatures
{
  const findings = [];
  for (const f of callbackScope) {
    (code.get(f) ?? blankComments(read(f))).split("\n").forEach((l, i) => {
      if (/(===|!==|==|!=)/.test(l) && /\bsig\w*|hmac|digest/i.test(l.replace(/\bsignal\b/g, "")) && !/\.length\b|typeof|\bnull\b|undefined/.test(l)) {
        findings.push(`${f}:${i + 1} signature compared with ===/!== — use crypto.timingSafeEqual`);
      }
    });
  }
  if (callbackScope.length && !/timingSafeEqual\s*\(/.test(scopeText(callbackScope))) {
    findings.push(`${callbackScope[0]}:1 no crypto.timingSafeEqual in the callback code`);
  }
  result("C9", "timing-safe-compare", findings, callbackScope.length > 0);
}

// C10 — edge runtime
{
  const findings = [];
  eachLine(() => true, (f, line, n) => {
    if (/export\s+const\s+runtime\s*=\s*["']edge["']/.test(line)) findings.push(`${f}:${n} runtime = "edge" (node:crypto is needed; edge is deprecated in Next.js 16)`);
  });
  result("C10", "no-edge-runtime", findings, true);
}

// C11 — .env.example keys
{
  const env = ".env.example";
  const findings = [];
  const applicable = existsSync(join(ROOT, env)) && fileChanged(env);
  if (applicable) {
    const vars = new Map();
    read(env).split("\n").forEach((line, i) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) vars.set(m[1], { value: m[2].trim().replace(/^["']|["']$/g, ""), line: i + 1 });
    });
    for (const key of ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"]) {
      if (!vars.has(key)) findings.push(`${env} missing ${key}`);
    }
    for (const key of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
      const v = vars.get(key);
      if (v && !v.value.startsWith("change-me")) findings.push(`${env}:${v.line} ${key} must be a change-me-… placeholder`);
    }
    const base = vars.get("N8N_WEBHOOK_BASE_URL");
    if (base && !/\/webhook\/?$/.test(base.value)) findings.push(`${env}:${base.line} N8N_WEBHOOK_BASE_URL must end with /webhook`);
    const legacy = vars.get("N8N_WEBHOOK_URL");
    if (legacy) findings.push(`${env}:${legacy.line} N8N_WEBHOOK_URL is not a contract key (use N8N_WEBHOOK_BASE_URL + /<event>)`);
  }
  result("C11", "env-example", findings, applicable, applicable ? "" : "(.env.example absent or unchanged)");
}

// C12 — sensitive data in logs of n8n-related code
{
  const findings = [];
  const n8nFiles = new Set([...files.filter(inN8nModule), ...callbackFiles, ...fetchCalls.map((c) => c.f)]);
  // Only the *code* of a log call matters: ${...} parts of template literals and non-string
  // arguments. Literal text like "body 120 B" is fine; ${raw}, formData, lead (the whole object) are not.
  const logCode = (line) =>
    line
      .replace(/`(?:[^`\\]|\\.)*`/g, (t) => (t.match(/\$\{[^}]*\}/g) ?? []).join(" "))
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "")
      .replace(/\b[\w.]+\.length\b|\bbyteLength\s*\([^)]*\)/g, "")
      .replace(/\b\w*(sha256|hash|digest)\w*\s*(\([^)]*\))?/gi, "");
  const SENSITIVE = /\b(raw|rawBody|body|payload|formData|email|phone|token|secret|signature|envelope)\b|JSON\.stringify|\b(data|lead|quote|values|input)\b(?!\s*[.?[])/i;
  for (const f of n8nFiles) {
    code.get(f).split("\n").forEach((l, i) => {
      const call = /console\.(log|info|warn|error|debug)\s*\((.*)$/.exec(l);
      if (!call || !lineChanged(f, i + 1)) return;
      if (SENSITIVE.test(logCode(call[2]))) findings.push(`${f}:${i + 1} console.* may print a body, personal data or a secret`);
    });
  }
  result("C12", "no-sensitive-logs", findings, n8nFiles.size > 0);
}

// C13 — timestamp window
{
  const findings = [];
  const text = scopeText(callbackScope);
  if (callbackScope.length) {
    if (!/x-n8n-timestamp/i.test(text)) findings.push(`${callbackScope[0]}:1 x-n8n-timestamp is never read`);
    else if (!/\b300\b|5\s*\*\s*60/.test(text)) findings.push(`${callbackScope[0]}:1 no 300 s window for x-n8n-timestamp`);
  }
  result("C13", "callback-replay", findings, callbackScope.length > 0);
}

// C14 — idempotency on callbacks
{
  const findings = [];
  const text = scopeText(callbackRoutes);
  if (callbackRoutes.length) {
    if (!/["'`]idempotency-key["'`]/i.test(text)) findings.push(`${callbackRoutes[0]}:1 idempotency-key header is never read`);
    else if (!/jobId/.test(text)) findings.push(`${callbackRoutes[0]}:1 idempotency-key is not matched with data.jobId from the signed body`);
  }
  result("C14", "callback-idempotent", findings, callbackRoutes.length > 0);
}

// ---------------------------------------------------------------------------- report
const fails = results.filter((r) => r.status === "FAIL").length;
if (opts.json) {
  process.stdout.write(JSON.stringify({ root: ROOT, changedSince: opts.since, files: files.length, results }, null, 2) + "\n");
} else {
  const scope = opts.since ? `${files.length} changed file(s) since ${opts.since}` : `${files.length} file(s)`;
  console.log(`check-contract — ${toPosix(relative(process.cwd(), ROOT)) || "."} (${scope})\n`);
  for (const r of results) {
    console.log(`${r.id.padEnd(4)} ${r.status.padEnd(4)}  ${r.name}${r.note ? ` ${r.note}` : ""}`);
    for (const finding of r.findings) console.log(`             - ${finding}`);
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nTOTAL: ${count("PASS")} PASS, ${fails} FAIL, ${count("N/A")} N/A`);
}
process.exit(fails > 0 ? 1 : 0);
