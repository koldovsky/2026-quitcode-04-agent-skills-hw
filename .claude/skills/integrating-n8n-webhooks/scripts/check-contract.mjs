#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract
// (skill integrating-n8n-webhooks). Node built-ins only. Never prints file contents,
// so secrets or bodies in the checked code never reach the terminal.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const HELP = `check-contract.mjs — does the code follow the Next.js <-> n8n contract?

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>]

Options:
  --root <dir>             Project to check (default: current directory).
  --changed-since <ref>    Only report findings in files changed since <ref> (plus new,
                           untracked files); in tracked files only the changed lines.
                           Uses "git diff -U0 <ref>" inside --root.
  -h, --help               Show this help.

Checks (each prints PASS or FAIL; FAIL lists file:line):
  C1   No test webhook URL (/webhook-test/) in code or .env.example
  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
  C3   Requests to n8n only from lib/n8n/client.ts
  C4   lib/n8n/client.ts starts with import "server-only"
  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
  C7   Request body is the envelope { version, event, data }, not a raw record
  C8   Server Actions do not await n8n: calls to n8n run inside after()
  C9   Callback route reads the raw body (request.text()) and parses JSON only after the signature check
  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === / !== on signatures
  C11  Callback checks x-n8n-timestamp within a 300 s window
  C12  Callback uses idempotency-key and checks it against jobId from the signed body
  C13  No runtime = "edge"
  C14  No request bodies or personal data in logs of n8n / Server Action code
  C15  .env.example has N8N_WEBHOOK_BASE_URL (.../webhook), N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET
       (change-me-...) and APP_BASE_URL

Checks with nothing to inspect (e.g. no callback route yet) print PASS with "(nothing to check)".
Exit code: 0 if every check passes, 1 if any check fails, 2 on usage errors.`;

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
let root = process.cwd();
let changedSince = null;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    console.log(HELP);
    process.exit(0);
  } else if (arg === "--root" && args[i + 1]) {
    root = resolve(args[++i]);
  } else if (arg === "--changed-since" && args[i + 1]) {
    changedSince = args[++i];
  } else {
    console.error(`Unknown or incomplete argument: ${arg}\n\n${HELP}`);
    process.exit(2);
  }
}
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`--root is not a directory: ${root}`);
  process.exit(2);
}

// ---------------------------------------------------------------- files
const CODE_DIRS = ["app", "lib", "components", "src", "pages", "server", "utils"];
const CODE_ROOT_FILES = ["proxy.ts", "proxy.js", "middleware.ts", "middleware.js", "instrumentation.ts"];
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CODE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(root, file).split(sep).join("/");
const codeFiles = [
  ...CODE_DIRS.flatMap((d) => walk(join(root, d))),
  ...CODE_ROOT_FILES.map((f) => join(root, f)).filter((f) => existsSync(f)),
].map((file) => {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return { path: rel(file), text, code: stripComments(text) };
});
const envExamplePath = join(root, ".env.example");
const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8").replace(/\r\n/g, "\n") : null;

// Replace comments with spaces (keeping newlines and offsets) so that "// never /webhook-test/"
// in a comment does not count as code. Strings and template literals are kept as they are.
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null; // ' " `
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && n === "*") {
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    out += c;
    i++;
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Text of a call's argument list: from "(" at openIndex to the matching ")".
function callArgs(code, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")" && --depth === 0) return { text: code.slice(openIndex + 1, i), end: i };
  }
  return { text: code.slice(openIndex + 1), end: code.length };
}

