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
  C7   non-blocking-action  a "use server" file that starts a workflow does it inside an after() callback
  C8   callback-raw-body    callback route reads the raw body (request.text() or a bounded stream reader);
                            no .json()/JSON.parse before the signature check
  C9   timing-safe-compare  signature compared with crypto.timingSafeEqual, never with === / !==
  C10  no-edge-runtime      no export const runtime = "edge"
  C11  env-example          .env.example has the 4 contract keys; secrets are change-me-…; base URL ends with /webhook
  C12  no-sensitive-logs    no console.* of bodies, form data, personal data, tokens or signatures in n8n code
  C13  callback-replay      callback code checks x-n8n-timestamp against a 300 s window
  C14  callback-idempotent  callback route reads idempotency-key into a variable, claims/stores it and
                            compares it with \`\${jobId}:…\` from the signed body

  Signature helpers in lib/n8n/ (timingSafeEqual, the 300 s window) count for C9/C13 even when only
  the route changed. With --changed-since a fetch( call counts as changed when any line inside it
  was added, edited or removed.

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
const deletedAfter = new Map(); // Map<file, Set<line>> — new-side line after which lines were removed
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
      if (count === 0) {
        // pure deletion: "+start,0" — lines were removed right after new-side line `start`
        if (!deletedAfter.has(current)) deletedAfter.set(current, new Set());
        deletedAfter.get(current).add(start);
      }
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
// any line in [from, to] added/edited, or lines removed between them
const rangeChanged = (rel, from, to) => {
  if (!changed) return true;
  for (let n = from; n <= to; n++) if (lineChanged(rel, n)) return true;
  return [...(deletedAfter.get(rel) ?? [])].some((d) => d >= from && d < to);
};

const allFiles = walk(ROOT);
const files = allFiles.filter(fileChanged);
const sources = new Map(files.map((f) => [f, read(f)]));
const code = new Map([...sources].map(([f, s]) => [f, blankComments(s)]));

const inN8nModule = (f) => /(^|\/)lib\/n8n\//.test(f);
const isClientModule = (f) => /(^|\/)lib\/n8n\/client\.(ts|tsx|js|mjs)$/.test(f);
// n8n code is recognised by ANY N8N_* variable, not only by the contract's names: code written
// without the contract (N8N_QUOTE_WEBHOOK_URL, /api/quotes/callback…) must not slip through as N/A.
// Endpoint/token variables (…WEBHOOK…, …URL…, …TOKEN…) belong to lib/n8n/ only; the callback
// secret may be read by the callback code.
const N8N_ENDPOINT_ENV_RE = /process\.env\.N8N_[A-Z0-9_]*(WEBHOOK|URL|TOKEN)[A-Z0-9_]*|process\.env\[\s*["']N8N_[A-Z0-9_]*(WEBHOOK|URL|TOKEN)/;
const N8N_SECRET_ENV_RE = /process\.env\.N8N_[A-Z0-9_]*(CALLBACK|SECRET)[A-Z0-9_]*|process\.env\[\s*["']N8N_[A-Z0-9_]*(CALLBACK|SECRET)/;
const N8N_URL_RE = new RegExp(`${N8N_ENDPOINT_ENV_RE.source}|webhook-test\\/|\\/webhook\\/|:5678\\b`);
const isCallbackFile = (f, src) =>
  /x-n8n-signature/i.test(src) ||
  (/route\.(ts|js)$/.test(f) && (/(^|\/)app\/api\/n8n\//.test(f) || N8N_SECRET_ENV_RE.test(src)));

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
    if (N8N_ENDPOINT_ENV_RE.test(line)) {
      findings.push(`${f}:${n} reads ${line.match(/N8N_[A-Z0-9_]+/)[0]} (n8n URL/token) outside lib/n8n/`);
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
      if (!/\bfetch\s*\(/.test(line)) return;
      const window = lines.slice(i, i + 25).join("\n");
      const end = callEnd(window);
      const callText = window.slice(0, end);
      // the whole call counts: removing only `signal:` or a header leaves the fetch( line untouched
      const lastLine = i + callText.split("\n").length;
      if (!rangeChanged(f, i + 1, lastLine)) return;
      // a file that reads an n8n URL/token variable and calls fetch is talking to n8n,
      // even if the URL sits in a local variable (fetch(webhookUrl, …))
      const fileTalksToN8n = inN8nModule(f) || N8N_URL_RE.test(src);
      if (fileTalksToN8n || N8N_URL_RE.test(callText)) {
        calls.push({ f, n: i + 1, text: callText });
      }
    });
  }
  return calls;
}
// Paren matching that ignores parens inside '…', "…", `…` (including ${…}) and /regex/ literals —
// otherwise console.info(")") or /\)$/ inside a call shifts its end. Comments are already blanked.
function skipString(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (quote === "`" && c === "$" && src[j + 1] === "{") {
      let depth = 0; // ${ … } is code: skip to its matching "}", honouring nested literals
      for (j = j + 1; j < src.length; j++) {
        const d = src[j];
        if (d === '"' || d === "'" || d === "`") j = skipString(src, j);
        else if (d === "{") depth++;
        else if (d === "}" && --depth === 0) break;
      }
      continue;
    }
    if (c === quote) return j;
    if (quote !== "`" && c === "\n") return j; // unterminated '…' / "…": stop at the line end
  }
  return src.length;
}
function regexCanStart(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j])) return true;
  return /\b(?:return|typeof|case|do|else|in|of|void|yield|await)$/.test(src.slice(Math.max(0, j - 9), j + 1));
}
function skipRegex(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") j++;
    else if (c === "\n") return i; // not a regex after all — treat "/" as division
    else if (inClass) inClass = c !== "]";
    else if (c === "[") inClass = true;
    else if (c === "/") return j;
  }
  return i;
}
// index of the ")" that closes the "(" at `open`, or -1
function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") i = skipString(src, i);
    else if (c === "/" && regexCanStart(src, i)) i = skipRegex(src, i);
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}
// index where the fetch( call closes, or the whole window
function callEnd(text) {
  const m = /\bfetch\s*\(/.exec(text);
  const close = m ? matchParen(text, m.index + m[0].length - 1) : -1;
  return close < 0 ? text.length : close + 1;
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

// [open, close] offsets of the parentheses of every `name(` call in src
function callRanges(src, nameRe) {
  const ranges = [];
  for (const m of src.matchAll(nameRe)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close >= 0) ranges.push([open, close]);
  }
  return ranges;
}
const lineOf = (src, offset) => src.slice(0, offset).split("\n").length;

// C7 — "use server" files that start a workflow do it inside an after() callback
{
  const findings = [];
  let applicable = 0;
  for (const [f, src] of code) {
    if (!/^\s*["']use server["']/.test(src)) continue;
    const clientImport = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*lib\/n8n\/client["']/.exec(src);
    const startsWorkflow = Boolean(clientImport) || N8N_ENDPOINT_ENV_RE.test(src) || fetchCalls.some((c) => c.f === f);
    if (!startsWorkflow) continue;
    applicable++;
    const firstLine = src.split("\n").findIndex((l) => /lib\/n8n\/client|\bfetch\s*\(/.test(l) || N8N_ENDPOINT_ENV_RE.test(l)) + 1;
    if (!/\bafter\s*\(/.test(src) || !/import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*["']next\/server["']/.test(src)) {
      findings.push(`${f}:${firstLine || 1} Server Action starts an n8n workflow without after() — the user waits for n8n`);
      continue;
    }
    // every place that starts the workflow — calls of names imported from lib/n8n/client and
    // fetch( calls to n8n — must sit inside an after(...) argument, not merely next to an after()
    const names = clientImport
      ? clientImport[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)
      : [];
    const sites = [
      ...names.flatMap((n) => [...src.matchAll(new RegExp(String.raw`\b${n}\s*\(`, "g"))].map((m) => m.index)),
      ...(fetchCalls.some((c) => c.f === f) ? [...src.matchAll(/\bfetch\s*\(/g)].map((m) => m.index) : []),
    ];
    const afters = callRanges(src, /\bafter\s*\(/g);
    for (const at of sites) {
      if (!afters.some(([open, close]) => at > open && at < close)) {
        findings.push(`${f}:${lineOf(src, at)} n8n workflow started outside the after() callback — the user waits for n8n`);
      }
    }
  }
  result("C7", "non-blocking-action", findings, applicable > 0);
}

// callback files (route handlers + helpers that verify x-n8n-signature)
const callbackFiles = files.filter((f) => isCallbackFile(f, sources.get(f)));
const callbackRoutes = callbackFiles.filter((f) => /route\.(ts|js)$/.test(f));
const verifyHelpers = allFiles.filter((f) => inN8nModule(f) && /timingSafeEqual|x-n8n-signature/i.test(read(f)));
// callbackScope — files whose LINES are diagnosed (changed ones only with --changed-since);
// callbackContext — what counts as present: an untouched lib/n8n/callback.ts still verifies the
// signature for a route that delegates to it, so it must not turn a correct route into a FAIL.
const callbackScope = [...new Set([...callbackFiles, ...verifyHelpers.filter(fileChanged)])];
const callbackContext = callbackScope.length ? [...new Set([...callbackScope, ...verifyHelpers])] : [];
const scopeText = (list) => list.map((f) => (code.get(f) ?? blankComments(read(f)))).join("\n");

// C8 — raw body before signature
{
  const findings = [];
  for (const f of callbackRoutes) {
    const lines = code.get(f).split("\n");
    const jsonCall = lines.findIndex((l) => /\.\s*json\s*\(\s*\)/.test(l) && /\b(req|request)\b/.test(l));
    if (jsonCall >= 0) findings.push(`${f}:${jsonCall + 1} request.json() — read the raw body with request.text()`);
    // raw text: request.text(), or a bounded reader (readBodyLimited(request), body.getReader())
    if (!lines.some((l) => /\.\s*text\s*\(\s*\)|\bread\w*Body\w*\s*\(|\.getReader\s*\(/.test(l))) {
      findings.push(`${f}:1 the raw body is never read with request.text() or a bounded stream reader`);
    }
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
      // an operand of ===/!== that looks like a signature: sig, signature, expectedSig, hmac, digest…
      const SIG = String.raw`(?!signal\b)\w*(?:sig|hmac|digest)\w*|expected\w*`;
      const compare = new RegExp(String.raw`\b(?:${SIG})\b(?:\s*\)|\.\w+\([^)]*\))*\s*[!=]==?\s*(?!["'\`]|null\b|undefined\b|\d)|[!=]==?\s*\b(?:${SIG})\b(?!\s*\.length)`, "i");
      if (compare.test(l) && !/\.length\s*[!=]==?|typeof\s/.test(l)) {
        findings.push(`${f}:${i + 1} signature compared with ===/!== — use crypto.timingSafeEqual`);
      }
    });
  }
  if (callbackScope.length && !/timingSafeEqual\s*\(/.test(scopeText(callbackContext))) {
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
    // with --changed-since an untouched legacy line is old code, not the run's work
    if (legacy && lineChanged(env, legacy.line)) findings.push(`${env}:${legacy.line} N8N_WEBHOOK_URL is not a contract key (use N8N_WEBHOOK_BASE_URL + /<event>)`);
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
  const text = scopeText(callbackContext);
  if (callbackScope.length) {
    if (!/x-n8n-timestamp/i.test(text)) findings.push(`${callbackScope[0]}:1 x-n8n-timestamp is never read`);
    else if (!/\b300\b|5\s*\*\s*60/.test(text)) findings.push(`${callbackScope[0]}:1 no 300 s window for x-n8n-timestamp`);
  }
  result("C13", "callback-replay", findings, callbackScope.length > 0);
}

// C14 — idempotency on callbacks, checked PER ROUTE (one protected route must not hide another):
// the header value is read into a variable, that variable is claimed/stored (a repeat is answered
// without processing) and compared with `${jobId}:…` built from the signed body (the header is not signed).
{
  const findings = [];
  for (const f of callbackRoutes) {
    const text = code.get(f) ?? blankComments(read(f));
    const header = /\b(?:const|let|var)\s+(\w+)\s*=[^;\n]*headers\s*\.\s*get\s*\(\s*["'`]idempotency-key["'`]\s*\)/i.exec(text);
    if (!/["'`]idempotency-key["'`]/i.test(text)) {
      findings.push(`${f}:1 idempotency-key header is never read`);
      continue;
    }
    if (!header) {
      findings.push(`${f}:1 idempotency-key is not read into a variable — nothing can be claimed or compared`);
      continue;
    }
    const k = header[1];
    const at = `${f}:${lineOf(text, header.index)}`;
    const claimed = new RegExp(String.raw`\b\w*(?:claim|seen|dedup|idempot|processed|lock|reserve|insert|mark)\w*\s*\(\s*(?:await\s+)?${k}\b`, "i");
    const jobKey = String.raw`\`[^\`]*\$\{[^}]*jobId[^}]*\}[^\`]*\``;
    const matched = new RegExp(String.raw`\b${k}\s*[!=]==?\s*${jobKey}|${jobKey}\s*[!=]==?\s*${k}\b`);
    if (!claimed.test(text)) findings.push(`${at} idempotency-key "${k}" is never claimed/stored — a repeated callback is processed again`);
    if (!matched.test(text)) findings.push(`${at} idempotency-key "${k}" is not compared with \`\${jobId}:…\` from the signed body`);
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
