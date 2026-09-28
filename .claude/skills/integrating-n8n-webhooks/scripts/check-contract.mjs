#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract.
// Node built-ins only. Prints PASS/FAIL per check with file:line; never prints line contents,
// env values or secrets. Reads code files and .env.example only (never .env, .env.local, ...).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HELP = `check-contract.mjs — static check of the Next.js <-> n8n contract (skill integrating-n8n-webhooks)

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>]
  node check-contract.mjs --help

Options:
  --root <dir>             Project to check (default: current directory).
  --changed-since <ref>    Only report problems on lines changed after <ref> (git diff -U0 <ref>)
                           and in new untracked files. Without it the whole project is checked.
  -h, --help               Show this help.

Checks (id  name):
  C1   test-url           no /webhook-test/ URL in code or .env.example
  C2   public-env         no NEXT_PUBLIC_N8N_* variables
  C3   single-module      n8n webhook env vars and fetch to n8n only in lib/n8n/client.ts
  C4   server-only        lib/n8n/client.ts exists when n8n is called and starts with import "server-only"
  C5   timeout            every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   request-headers    webhook call sends x-n8n-token, idempotency-key, x-correlation-id
  C7   env-example        .env.example: N8N_WEBHOOK_BASE_URL (ends with /webhook), N8N_WEBHOOK_TOKEN,
                          N8N_CALLBACK_SECRET (both change-me-...), APP_BASE_URL; no legacy N8N_WEBHOOK_URL
  C8   async-action       a Server Action ("use server") calls n8n only inside after()
  C9   raw-body           callback route reads req.text(), never req.json(); JSON.parse only after the signature check
  C10  signature          callback compares signatures with a length check + crypto.timingSafeEqual, never ===/!==
  C11  replay-window      callback checks x-n8n-timestamp against a 300 s window
  C12  callback-idempotency callback reads idempotency-key and answers duplicates
  C13  no-edge            no runtime = "edge" in the project
  C14  logs               console.* in n8n code never logs bodies, form data, contacts, tokens or signatures

Callback route = a route handler under app/api/n8n/, with "callback"/"webhook" in its path, or mentioning
n8n in its code. Without one, C9-C12 print N/A (nothing to check), not PASS.

Exit code: 0 if no check fails (N/A is not a failure), 1 if any check fails, 2 on usage errors.
Scanned: *.ts, *.tsx, *.js, *.jsx, *.mjs, *.cjs and .env.example; skipped: node_modules, .next, .git,
.claude, tools, docs, materials, coverage, out, build.
`;

// ---------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
let root = process.cwd();
let since = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  } else if (a === "--root") {
    if (!argv[i + 1]) usage("--root needs a directory");
    root = path.resolve(argv[++i]);
  } else if (a === "--changed-since") {
    if (!argv[i + 1]) usage("--changed-since needs a git ref");
    since = argv[++i];
  } else {
    usage(`unknown argument: ${a}`);
  }
}
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) usage(`not a directory: ${root}`);

function usage(msg) {
  process.stderr.write(`check-contract: ${msg}\nRun with --help for usage.\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------- files
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "tools", "docs", "materials", "coverage", "out", "build"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), acc);
    } else if (e.isFile() && CODE_EXT.has(path.extname(e.name)) && !e.name.endsWith(".d.ts")) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

const rel = (abs) => path.relative(root, abs).split(path.sep).join("/");
const files = walk(root).map((abs) => {
  const text = fs.readFileSync(abs, "utf8");
  return { rel: rel(abs), text, lines: text.split(/\r?\n/) };
});
const envExamplePath = path.join(root, ".env.example");
const envExample = fs.existsSync(envExamplePath)
  ? { rel: ".env.example", lines: fs.readFileSync(envExamplePath, "utf8").split(/\r?\n/) }
  : null;

// ---------------------------------------------------------------------------- helpers
const isCommentLine = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Text of a call starting at `openIndex` (the "(" position), up to the matching ")". */
function callSpan(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return { start: openIndex, end: i };
  }
  return { start: openIndex, end: text.length };
}

function findCalls(file, name) {
  const re = new RegExp(`(?<![\\w.$])${name}\\s*\\(`, "g");
  const out = [];
  for (const m of file.text.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const span = callSpan(file.text, open);
    const line = lineOf(file.text, m.index);
    if (isCommentLine(file.lines[line - 1])) continue;
    out.push({ line, span, body: file.text.slice(span.start, span.end + 1) });
  }
  return out;
}

