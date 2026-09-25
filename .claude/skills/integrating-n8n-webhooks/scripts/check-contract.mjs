#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract
// (skill integrating-n8n-webhooks). Node built-ins only. Never prints file contents,
// secret values or request bodies: only check ids, file:line and a short reason.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const HELP = `check-contract.mjs — static check of the Next.js <-> n8n contract

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>]
  node check-contract.mjs --help

Options:
  --root <dir>              Project to check (default: current directory).
  --changed-since <ref>     Only report problems in files changed since <ref> (committed,
                            staged, unstaged and new untracked files); in files that already
                            existed at <ref>, only on changed lines. Needs git in <root>.
  -h, --help                Show this help.

Scans app/, lib/, components/, src/, pages/, top-level *.ts|js files and .env*.example.
Never reads .env or .env.local. Skips node_modules, .next, .git and .claude.

Checks:
  C1  no /webhook-test/ URL in code or .env*.example
  C2  no NEXT_PUBLIC_ prefix on N8N_* variables
  C3  n8n webhook calls only from lib/n8n/client.ts (a call = reading any N8N_* variable except
      N8N_CALLBACK_SECRET, or a fetch whose call mentions n8n / a webhook)
  C4  lib/n8n/client.ts exists and starts with import "server-only" (when n8n is called)
  C5  every fetch to n8n has a timeout (AbortSignal.timeout)
  C6  outgoing n8n request sets x-n8n-token, idempotency-key and x-correlation-id
  C7  request body is the envelope { version: 1, event, data } (not a raw record)
  C8  .env.example uses N8N_WEBHOOK_BASE_URL (/webhook), N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET,
      APP_BASE_URL; secrets are change-me-...; no legacy N8N_WEBHOOK_URL
  C9  Server Actions that start a workflow do it in after(), not while the user waits
  C10 callback route reads the raw body (request.text() or a size-capped stream read); no
      req.json()/JSON.parse before the signature check. Callback routes are found by path (app/api/n8n/**) or by content
      (x-n8n-signature / x-n8n-timestamp / N8N_CALLBACK_SECRET) anywhere under app/
  C11 callback signature compared with a length check + timingSafeEqual, never === / !==
  C12 callback checks a 300 s timestamp window and an idempotency-key
  C13 no runtime = "edge"
  C14 no request bodies, form data or personal data in logs of n8n-related code

Output: one line per check (PASS/FAIL), file:line for every FAIL, a summary.
Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = usage error.
`;

// ---------------------------------------------------------------- arguments
function usage(message) {
  process.stderr.write(`check-contract: ${message}\nRun with --help for usage.\n`);
  process.exit(2);
}

const argv = process.argv.slice(2);
let rootArg = ".";
let changedSince = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  } else if (a === "--root") {
    if (!argv[i + 1] || argv[i + 1].startsWith("--")) usage("--root needs a directory");
    rootArg = argv[++i];
  } else if (a === "--changed-since") {
    if (!argv[i + 1] || argv[i + 1].startsWith("--")) usage("--changed-since needs a git ref");
    changedSince = argv[++i];
  } else {
    usage(`unknown argument "${a}"`);
  }
}

const ROOT = resolve(rootArg);
if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) usage(`--root "${rootArg}" is not a directory`);

// ---------------------------------------------------------------- files
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "out", "build", "coverage"]);
const SCAN_DIRS = ["app", "lib", "components", "src", "pages"];

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (CODE_EXT.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const codeFiles = [];
for (const d of SCAN_DIRS) {
  const p = join(ROOT, d);
  if (existsSync(p) && statSync(p).isDirectory()) walk(p, codeFiles);
}
for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && CODE_EXT.test(entry.name)) codeFiles.push(join(ROOT, entry.name));
}
const envExampleFiles = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && /^\.env(\..+)?\.example$/.test(e.name))
  .map((e) => join(ROOT, e.name));

const rel = (abs) => relative(ROOT, abs).split(sep).join("/");
const cache = new Map();
function lines(abs) {
  if (!cache.has(abs)) cache.set(abs, readFileSync(abs, "utf8").split(/\r?\n/));
  return cache.get(abs);
}
const text = (abs) => lines(abs).join("\n");
// Same text with // and /* */ comment lines blanked (line numbers stay the same).
const codeText = (abs) => lines(abs).map((l) => codeOnly(l)).join("\n");

// ---------------------------------------------------------------- changed lines (optional)
let changed = null; // Map<relPath, Set<lineNo> | "all">
if (changedSince) {
  const git = (args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    git(["rev-parse", "--verify", `${changedSince}^{commit}`]);
  } catch {
    usage(`--changed-since: "${changedSince}" is not a commit in ${ROOT}`);
  }
  changed = new Map();
  let current = null;
  for (const line of git(["diff", "-U0", "--no-color", "--no-renames", changedSince, "--"]).split("\n")) {
    if (line.startsWith("+++ ")) {
      current = line === "+++ /dev/null" ? null : line.slice(6);
      if (current && !changed.has(current)) changed.set(current, new Set());
    } else if (line.startsWith("@@") && current) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      const set = changed.get(current);
      if (set !== "all") for (let n = start; n < start + count; n++) set.add(n);
    }
  }
  // files that did not exist at <ref> count as fully changed
  for (const [path] of changed) {
    try {
      git(["cat-file", "-e", `${changedSince}:${path}`]);
    } catch {
      changed.set(path, "all");
    }
  }
  for (const path of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
    changed.set(path, "all");
  }
}