// Ranges [start, end] covered by after(...) calls.
function afterRanges(code) {
  const ranges = [];
  for (const m of code.matchAll(/\bafter\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    ranges.push([open, callArgs(code, open).end]);
  }
  return ranges;
}

// ---------------------------------------------------------------- --changed-since
let changed = null; // Map<path, Set<line> | "all">
if (changedSince) {
  try {
    const git = (gitArgs) => execFileSync("git", gitArgs, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    changed = new Map();
    let current = null;
    for (const line of git(["diff", "-U0", "--no-color", "--no-ext-diff", changedSince, "--"]).split("\n")) {
      if (line.startsWith("+++ ")) {
        current = line === "+++ /dev/null" ? null : line.slice(6);
        if (current && !changed.has(current)) changed.set(current, new Set());
      } else if (line.startsWith("@@") && current) {
        const m = line.match(/\+(\d+)(?:,(\d+))?/);
        const start = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        for (let l = start; l < start + count; l++) changed.get(current).add(l);
      }
    }
    for (const file of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
      changed.set(file, "all");
    }
  } catch (error) {
    console.error(`--changed-since ${changedSince}: git failed (${error.message.split("\n")[0]})`);
    process.exit(2);
  }
}
const inScope = (file, line) => {
  if (!changed) return true;
  const lines = changed.get(file);
  return lines === "all" || (lines instanceof Set && (line === 0 ? lines.size > 0 : lines.has(line)));
};

// ---------------------------------------------------------------- facts about the project
const CLIENT_RE = /^(src\/)?lib\/n8n\/client\.(ts|js|mjs)$/;
const clientFile = codeFiles.find((f) => CLIENT_RE.test(f.path)) ?? null;
// A callback route is any Route Handler n8n calls: under app/api/n8n/, or any route.ts with a POST
// handler that uses the callback secret, x-n8n-* headers or mentions n8n (names vary by project).
const callbackRoutes = codeFiles.filter(
  (f) =>
    /(^|\/)app\/api\/n8n\/.*route\.(ts|js)$/.test(f.path) ||
    (/(^|\/)route\.(ts|js)$/.test(f.path) &&
      /\bexport\s+(async\s+)?(function|const)\s+POST\b/.test(f.code) &&
      /N8N_\w*SECRET|x-n8n-|\bn8n\b/i.test(f.code)),
);
// A file talks to n8n if it reads any N8N_* variable except the callback secret
// (N8N_WEBHOOK_URL, N8N_QUOTE_WEBHOOK_URL, N8N_TOKEN…) or calls a /webhook path.
const N8N_OUT_RE = /\bN8N_(?!CALLBACK_SECRET\b)\w+|["'`][^"'`]*\/webhook(-test)?\//;
const n8nFetchFiles = codeFiles.filter((f) => N8N_OUT_RE.test(f.code) && /\bfetch\s*\(/.test(f.code));
const fetchCalls = (file) =>
  [...file.code.matchAll(/\bfetch\s*\(/g)].map((m) => {
    const open = m.index + m[0].length - 1;
    return { index: m.index, line: lineOf(file.code, m.index), args: callArgs(file.code, open).text };
  });

// ---------------------------------------------------------------- checks
const results = [];
function check(id, title, run) {
  const findings = [];
  const fail = (file, line, message) => findings.push({ file, line, message });
  const note = run(fail) ?? "";
  const scoped = findings.filter((f) => inScope(f.file, f.line));
  results.push({ id, title, findings: scoped, note: scoped.length === 0 ? note : "" });
}

check("C1", "No test webhook URL (/webhook-test/) in code or .env.example", (fail) => {
  for (const f of codeFiles) for (const m of f.code.matchAll(/\/webhook-test\b/g)) fail(f.path, lineOf(f.code, m.index), "test webhook path");
  if (envExample) envExample.split("\n").forEach((l, i) => /^\s*[^#].*\/webhook-test\b/.test(l) && fail(".env.example", i + 1, "test webhook URL"));
});

check("C2", "No NEXT_PUBLIC_ prefix on N8N_* variables", (fail) => {
  for (const f of codeFiles) for (const m of f.code.matchAll(/NEXT_PUBLIC_N8N_\w*/g)) fail(f.path, lineOf(f.code, m.index), "N8N_* exposed to the browser");
  if (envExample) envExample.split("\n").forEach((l, i) => /^\s*NEXT_PUBLIC_N8N_/.test(l) && fail(".env.example", i + 1, "N8N_* exposed to the browser"));
});

check("C3", "Requests to n8n only from lib/n8n/client.ts", (fail) => {
  for (const f of n8nFetchFiles) {
    if (clientFile && f.path === clientFile.path) continue;
    for (const call of fetchCalls(f)) fail(f.path, call.line, "fetch to n8n outside lib/n8n/client.ts");
  }
  for (const f of codeFiles) {
    if (clientFile && f.path === clientFile.path) continue;
    for (const m of f.code.matchAll(/process\.env\.(N8N_(?!CALLBACK_SECRET\b)\w+)/g)) {
      fail(f.path, lineOf(f.code, m.index), `${m[1]} read outside lib/n8n/client.ts`);
    }
  }
  if (!clientFile && n8nFetchFiles.length === 0) return "(nothing to check: no requests to n8n)";
});

check("C4", 'lib/n8n/client.ts starts with import "server-only"', (fail) => {
  if (!clientFile) {
    for (const f of n8nFetchFiles) fail(f.path, fetchCalls(f)[0]?.line ?? 1, "no lib/n8n/client.ts with import \"server-only\"");
    return "(nothing to check: no requests to n8n)";
  }
  const first = clientFile.code.split("\n").findIndex((l) => l.trim() !== "");
  if (!/^\s*import\s+["']server-only["'];?\s*$/.test(clientFile.code.split("\n")[first] ?? "")) {
    fail(clientFile.path, first + 1, 'first statement is not import "server-only"');
  }
});

check("C5", "Every fetch to n8n has signal: AbortSignal.timeout(...)", (fail) => {
  const files = clientFile ? [...new Set([clientFile, ...n8nFetchFiles])] : n8nFetchFiles;
  let calls = 0;
  for (const f of files) {
    for (const call of fetchCalls(f)) {
      calls++;
      const inline = /signal\s*:\s*AbortSignal\.timeout\s*\(/.test(call.args);
      const viaVariable = /\bsignal\b/.test(call.args) && /AbortSignal\.timeout\s*\(/.test(f.code);
      if (!inline && !viaVariable) fail(f.path, call.line, "fetch without AbortSignal.timeout");
    }
  }
  if (calls === 0) return "(nothing to check: no requests to n8n)";
});

check("C6", "Requests send x-n8n-token, idempotency-key and x-correlation-id", (fail) => {
  const files = clientFile ? [...new Set([clientFile, ...n8nFetchFiles])] : n8nFetchFiles;
  if (files.length === 0) return "(nothing to check: no requests to n8n)";
  for (const f of files) {
    const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter((h) => !new RegExp(`["'\`]${h}["'\`]`, "i").test(f.code));
    if (missing.length) fail(f.path, fetchCalls(f)[0]?.line ?? 1, `missing header(s): ${missing.join(", ")}`);
  }
});

check("C7", "Request body is the envelope { version, event, data }", (fail) => {
  const files = clientFile ? [...new Set([clientFile, ...n8nFetchFiles])] : n8nFetchFiles;
  if (files.length === 0) return "(nothing to check: no requests to n8n)";
  for (const f of files) {
    const envelope = /\bversion\s*:\s*1\b/.test(f.code) && /\bevent\b/.test(f.code) && /\bdata\b/.test(f.code);
    if (!envelope) {
      const call = fetchCalls(f).find((c) => /\bbody\b/.test(c.args)) ?? fetchCalls(f)[0];
      fail(f.path, call?.line ?? 1, "body is not the { version: 1, event, data } envelope");
    }
  }
});

check("C8", "Server Actions do not await n8n: calls to n8n run inside after()", (fail) => {
  let actions = 0;
  for (const f of codeFiles) {
    if (!/^\s*["']use server["']/.test(f.code)) continue;
    const ranges = afterRanges(f.code);
    const inside = (index) => ranges.some(([s, e]) => index > s && index < e);
    const calls = [];
    if (N8N_OUT_RE.test(f.code)) for (const c of fetchCalls(f)) calls.push(c.index);
    // Functions imported from the n8n client module.
    for (const m of f.code.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*lib\/n8n\/client["']/g)) {
      for (const name of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
        for (const call of f.code.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))) calls.push(call.index);
      }
    }
    actions += calls.length;
    for (const index of calls) if (!inside(index)) fail(f.path, lineOf(f.code, index), "n8n called in a Server Action outside after()");
  }
  if (actions === 0) return "(nothing to check: no n8n calls in Server Actions)";
});

check("C9", "Callback route reads the raw body and parses JSON only after the signature check", (fail) => {
  if (callbackRoutes.length === 0) return "(nothing to check: no callback route)";
  for (const f of callbackRoutes) {
    for (const m of f.code.matchAll(/\.json\s*\(\s*\)/g)) {
      const before = f.code.slice(Math.max(0, m.index - 20), m.index);
      if (/(request|req)\s*$/.test(before)) fail(f.path, lineOf(f.code, m.index), "request.json() instead of the raw body");
    }
    const text = f.code.search(/\.(text|arrayBuffer)\s*\(\s*\)/);
    if (text === -1) fail(f.path, 1, "raw body is never read (request.text())");
    // The signature is checked where timingSafeEqual is used AND where the header is read
    // (a helper may be defined above the handler, but it has to be called before parsing).
    const compare = f.code.search(/timingSafeEqual\s*\(/);
    const header = f.code.search(/["'`]x-n8n-signature["'`]/i);
    const verify = compare === -1 || header === -1 ? -1 : Math.max(compare, header);
    if (header === -1) {
      fail(f.path, 1, "x-n8n-signature is never read: the body is parsed without an HMAC check");
      continue;
    }
    for (const m of f.code.matchAll(/JSON\.parse\s*\(/g)) {
      if (verify === -1 || m.index < verify) fail(f.path, lineOf(f.code, m.index), "JSON.parse before the signature check");
    }
  }
});

check("C10", "Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures", (fail) => {
  if (callbackRoutes.length === 0) return "(nothing to check: no callback route)";
  for (const f of callbackRoutes) {
    if (!/createHmac\s*\(\s*["']sha256["']/.test(f.code)) fail(f.path, 1, 'no createHmac("sha256", …)');
    if (!/timingSafeEqual\s*\(/.test(f.code)) fail(f.path, 1, "no crypto.timingSafeEqual");
    else if (!/\.length\s*(===|!==|==|!=)\s*[\w.]+\.length/.test(f.code)) fail(f.path, lineOf(f.code, f.code.search(/timingSafeEqual\s*\(/)), "no length check before timingSafeEqual");
    const lines = f.code.split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/([\w.$[\]"'`()-]+)\s*(===|!==)\s*([\w.$[\]"'`()-]+)/g)) {
        const sides = `${m[1]} ${m[3]}`;
        if (/sig|hmac|digest|expected/i.test(sides) && !/\.length\b/.test(sides) && !/null|undefined/.test(sides)) {
          fail(f.path, i + 1, `signature compared with ${m[2]}`);
        }
      }
    });
  }
});

check("C11", "Callback checks x-n8n-timestamp within a 300 s window", (fail) => {
  if (callbackRoutes.length === 0) return "(nothing to check: no callback route)";
  for (const f of callbackRoutes) {
    if (!/x-n8n-timestamp/i.test(f.code)) fail(f.path, 1, "x-n8n-timestamp is not read");
    else if (!/\b300\b|5\s*\*\s*60\b/.test(f.code)) fail(f.path, lineOf(f.code, f.code.search(/x-n8n-timestamp/i)), "no 300 s window check");
  }
});

check("C12", "Callback uses idempotency-key and checks it against jobId from the signed body", (fail) => {
  if (callbackRoutes.length === 0) return "(nothing to check: no callback route)";
  for (const f of callbackRoutes) {
    if (!/["'`]idempotency-key["'`]/i.test(f.code)) fail(f.path, 1, "idempotency-key header is not used");
    else if (!/jobId/.test(f.code)) fail(f.path, lineOf(f.code, f.code.search(/idempotency-key/i)), "idempotency-key not checked against data.jobId");
  }
});

check("C13", 'No runtime = "edge"', (fail) => {
  for (const f of codeFiles) for (const m of f.code.matchAll(/runtime\s*=\s*["']edge["']/g)) fail(f.path, lineOf(f.code, m.index), "edge runtime (node:crypto needed)");
});

check("C14", "No request bodies or personal data in logs of n8n / Server Action code", (fail) => {
  const relevant = codeFiles.filter((f) => f === clientFile || callbackRoutes.includes(f) || n8nFetchFiles.includes(f) || /^\s*["']use server["']/.test(f.code));
  const SENSITIVE = /\b(raw|rawBody|body|payload|formData|email|phone|signature|token|secret|headers|JSON\.stringify|fullName|firstName|lastName|ipAddress|message|description)\b/;
  for (const f of relevant) {
    for (const m of f.code.matchAll(/\bconsole\.(log|info|warn|error|debug)\s*\(/g)) {
      const { text } = callArgs(f.code, m.index + m[0].length - 1);
      // Only interpolations and extra arguments can leak data; plain text in quotes is fine.
      const dynamic = [...text.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]).join(" ") + " " + text.replace(/(["'`])(?:\\.|(?!\1).)*\1/gs, "");
      // Allowed by the contract: body length and sha256, the event/version/status fields.
      const allowed = dynamic
        .replace(/Buffer\.byteLength\s*\([^)]*\)/g, "")
        .replace(/createHash\s*\([^)]*\)[\w.\s()"'`]*digest\s*\([^)]*\)/g, "")
        .replace(/[\w$]+\s*\.\s*length\b/g, "")
        .replace(/\b(body|data|payload)\s*\.\s*(event|version|status)\b/g, "")
        .replace(/\.\s*(name|status|code)\b/g, "");
      if (SENSITIVE.test(allowed)) fail(f.path, lineOf(f.code, m.index), "log may contain a body, secret or personal data");
    }
  }
});

check("C15", ".env.example has the contract variables", (fail) => {
  if (envExample === null) {
    fail(".env.example", 0, "file is missing");
    return;
  }
  const lines = envExample.split("\n");
  const find = (name) => {
    const i = lines.findIndex((l) => new RegExp(`^\\s*${name}\\s*=`).test(l));
    return i === -1 ? null : { line: i + 1, value: lines[i].split("=").slice(1).join("=").trim() };
  };
  const base = find("N8N_WEBHOOK_BASE_URL");
  if (!base) fail(".env.example", 1, "N8N_WEBHOOK_BASE_URL is missing");
  else if (!/\/webhook\/?$/.test(base.value)) fail(".env.example", base.line, "N8N_WEBHOOK_BASE_URL must end with /webhook");
  for (const name of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const v = find(name);
    if (!v) fail(".env.example", 1, `${name} is missing`);
    else if (!/^change-me-/.test(v.value)) fail(".env.example", v.line, `${name} must be a change-me-… placeholder`);
  }
  if (!find("APP_BASE_URL")) fail(".env.example", 1, "APP_BASE_URL is missing");
  const legacy = find("N8N_WEBHOOK_URL");
  if (legacy) fail(".env.example", legacy.line, "N8N_WEBHOOK_URL (full URL) — use N8N_WEBHOOK_BASE_URL + event path");
});

// ---------------------------------------------------------------- report
const failed = results.filter((r) => r.findings.length > 0);
console.log(`check-contract · root: ${root}${changedSince ? ` · changed since ${changedSince}` : ""} · ${results.length} checks`);
for (const r of results) {
  console.log(`${r.findings.length ? "FAIL" : "PASS"}  ${r.id.padEnd(4)} ${r.title}${r.note ? ` ${r.note}` : ""}`);
  for (const f of r.findings) console.log(`        ${f.file}${f.line ? `:${f.line}` : ""}  ${f.message}`);
}
console.log(`\n${failed.length} FAIL, ${results.length - failed.length} PASS`);
process.exit(failed.length ? 1 : 0);