const N8N_WEBHOOK_ENV = /process\.env\.N8N_WEBHOOK_(BASE_URL|URL|TOKEN)\b|process\.env\[["']N8N_WEBHOOK_(BASE_URL|URL|TOKEN)["']\]/;
const isClientModule = (f) => /^(src\/)?lib\/n8n\/client\.(ts|js|mjs)$/.test(f.rel);
const isRouteFile = (f) => /(^|\/)app\/.*\/route\.(ts|js|mjs)$/.test(f.rel);
// A callback route is any route handler n8n may call: under app/api/n8n/, with "callback"/"webhook"
// in its path, or mentioning n8n / the signature header in its code — wherever the author put it.
const isCallbackRoute = (f) =>
  isRouteFile(f) &&
  (/(^|\/)app\/api\/n8n\//.test(f.rel) ||
    /(^|\/)(callbacks?|webhooks?)(\/|$)/i.test(path.posix.dirname(f.rel)) ||
    /x-n8n-signature|\bn8n\b/i.test(f.text));
const n8nFetches = (f) =>
  findCalls(f, "fetch").filter((c) => /N8N_|\/webhook|n8n/i.test(c.body) || (isClientModule(f) && true));
const importsN8nClient = (f) => /from\s+["'][^"']*lib\/n8n(\/client)?["']/.test(f.text);
const isN8nCaller = (f) =>
  !isCallbackRoute(f) && (isClientModule(f) || N8N_WEBHOOK_ENV.test(f.text) || n8nFetches(f).length > 0);
const isN8nFile = (f) => isN8nCaller(f) || isCallbackRoute(f) || importsN8nClient(f);

// ---------------------------------------------------------------------------- checks
const results = [];
function check(id, name, title, fn, applies = true) {
  const findings = [];
  if (applies) fn((file, line, reason) => findings.push({ file, line, reason }));
  results.push({ id, name, title, findings, applies });
}

check("C1", "test-url", "no /webhook-test/ URL in code or .env.example", (fail) => {
  for (const f of files)
    f.lines.forEach((l, i) => {
      if (!isCommentLine(l) && /\/webhook-test(\/|\b)/.test(l)) fail(f.rel, i + 1, "test webhook URL (/webhook-test/) in code");
    });
  envExample?.lines.forEach((l, i) => {
    if (!/^\s*#/.test(l) && /\/webhook-test(\/|\b)/.test(l)) fail(".env.example", i + 1, "test webhook URL (/webhook-test/)");
  });
});

check("C2", "public-env", "no NEXT_PUBLIC_N8N_* variables", (fail) => {
  for (const f of files)
    f.lines.forEach((l, i) => {
      if (/NEXT_PUBLIC_N8N_/.test(l)) fail(f.rel, i + 1, "N8N_* variable exposed with NEXT_PUBLIC_ prefix");
    });
  envExample?.lines.forEach((l, i) => {
    if (/^\s*NEXT_PUBLIC_N8N_/.test(l)) fail(".env.example", i + 1, "N8N_* variable with NEXT_PUBLIC_ prefix");
  });
});

check("C3", "single-module", "n8n webhook env vars and fetch to n8n only in lib/n8n/client.ts", (fail) => {
  for (const f of files) {
    if (isClientModule(f)) continue;
    f.lines.forEach((l, i) => {
      if (!isCommentLine(l) && N8N_WEBHOOK_ENV.test(l)) fail(f.rel, i + 1, "N8N_WEBHOOK_* read outside lib/n8n/client.ts");
    });
    if (!isCallbackRoute(f))
      for (const c of findCalls(f, "fetch"))
        if (/N8N_|\/webhook|n8n/i.test(c.body)) fail(f.rel, c.line, "fetch to n8n outside lib/n8n/client.ts");
  }
});

check("C4", "server-only", 'lib/n8n/client.ts exists when n8n is called and starts with import "server-only"', (fail) => {
  const client = files.find(isClientModule);
  if (!client) {
    for (const f of files.filter(isN8nCaller)) {
      const line = (n8nFetches(f)[0]?.line) ?? (f.lines.findIndex((l) => N8N_WEBHOOK_ENV.test(l)) + 1 || 1);
      fail(f.rel, line, "n8n is called but there is no lib/n8n/client.ts module");
    }
    return;
  }
  const first = client.lines.findIndex((l) => l.trim() && !isCommentLine(l));
  if (first === -1 || !/^\s*import\s+["']server-only["'];?\s*$/.test(client.lines[first]))
    fail(client.rel, first + 1 || 1, 'first statement is not import "server-only"');
});

check("C5", "timeout", "every fetch to n8n has signal: AbortSignal.timeout(...)", (fail) => {
  for (const f of files.filter(isN8nCaller))
    for (const c of n8nFetches(f))
      if (!/signal\s*[:,}]|AbortSignal\.timeout/.test(c.body)) fail(f.rel, c.line, "fetch to n8n without a timeout signal");
});

check("C6", "request-headers", "webhook call sends x-n8n-token, idempotency-key, x-correlation-id", (fail) => {
  for (const f of files.filter(isN8nCaller)) {
    const calls = n8nFetches(f);
    if (calls.length === 0) continue;
    for (const h of ["x-n8n-token", "idempotency-key", "x-correlation-id"])
      if (!new RegExp(`["'\`]${h}["'\`]`, "i").test(f.text)) fail(f.rel, calls[0].line, `webhook request without header ${h}`);
  }
});

check("C7", "env-example", ".env.example lists the contract keys with safe local values", (fail) => {
  if (!envExample) {
    fail(".env.example", 1, "file is missing");
    return;
  }
  const keys = new Map();
  envExample.lines.forEach((l, i) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) keys.set(m[1], { line: i + 1, value: m[2].trim().replace(/^["']|["']$/g, "") });
  });
  for (const k of ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"])
    if (!keys.has(k)) fail(".env.example", 1, `missing key ${k}`);
  for (const k of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const v = keys.get(k);
    if (v && !/^change-me-/.test(v.value)) fail(".env.example", v.line, `${k} must be a change-me-... placeholder`);
  }
  const base = keys.get("N8N_WEBHOOK_BASE_URL");
  if (base && !/\/webhook\/?$/.test(base.value)) fail(".env.example", base.line, "N8N_WEBHOOK_BASE_URL must end with /webhook");
  const legacy = keys.get("N8N_WEBHOOK_URL");
  if (legacy) fail(".env.example", legacy.line, "legacy N8N_WEBHOOK_URL (use N8N_WEBHOOK_BASE_URL + event path)");
});

check("C8", "async-action", 'a Server Action ("use server") calls n8n only inside after()', (fail) => {
  for (const f of files) {
    const directive = f.lines.find((l) => l.trim() && !isCommentLine(l));
    if (!directive || !/^\s*["']use server["']/.test(directive)) continue;
    const imported = [];
    for (const m of f.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*lib\/n8n(?:\/client)?["']/g))
      imported.push(...m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
    const calls = [...n8nFetches(f), ...imported.flatMap((n) => findCalls(f, n))];
    if (calls.length === 0) continue;
    const afterSpans = findCalls(f, "after").map((c) => c.span);
    for (const c of calls)
      if (!afterSpans.some((s) => c.span.start > s.start && c.span.start < s.end))
        fail(f.rel, c.line, "Server Action waits for n8n (call it inside after())");
  }
});

const callbacks = files.filter(isCallbackRoute);
const checkCallback = (id, name, title, fn) => check(id, name, title, fn, callbacks.length > 0);

checkCallback("C9", "raw-body", "callback route reads req.text(), never req.json(); JSON.parse only after the signature check", (fail) => {
  for (const f of callbacks) {
    f.lines.forEach((l, i) => {
      if (!isCommentLine(l) && /\b(req|request)\s*\.\s*json\s*\(/.test(l)) fail(f.rel, i + 1, "body parsed with .json() (signature needs the raw body)");
    });
    if (!/\.\s*text\s*\(\s*\)/.test(f.text)) fail(f.rel, 1, "raw body is never read with .text()");
    const parse = f.lines.findIndex((l) => !isCommentLine(l) && /JSON\.parse\s*\(/.test(l));
    const verify = f.lines.findIndex((l) => !isCommentLine(l) && /timingSafeEqual\s*\(/.test(l));
    if (parse !== -1 && (verify === -1 || parse < verify)) fail(f.rel, parse + 1, "JSON.parse before the signature is verified");
  }
});

checkCallback("C10", "signature", "callback compares signatures with a length check + crypto.timingSafeEqual, never ===/!==", (fail) => {
  for (const f of callbacks) {
    if (!/timingSafeEqual\s*\(/.test(f.text)) fail(f.rel, 1, "no crypto.timingSafeEqual");
    else if (!/\.length\s*(!==|===|!=|==)/.test(f.text)) fail(f.rel, 1, "no length check before timingSafeEqual");
    f.lines.forEach((l, i) => {
      if (isCommentLine(l) || /\.length/.test(l)) return;
      if (/(signature|expected|digest|hmac)\w*\s*(===|!==|==|!=)\s*(?!null\b|undefined\b)|(===|!==|==|!=)\s*\w*(signature|expected|digest|hmac)/i.test(l))
        fail(f.rel, i + 1, "signature compared with ===/!== (use timingSafeEqual)");
    });
  }
});

checkCallback("C11", "replay-window", "callback checks x-n8n-timestamp against a 300 s window", (fail) => {
  for (const f of callbacks) {
    if (!/x-n8n-timestamp/i.test(f.text)) fail(f.rel, 1, "x-n8n-timestamp is not read");
    else if (!/\b300\b|300_?000|5\s*\*\s*60\b/.test(f.text)) fail(f.rel, 1, "no 300 s timestamp window");
  }
});

checkCallback("C12", "callback-idempotency", "callback reads idempotency-key and answers duplicates", (fail) => {
  for (const f of callbacks) {
    if (!/["'`]idempotency-key["'`]/i.test(f.text)) fail(f.rel, 1, "idempotency-key header is not read");
    else if (!/duplicate/i.test(f.text)) fail(f.rel, 1, "no duplicate handling for a repeated idempotency-key");
  }
});

check("C13", "no-edge", 'no runtime = "edge" in the project', (fail) => {
  for (const f of files)
    f.lines.forEach((l, i) => {
      if (!isCommentLine(l) && /runtime\s*=\s*["']edge["']/.test(l)) fail(f.rel, i + 1, 'runtime = "edge" (n8n code needs node:crypto)');
    });
});

check("C14", "logs", "console.* in n8n code never logs bodies, form data, contacts, tokens or signatures", (fail) => {
  const bad = /\b(raw|rawBody|body|payload|formData|email|phone|token|secret|signature|envelope)\b/i;
  for (const f of files.filter(isN8nFile))
    for (const c of ["log", "info", "warn", "error", "debug"].flatMap((m) => findCalls(f, `console\\.${m}`)))
      if (bad.test(c.body.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""'))) fail(f.rel, c.line, "console.* may log a body, contact data or a secret");
});

// ---------------------------------------------------------------------------- --changed-since
let changed = null;
if (since) {
  const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    git(["rev-parse", "--verify", `${since}^{commit}`]);
  } catch {
    usage(`--changed-since: unknown git ref "${since}" in ${root}`);
  }
  changed = new Map(); // file -> Set(lines) | "all"
  let current = null;
  for (const l of git(["diff", "-U0", "--no-color", since, "--"]).split("\n")) {
    const f = l.match(/^\+\+\+ b\/(.*)$/);
    if (f) {
      current = f[1];
      if (!changed.has(current)) changed.set(current, new Set());
      continue;
    }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && current) {
      const start = Number(h[1]);
      const count = h[2] === undefined ? 1 : Number(h[2]);
      for (let n = start; n < start + count; n++) changed.get(current).add(n);
      if (count === 0) changed.get(current).add(Math.max(start, 1)); // pure deletion: count the spot
    }
  }
  for (const f of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) changed.set(f, "all");
}
const inScope = (fd) => {
  if (!changed) return true;
  const c = changed.get(fd.file);
  if (!c) return false;
  if (c === "all") return true;
  // file-level findings (line 1 for "missing ...") count when the file was touched at all
  return c.has(fd.line) || (fd.line === 1 && c.size > 0);
};

// ---------------------------------------------------------------------------- report
const scope = since ? `changed since ${since}` : "whole project";
console.log(`check-contract: root=${root} | ${files.length} code files${envExample ? " + .env.example" : ""} | ${scope}`);
let failed = 0;
let notApplicable = 0;
for (const r of results) {
  const findings = r.findings.filter(inScope);
  const ok = findings.length === 0;
  if (!ok) failed++;
  if (!r.applies) notApplicable++;
  const status = !r.applies ? "N/A " : ok ? "PASS" : "FAIL";
  console.log(`${r.id.padEnd(4)} ${status}  ${r.name.padEnd(20)} ${r.title}${r.applies ? "" : " (no callback route found)"}`);
  for (const fd of findings) console.log(`       ${fd.file}:${fd.line}  ${fd.reason}`);
}
const passed = results.length - failed - notApplicable;
console.log(
  `\nSummary: ${passed} PASS, ${failed} FAIL${notApplicable ? `, ${notApplicable} N/A` : ""} (${results.length} checks, ${scope})`,
);
process.exit(failed > 0 ? 1 : 0);