function inScope(file, line, fileLevel) {
  if (!changed) return true;
  const entry = changed.get(file);
  if (!entry) return false;
  if (entry === "all" || fileLevel) return true;
  return entry.has(line);
}

// ---------------------------------------------------------------- helpers
const results = [];
function check(id, title, run) {
  const found = [];
  // fileLevel: a problem of the file as a whole (e.g. a missing variable) - reported when the file changed
  const report = (file, line, reason, fileLevel = false) => {
    if (inScope(file, line, fileLevel)) found.push({ file, line, reason });
  };
  const note = run(report) || "";
  results.push({ id, title, found, note });
}

function findLines(abs, re) {
  const hits = [];
  lines(abs).forEach((l, i) => {
    if (re.test(l)) hits.push(i + 1);
  });
  return hits;
}

function isComment(l) {
  return /^\s*(\/\/|\*|\/\*|#)/.test(l);
}
// The line without a trailing // comment (good enough for these checks; ignores "//" inside URLs).
function codeOnly(l) {
  return isComment(l) ? "" : l.replace(/(^|[^:"'`])\/\/.*$/, "$1");
}

// Character ranges covered by calls such as after( ... ), found by matching parentheses
// (strings, template literals and comments are skipped).
function callSpans(src, re) {
  const spans = [];
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "'" || c === "`") {
        const q = c;
        for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      } else if (c === "/" && src[i + 1] === "/") {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (c === "/" && src[i + 1] === "*") {
        i = src.indexOf("*/", i + 2);
        if (i === -1) i = src.length;
      } else if (c === "(") depth++;
      else if (c === ")" && --depth === 0) break;
    }
    spans.push([m.index, i]);
  }
  return spans;
}
const afterSpans = (src) => callSpans(src, /\bafter\s*\(/g);

// Outgoing side: any N8N_* variable except the callback secret (N8N_WEBHOOK_URL, N8N_QUOTE_URL, ...).
const N8N_ENV_RE = /process\.env(?:\.|\[\s*["'`])N8N_(?!CALLBACK_SECRET)\w+/;
const CLIENT_RE = /^(src\/)?lib\/n8n\/client\.(ts|tsx|js|mjs)$/;
const CALLBACK_PATH_RE = /^(src\/)?app\/api\/n8n\/.*route\.(ts|js)$/;
// Callback side, found by content wherever the route lives (app/api/quotes/callback/route.ts, ...).
const CALLBACK_CONTENT_RE = /x-n8n-signature|x-n8n-timestamp|N8N_CALLBACK_SECRET/i;
const N8N_WORD_RE = /n8n|webhook/i;

// fetch( call sites that go to n8n: the call (next 20 lines) mentions n8n / a webhook,
// or the file reads an outgoing N8N_* variable.
function fetchSitesIn(f) {
  const ls = lines(f);
  const readsEnv = N8N_ENV_RE.test(text(f));
  const sites = [];
  ls.forEach((l, i) => {
    if (!/\bfetch\(/.test(codeOnly(l))) return;
    const block = ls.slice(i, i + 20).join("\n");
    if (readsEnv || N8N_WORD_RE.test(block)) sites.push({ f, line: i + 1, block });
  });
  return sites;
}

const isRoute = (f) => /(^|\/)route\.(ts|js)$/.test(rel(f));
const callbackRoutes = codeFiles.filter((f) => isRoute(f) && (CALLBACK_PATH_RE.test(rel(f)) || CALLBACK_CONTENT_RE.test(text(f))));
// files that call n8n: read an outgoing N8N_* variable or fetch an n8n / webhook URL
const n8nCallers = codeFiles.filter(
  (f) => CLIENT_RE.test(rel(f)) || N8N_ENV_RE.test(text(f)) || (!callbackRoutes.includes(f) && fetchSitesIn(f).length > 0),
);
const clientFile = codeFiles.find((f) => CLIENT_RE.test(rel(f)));
const n8nLibFiles = codeFiles.filter((f) => /^(src\/)?lib\/n8n(\/|\.)/.test(rel(f)));
// imports of the project's n8n module: "@/lib/n8n", "@/lib/n8n/client", "../n8n-client", ...
const N8N_IMPORT_RE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*\bn8n(?:[/"'-][^"']*)?["']/g;
const importsN8n = (f) => /from\s*["'][^"']*\bn8n(?:[/"'-][^"']*)?["']/.test(text(f));
function importedN8nNames(f) {
  const names = [];
  for (const m of text(f).matchAll(N8N_IMPORT_RE)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name && !/^type\s/.test(part.trim())) names.push(name);
    }
  }
  return names;
}
// files with crypto code a callback may use for verification (helpers outside the route)
const cryptoFiles = codeFiles.filter((f) => /timingSafeEqual|createHmac/.test(codeText(f)));
const n8nRelated = [...new Set([...n8nCallers, ...callbackRoutes, ...n8nLibFiles, ...codeFiles.filter(importsN8n)])];

// ---------------------------------------------------------------- checks
check("C1", "no /webhook-test/ URL in code or .env*.example", (report) => {
  for (const f of [...codeFiles, ...envExampleFiles]) {
    for (const n of findLines(f, /\/webhook-test\b/)) report(rel(f), n, "test webhook URL (works only 120 s after 'Listen for test event')");
  }
});

check("C2", "no NEXT_PUBLIC_ prefix on N8N_* variables", (report) => {
  for (const f of [...codeFiles, ...envExampleFiles]) {
    for (const n of findLines(f, /NEXT_PUBLIC_N8N_|NEXT_PUBLIC_\w*N8N/)) report(rel(f), n, "N8N_* variable exposed to the client bundle");
  }
});

check("C3", "n8n webhook calls only from lib/n8n/client.ts", (report) => {
  for (const f of n8nCallers) {
    if (CLIENT_RE.test(rel(f))) continue;
    const hits = new Set([...findLines(f, N8N_ENV_RE), ...fetchSitesIn(f).map((s) => s.line)]);
    for (const n of [...hits].sort((a, b) => a - b)) report(rel(f), n, "calls n8n outside lib/n8n/client.ts");
  }
});

check("C4", 'lib/n8n/client.ts exists and starts with import "server-only"', (report) => {
  if (n8nCallers.length === 0) return "(n/a: project does not call n8n)";
  if (!clientFile) {
    for (const f of n8nCallers) {
      const n = [...findLines(f, N8N_ENV_RE), ...fetchSitesIn(f).map((s) => s.line)].sort((a, b) => a - b)[0] ?? 1;
      report(rel(f), n, "n8n is called but lib/n8n/client.ts does not exist");
    }
    return "";
  }
  const first = lines(clientFile).findIndex((l) => l.trim() && !isComment(l));
  if (first === -1 || !/^import\s+["']server-only["'];?\s*$/.test(lines(clientFile)[first].trim())) {
    report(rel(clientFile), first + 1, 'first statement is not import "server-only"');
  }
});

const n8nFetchSites = () => n8nCallers.flatMap(fetchSitesIn);

check("C5", "every fetch to n8n has a timeout (AbortSignal.timeout)", (report) => {
  const sites = n8nFetchSites();
  if (sites.length === 0) return "(n/a: no fetch to n8n)";
  for (const s of sites) {
    if (!/signal\s*:/.test(s.block) || !/AbortSignal\.timeout\(/.test(text(s.f))) {
      report(rel(s.f), s.line, "fetch to n8n without signal: AbortSignal.timeout(...)");
    }
  }
});

check("C6", "outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id", (report) => {
  const sites = n8nFetchSites();
  if (sites.length === 0) return "(n/a: no fetch to n8n)";
  for (const s of sites) {
    // Comment-free code only, and each header as a quoted name (object key or headers.set("…")),
    // so a comment or an unrelated string cannot satisfy the check.
    const t = codeText(s.f).toLowerCase();
    const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter(
      (h) => !new RegExp(`["'\`]${h}["'\`]\\s*[:,)]`).test(t),
    );
    if (missing.length) report(rel(s.f), s.line, `missing header(s): ${missing.join(", ")}`);
  }
});

check("C7", "request body is the envelope { version: 1, event, data }", (report) => {
  const sites = n8nFetchSites();
  if (sites.length === 0) return "(n/a: no fetch to n8n)";
  for (const s of sites) {
    const t = codeText(s.f);
    if (!/\bversion\s*:\s*1\b/.test(t) || !/\bevent\s*[,:}]/.test(t) || !/\bdata\s*[,:}]/.test(t)) {
      report(rel(s.f), s.line, "body is not the { version: 1, event, data } envelope");
    }
  }
});

check("C8", ".env.example follows the contract variables", (report) => {
  const env = envExampleFiles.find((f) => rel(f) === ".env.example");
  if (!env) {
    if (n8nCallers.length === 0) return "(n/a: no .env.example and no n8n calls)";
    report(".env.example", 1, ".env.example is missing", true);
    return "";
  }
  const ls = lines(env);
  const value = (name) => {
    const i = ls.findIndex((l) => new RegExp(`^\\s*${name}\\s*=`).test(l));
    return i === -1 ? null : { line: i + 1, v: ls[i].split("=").slice(1).join("=").trim() };
  };
  for (const name of ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"]) {
    if (!value(name)) report(".env.example", 1, `${name} is missing`, true);
  }
  const base = value("N8N_WEBHOOK_BASE_URL");
  if (base && !/\/webhook\/?$/.test(base.v)) report(".env.example", base.line, "N8N_WEBHOOK_BASE_URL must end with /webhook");
  for (const name of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const s = value(name);
    if (s && !/^change-me-/.test(s.v)) report(".env.example", s.line, `${name} must be a change-me-... placeholder`);
  }
  const legacy = value("N8N_WEBHOOK_URL");
  if (legacy) report(".env.example", legacy.line, "legacy N8N_WEBHOOK_URL: use N8N_WEBHOOK_BASE_URL + /<event>");
});

check("C9", "Server Actions start n8n workflows inside after()", (report) => {
  const actions = n8nRelated.filter((f) => /^\s*["']use server["']/m.test(text(f)));
  let seen = 0;
  for (const f of actions) {
    const t = text(f);
    const names = importedN8nNames(f);
    const callRe = new RegExp(`\\b(?:fetch${names.map((n) => `|${n.replace(/[$]/g, "\\$")}`).join("")})\\s*\\(`);
    const calls = [
      ...fetchSitesIn(f).map((s) => s.line),
      ...(names.length ? findLines(f, new RegExp(`\\b(?:${names.join("|")})\\s*\\(`)).filter((n) => !/^\s*import\b/.test(lines(f)[n - 1])) : []),
    ];
    if (calls.length === 0) continue;
    seen++;
    const spans = afterSpans(t);
    const lineStarts = [0];
    for (let i = 0; i < t.length; i++) if (t[i] === "\n") lineStarts.push(i + 1);
    for (const n of [...new Set(calls)].sort((a, b) => a - b)) {
      const at = lineStarts[n - 1] + Math.max(0, lines(f)[n - 1].search(callRe));
      if (!spans.some(([a, b]) => at > a && at < b)) {
        report(rel(f), n, "Server Action waits for n8n: move the call into after() and return { status, id }");
      }
    }
  }
  if (seen === 0) return "(n/a: no Server Action calls n8n)";
});


// Names of functions (in any file) whose body calls timingSafeEqual(...)
function safeCompareHelpers() {
  const names = new Set();
  for (const f of cryptoFiles) {
    const t = codeText(f);
    const re = /(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>)/g;
    let m;
    while ((m = re.exec(t))) {
      const bodyStart = t.indexOf("{", m.index);
      if (bodyStart === -1) continue;
      let depth = 0;
      let i = bodyStart;
      for (; i < t.length; i++) {
        if (t[i] === "{") depth++;
        else if (t[i] === "}" && --depth === 0) break;
      }
      if (/timingSafeEqual\s*\(/.test(t.slice(bodyStart, i))) names.add(m[1] || m[2]);
    }
  }
  return names;
}
const HELPERS = safeCompareHelpers();
// First line of the route where the signature is verified: a timingSafeEqual( call or a helper that makes one.
function verifyLine(f) {
  const re = new RegExp(`timingSafeEqual\\s*\\(${[...HELPERS].map((n) => `|\\b${n}\\s*\\(`).join("")}`);
  const hit = lines(f).findIndex((l) => re.test(codeOnly(l)) && !/^\s*import\b/.test(l) && !/^\s*(export\s+)?(async\s+)?function\b/.test(l));
  return hit === -1 ? Infinity : hit + 1;
}

check("C10", "callback reads the raw body; no req.json()/JSON.parse before the signature check", (report) => {
  if (callbackRoutes.length === 0) return "(n/a: no n8n callback route)";
  for (const f of callbackRoutes) {
    const vLine = verifyLine(f);
    for (const n of findLines(f, /\b(req|request)\.json\(/)) {
      if (!isComment(codeOnly(lines(f)[n - 1]))) {
        if (/\b(req|request)\.json\(/.test(codeOnly(lines(f)[n - 1]))) report(rel(f), n, "req.json() re-serializes the body: read req.text() and verify first");
      }
    }
    for (const n of findLines(f, /JSON\.parse\(/)) {
      if (n < vLine && /JSON\.parse\(/.test(codeOnly(lines(f)[n - 1]))) report(rel(f), n, "JSON.parse before the signature check");
    }
    // Raw body: request.text() or, better, a size-capped stream read (getReader) directly or via a helper.
    const readsRaw = /\.text\(\s*\)|\.arrayBuffer\(\s*\)|getReader\(/.test(codeText(f)) ||
      (/\bread\w*Body\w*\s*\(/.test(codeText(f)) && cryptoFiles.concat(n8nLibFiles).some((h) => /getReader\(/.test(codeText(h))));
    if (!readsRaw) report(rel(f), 1, "raw body is not read as text (request.text() or a limited stream read)");
  }
});

check("C11", "callback signature: length check + timingSafeEqual, never === / !==", (report) => {
  if (callbackRoutes.length === 0) return "(n/a: no n8n callback route)";
  const pool = [...new Set([...callbackRoutes, ...n8nLibFiles, ...cryptoFiles])];
  for (const f of callbackRoutes) {
    if (verifyLine(f) === Infinity) {
      report(rel(f), findLines(f, /x-n8n-signature/i)[0] ?? 1, "signature is never checked with crypto.timingSafeEqual (directly or via a helper)");
    }
  }
  for (const f of pool) {
    const t = text(f);
    // variables that hold the signature header or a computed HMAC
    const sigVars = new Set();
    for (const m of t.matchAll(/(?:const|let|var)\s+(\w+)\s*=[^;\n]*(?:x-n8n-signature|createHmac|\.digest\()/gi)) sigVars.add(m[1]);
    const sigVarRe = sigVars.size ? new RegExp(`\\b(?:${[...sigVars].join("|")})\\b`) : null;
    lines(f).forEach((l, i) => {
      const code = codeOnly(l);
      if (!/[!=]==?/.test(code) || /\.length\b/.test(code)) return;
      const compared = code.split(/[!=]==?/);
      if (compared.length < 2) return;
      const touchesSig =
        /x-n8n-signature|\.digest\(/i.test(code) ||
        /\b(signature|sig|expectedSig\w*|hmac|digest)\b/i.test(code) ||
        (sigVarRe && sigVarRe.test(code));
      if (touchesSig) report(rel(f), i + 1, "signature compared with ===/!== (timing leak): use timingSafeEqual");
    });
    const ct = codeText(f);
    const calls = ct.split("\n").map((l, i) => (/timingSafeEqual\s*\(/.test(l) && !/^\s*import\b/.test(l) ? i + 1 : 0)).filter(Boolean);
    if (calls.length && !/\.length\s*[!=]==?|[!=]==?\s*[\w.]+\.length/.test(ct)) {
      report(rel(f), calls[0], "timingSafeEqual without a length check (throws on different lengths)");
    }
  }
});

check("C12", "callback checks a 300 s timestamp window and an idempotency-key", (report) => {
  if (callbackRoutes.length === 0) return "(n/a: no n8n callback route)";
  // Comment-free code: the route must read both headers, and 300 must be used in a comparison
  // (directly or through a constant = 300), not merely appear somewhere.
  const pool = [...new Set([...callbackRoutes, ...n8nLibFiles, ...cryptoFiles])].map(codeText).join("\n");
  const windowNames = [...pool.matchAll(/\b(\w+)\s*=\s*300\b/g)].map((m) => m[1]);
  const windowRe = new RegExp(`(?:<=?|>=?)\\s*(?:300\\b${windowNames.map((n) => `|${n}\\b`).join("")})|(?:\\b300${windowNames.map((n) => `|\\b${n}`).join("")})\\s*(?:<=?|>=?)`);
  const readsHeader = (t, h) => new RegExp(`headers\\.get\\(\\s*["'\`]${h}["'\`]\\s*\\)`, "i").test(t);
  for (const f of callbackRoutes) {
    const t = codeText(f);
    if (!readsHeader(t, "x-n8n-timestamp") || !windowRe.test(pool)) report(rel(f), 1, "no 300 s window check on x-n8n-timestamp");
    if (!readsHeader(t, "idempotency-key")) report(rel(f), 1, "idempotency-key header is not read");
  }
});

check("C13", 'no runtime = "edge"', (report) => {
  for (const f of codeFiles) {
    for (const n of findLines(f, /export\s+const\s+runtime\s*=\s*["']edge["']/)) report(rel(f), n, "edge runtime: node:crypto is needed");
  }
});

check("C14", "no request bodies, form data or personal data in logs of n8n-related code", (report) => {
  const PII = /\b(body|rawBody|raw|payload|envelope|formData|email|phone|fullName|firstName|lastName|headers|secret|token|signature)\b|JSON\.stringify\(/;
  for (const f of n8nRelated) {
    const t = text(f);
    for (const [a, b] of callSpans(t, /\bconsole\.(log|info|warn|error|debug)\s*\(/g)) {
      const args = t.slice(t.indexOf("(", a) + 1, b).replace(/\b\w+\.length\b/g, "");
      if (PII.test(args)) report(rel(f), t.slice(0, a).split("\n").length, "log line may contain a body, form data, personal data or a secret");
    }
  }
});

// ---------------------------------------------------------------- output
const scope = changed ? `changed since ${changedSince} (${changed.size} file(s))` : "whole project";
console.log(`n8n contract check — root: ${ROOT}`);
console.log(`scope: ${scope}; ${codeFiles.length} code file(s), ${envExampleFiles.length} .env example(s)\n`);
let failed = 0;
for (const r of results) {
  const status = r.found.length ? "FAIL" : "PASS";
  if (r.found.length) failed++;
  console.log(`${r.id.padEnd(4)} ${status}  ${r.title}${!r.found.length && r.note ? ` ${r.note}` : ""}`);
  for (const x of r.found) console.log(`       - ${x.file}${x.line ? `:${x.line}` : ""}  ${x.reason}`);
}
console.log(`\n${results.length} checks: ${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
