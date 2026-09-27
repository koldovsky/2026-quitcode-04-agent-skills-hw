#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract.
// Node built-ins only. Run `node check-contract.mjs --help`.
import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const HELP = `check-contract.mjs — static check of Next.js code against the Next.js <-> n8n contract

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>]

Options:
  --root <dir>              Project to check (default: current directory).
  --changed-since <ref>     Only files changed after <ref> (plus new untracked files); in files
                            that already existed, only the changed lines count. Uses git in <root>.
  -h, --help                This help.

Output: one line per check — id, PASS | FAIL | N/A, what it checks; for every FAIL the
offending file:line. N/A = nothing in the code this check applies to (for example no callback
route yet). Exit code 1 if any check FAILs, 0 otherwise, 2 on usage errors.

Scanned: *.ts *.tsx *.js *.jsx *.mjs *.cjs and .env.example under <root>, except node_modules,
.next, .git, .claude, docs, materials, tools, public, coverage, out, build and *.d.ts.

Checks:
  C1   no test webhook URL (/webhook-test/) in code or .env.example
  C2   no NEXT_PUBLIC_ variable for n8n, webhook or callback settings
  C3   requests to n8n only from lib/n8n/client.ts (no fetch to n8n, no N8N_WEBHOOK_* elsewhere)
  C4   the module that calls n8n starts with import "server-only"
  C5   every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
  C7   the request body is the envelope { version: 1, event, data }
  C8   a Server Action that triggers n8n does it inside after(), not while the user waits
  C9   callback route reads the raw body (request.text()); no request.json(), no JSON.parse before the signature check
  C10  callback signature: HMAC, length check and timingSafeEqual; never === / !== on the signature
  C11  callback timestamp (x-n8n-timestamp) checked against a 300 s window
  C12  callback idempotency-key read and bound to data.jobId from the signed body
  C13  no export const runtime = "edge"
  C14  no request bodies, form data, personal data, tokens or signatures in console.* calls of n8n code
  C15  .env.example has N8N_WEBHOOK_BASE_URL (…/webhook), N8N_WEBHOOK_TOKEN and N8N_CALLBACK_SECRET
       (change-me-…), APP_BASE_URL (local address)

The checks are heuristics over source text: they catch the known ways to break the contract,
they do not prove the code is correct. Run the app with the mock as well (see SKILL.md, Verify).
`;

let args;
try {
  args = parseArgs({
    options: { root: { type: "string" }, "changed-since": { type: "string" }, help: { type: "boolean", short: "h" } },
    strict: true,
  }).values;
} catch (error) {
  console.error(`${error.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
const ROOT_ARG = resolve(args.root ?? ".");
if (!existsSync(ROOT_ARG) || !statSync(ROOT_ARG).isDirectory()) {
  console.error(`--root: not a directory: ${ROOT_ARG}`);
  process.exit(2);
}
// Canonical path: git reports /private/var/… for /var/… on macOS, symlinks likewise.
const ROOT = realpathSync(ROOT_ARG);

// ---------------------------------------------------------------------------------------------
// Files
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "docs", "materials", "tools", "public", "coverage", "out", "build"]);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(join(dir, entry.name)));
    } else if ((CODE.test(entry.name) && !entry.name.endsWith(".d.ts")) || entry.name === ".env.example") {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}
// Comments blanked out (newlines kept, so line numbers stay): "after()" or "request.json()" in a
// comment is not code. Strings and template literals are kept, so "http://" is not a comment.
function stripComments(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      for (; j < text.length && text[j] !== quote && !(quote !== "`" && text[j] === "\n"); j++) if (text[j] === "\\") j++;
      out += text.slice(i, j + 1);
      i = j;
    } else if (ch === "/" && text[i + 1] === "/") {
      let j = i;
      while (j < text.length && text[j] !== "\n") j++;
      out += " ".repeat(j - i);
      i = j - 1;
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const j = end === -1 ? text.length : end + 2;
      out += text.slice(i, j).replace(/[^\n]/g, " ");
      i = j - 1;
    } else {
      out += ch;
    }
  }
  return out;
}
const files = walk(ROOT).map((abs) => {
  const raw = readFileSync(abs, "utf8");
  const isEnv = abs.endsWith(".env.example");
  const text = isEnv ? raw : stripComments(raw);
  return { abs, rel: relative(ROOT, abs).split(sep).join("/"), raw, rawLines: raw.split("\n"), text, lines: text.split("\n") };
});

// ---------------------------------------------------------------------------------------------
// --changed-since: which lines count
let changed = null; // Map rel -> "ALL" | Set<line>
let changedLineCount = 0;
if (args["changed-since"]) {
  const ref = args["changed-since"];
  const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let top;
  try {
    top = realpathSync(git("rev-parse", "--show-toplevel").trim());
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
  } catch {
    console.error(`--changed-since: ${ROOT} is not a git repository or "${ref}" is not a commit`);
    process.exit(2);
  }
  const toRootRel = (p) => relative(ROOT, join(top, p)).split(sep).join("/");
  changed = new Map();
  let current = null;
  for (const line of git("diff", "-U0", "--no-color", ref, "--").split("\n")) {
    if (line.startsWith("+++ ")) {
      current = line === "+++ /dev/null" ? null : toRootRel(line.slice(6));
      if (current && !changed.has(current)) changed.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = 0; i < count; i++) changed.get(current).add(start + i);
      changedLineCount += count;
    }
  }
  for (const p of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) {
    changed.set(toRootRel(p), "ALL");
  }
}
const inScope = (f) => !changed || changed.has(f.rel);
const counts = (f, line) => {
  if (!changed) return true;
  const c = changed.get(f.rel);
  return c === "ALL" || (c instanceof Set && (line === 0 ? c.size > 0 : c.has(line)));
};

// ---------------------------------------------------------------------------------------------
// Helpers over source text
const lineOf = (f, index) => f.text.slice(0, index).split("\n").length;
const isComment = (s) => /^\s*(\/\/|\*|\/\*|#)/.test(s);
function callText(text, openParen) {
  // text of a call from "(" to its matching ")", skipping strings and template literals (roughly)
  let depth = 0;
  for (let i = openParen; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      for (i++; i < text.length && text[i] !== quote; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")" && --depth === 0) return text.slice(openParen, i + 1);
  }
  return text.slice(openParen);
}
const fetchCalls = (f) => [...f.text.matchAll(/\bfetch\s*\(/g)].map((m) => {
  const open = m.index + m[0].length - 1;
  return { line: lineOf(f, m.index), text: callText(f.text, open) };
});
const source = files.filter((f) => f.rel !== ".env.example" && !f.rel.endsWith("/.env.example"));
const CLIENT_MODULE = /^lib\/n8n\/client\.(ts|js|mjs)$/;
const mentionsN8n = (f) => /n8n|webhook/i.test(f.raw); // comments count here: "// call n8n" marks the file
const isRouteFile = (f) => /(^|\/)app\/.*\/?route\.(ts|js|mjs)$/.test(f.rel) || /^app\/(.+\/)?route\.(ts|js)$/.test(f.rel);
const exportsPost = (f) => /export\s+(async\s+function\s+POST|const\s+POST)\b/.test(f.text);
const callbackRoutes = source.filter((f) => isRouteFile(f) && exportsPost(f) &&
  (/(n8n|callback|webhook)/i.test(f.rel) || /x-n8n-signature|createHmac|n8n|webhook|callback/i.test(f.raw)));
// Files that send requests to n8n: a fetch in a file that talks about n8n / webhooks (not the callback route)
const n8nCallers = source.filter((f) => !callbackRoutes.includes(f) && mentionsN8n(f) && fetchCalls(f).length > 0);
const usesServer = (f) => /^\s*["']use server["']/m.test(f.text);
const importsClient = (f) => /from\s+["'][^"']*lib\/n8n(\/client)?["']/.test(f.text);

// ---------------------------------------------------------------------------------------------
const results = [];
function check(id, title, run) {
  const found = [];
  const applicable = run((f, line, msg) => found.push({ f, line, msg }));
  const failures = found.filter(({ f, line }) => counts(f, line));
  const status = failures.length ? "FAIL" : applicable === false ? "N/A" : "PASS";
  results.push({ id, title, status, failures });
}

check("C1", "no test webhook URL (/webhook-test/) in code or .env.example", (fail) => {
  for (const f of files.filter(inScope)) f.rawLines.forEach((l, i) => {
    if (/\/webhook-test\//.test(l) || /\/webhook-test["'`\s]*$/.test(l)) fail(f, i + 1, "test webhook URL");
  });
});

check("C2", "no NEXT_PUBLIC_ variable for n8n / webhook / callback settings", (fail) => {
  for (const f of files.filter(inScope)) f.rawLines.forEach((l, i) => {
    if (/NEXT_PUBLIC_[A-Z0-9_]*(N8N|WEBHOOK|CALLBACK)/.test(l)) fail(f, i + 1, "server secret or URL exposed to the browser bundle");
  });
});

check("C3", "requests to n8n only from lib/n8n/client.ts", (fail) => {
  if (!n8nCallers.length && !source.some((f) => /N8N_WEBHOOK/.test(f.text))) return false;
  for (const f of source.filter((x) => !CLIENT_MODULE.test(x.rel))) {
    if (n8nCallers.includes(f)) for (const c of fetchCalls(f)) fail(f, c.line, "fetch to n8n outside lib/n8n/client.ts");
    f.lines.forEach((l, i) => {
      if (/process\.env\.N8N_WEBHOOK|env\[["']N8N_WEBHOOK/.test(l) && !isComment(l)) fail(f, i + 1, "N8N_WEBHOOK_* read outside lib/n8n/client.ts");
    });
  }
});

check("C4", 'the module that calls n8n starts with import "server-only"', (fail) => {
  if (!n8nCallers.length) return false;
  for (const f of n8nCallers) {
    const first = f.lines.findIndex((l) => l.trim() && !isComment(l));
    if (!/^\s*import\s+["']server-only["'];?\s*$/.test(f.lines[first] ?? "")) {
      fail(f, first + 1, 'first statement is not import "server-only"');
    }
  }
});

check("C5", "every fetch to n8n has signal: AbortSignal.timeout(...)", (fail) => {
  if (!n8nCallers.length) return false;
  for (const f of n8nCallers) for (const c of fetchCalls(f)) {
    if (!/signal\s*:\s*AbortSignal\.timeout\s*\(/.test(c.text)) fail(f, c.line, "fetch without AbortSignal.timeout");
  }
});

check("C6", "requests to n8n send x-n8n-token, idempotency-key, x-correlation-id", (fail) => {
  if (!n8nCallers.length) return false;
  for (const f of n8nCallers) {
    const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter((h) => !f.text.toLowerCase().includes(h));
    if (missing.length) fail(f, fetchCalls(f)[0].line, `missing header(s): ${missing.join(", ")}`);
  }
});

check("C7", "request body is the envelope { version: 1, event, data }", (fail) => {
  if (!n8nCallers.length) return false;
  for (const f of n8nCallers) {
    if (!(/\bversion\s*:\s*1\b/.test(f.text) && /\bevent\b/.test(f.text) && /\bdata\b/.test(f.text))) {
      fail(f, fetchCalls(f)[0].line, "body is not the { version: 1, event, data } envelope");
    }
  }
});

check("C8", "a Server Action that triggers n8n does it inside after()", (fail) => {
  const actions = source.filter((f) => usesServer(f) && (importsClient(f) || n8nCallers.includes(f)));
  if (!actions.length) return false;
  for (const f of actions) {
    if (!/\bafter\s*\(/.test(f.text)) {
      const at = importsClient(f) ? f.lines.findIndex((l) => /lib\/n8n/.test(l)) + 1 : fetchCalls(f)[0].line;
      fail(f, at, "Server Action waits for n8n: no after()");
    }
  }
});

check("C9", "callback route reads the raw body; no request.json(), no JSON.parse before the signature check", (fail) => {
  if (!callbackRoutes.length) return false;
  for (const f of callbackRoutes) {
    if (!/\.text\s*\(\s*\)/.test(f.text)) fail(f, 0, "no request.text(): the raw body is not read");
    f.lines.forEach((l, i) => { if (/\b(req|request)\.json\s*\(/.test(l)) fail(f, i + 1, "request.json() re-serialises the body"); });
    const verify = f.lines.findIndex((l) => /timingSafeEqual\s*\(/.test(l));
    f.lines.forEach((l, i) => {
      if (/JSON\.parse\s*\(/.test(l) && !isComment(l) && (verify === -1 || i < verify)) fail(f, i + 1, "JSON.parse before the signature check");
    });
  }
});

check("C10", "callback signature: HMAC + length check + timingSafeEqual, never ===", (fail) => {
  if (!callbackRoutes.length) return false;
  for (const f of callbackRoutes) {
    if (!/createHmac\s*\(/.test(f.text)) fail(f, 0, "no HMAC computed in the route file");
    if (!/timingSafeEqual\s*\(/.test(f.text)) fail(f, 0, "no timingSafeEqual in the route file (helpers it imports are not followed)");
    else if (!/\.length\s*[!=]==/.test(f.text) && !/[!=]==\s*\w+\.length/.test(f.text)) fail(f, 0, "no length check before timingSafeEqual");
    f.lines.forEach((l, i) => {
      if (/signature|digest|hmac/i.test(l) && /[!=]==/.test(l) && !/\.length\s*[!=]==|[!=]==\s*\w+\.length|typeof/.test(l) && !isComment(l)) {
        fail(f, i + 1, "signature compared with === / !==");
      }
    });
  }
});

check("C11", "callback timestamp checked against a 300 s window", (fail) => {
  if (!callbackRoutes.length) return false;
  for (const f of callbackRoutes) {
    if (!/x-n8n-timestamp/i.test(f.text)) fail(f, 0, "x-n8n-timestamp is not read");
    else if (!/\b(300|300_000|300000|5\s*\*\s*60)\b/.test(f.text)) fail(f, 0, "no 300 s window");
  }
});

const KEY_BOUND = new RegExp([
  String.raw`[!=]==\s*\`\$\{[^}\`]*jobId[^}\`]*\}:\$\{[^}\`]+\}\``,   // key !== `${d.jobId}:${body.event}`
  String.raw`\`\$\{[^}\`]*jobId[^}\`]*\}:\$\{[^}\`]+\}\`\s*[!=]==`,   // `${d.jobId}:${body.event}` === key
  String.raw`[!=]==\s*[\w.?]*jobId\s*\+\s*["']:["']\s*\+`,               // key === d.jobId + ":" + event
].join("|"));
check("C12", "callback idempotency-key read and bound to data.jobId of the signed body", (fail) => {
  if (!callbackRoutes.length) return false;
  for (const f of callbackRoutes) {
    if (!/idempotency-key/i.test(f.text)) fail(f, 0, "idempotency-key is not read");
    // the key must be COMPARED with "<jobId>:<event>" built from the signed body, not just mentioned next to it
    else if (!KEY_BOUND.test(f.text)) fail(f, 0, "idempotency-key is not compared (=== / !==) with `${jobId}:${event}` of the signed body");
  }
});

check("C13", 'no export const runtime = "edge"', (fail) => {
  for (const f of source.filter(inScope)) f.lines.forEach((l, i) => {
    if (/export\s+const\s+runtime\s*=\s*["']edge["']/.test(l)) fail(f, i + 1, 'runtime "edge": node:crypto is needed, and edge is deprecated in Next.js 16');
  });
});

check("C14", "no bodies, form data, personal data, tokens or signatures in console.* of n8n code", (fail) => {
  const scope = [...new Set([...n8nCallers, ...callbackRoutes, ...source.filter((f) => usesServer(f) && importsClient(f))])];
  if (!scope.length) return false;
  const LOGGED = /formData|\braw\b|\bbody\b|payload|email|phone|token|secret|signature|headers\b|fullName|\bname\b/i;
  for (const f of scope) for (const m of f.text.matchAll(/console\.(log|info|warn|error|debug)\s*\(/g)) {
    // error.name is the class of the error ("TimeoutError"), not data: it may be logged
    const text = callText(f.text, m.index + m[0].length - 1).replace(/\b(?:err|error|e)\.name\b/g, "");
    if (LOGGED.test(text)) fail(f, lineOf(f, m.index), "log call may print a body, personal data or a secret");
  }
});

check("C15", ".env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL", (fail) => {
  const f = files.find((x) => x.rel === ".env.example");
  if (!f) return false;
  const value = (key) => {
    const i = f.lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    return i === -1 ? null : { line: i + 1, v: f.lines[i].split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") };
  };
  const base = value("N8N_WEBHOOK_BASE_URL");
  if (!base) fail(f, 0, "N8N_WEBHOOK_BASE_URL is missing");
  else if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/webhook\/?$/.test(base.v)) fail(f, base.line, "N8N_WEBHOOK_BASE_URL must be a local …/webhook address");
  for (const key of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const s = value(key);
    if (!s) fail(f, 0, `${key} is missing`);
    else if (!/^change-me-/.test(s.v)) fail(f, s.line, `${key} must be a change-me-… placeholder`);
  }
  const app = value("APP_BASE_URL");
  if (!app) fail(f, 0, "APP_BASE_URL is missing");
  else if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(app.v)) fail(f, app.line, "APP_BASE_URL must be a local address");
});

// ---------------------------------------------------------------------------------------------
const mode = changed ? `changed since ${args["changed-since"]}: ${changed.size} file(s), ${changedLineCount} changed line(s) + new files` : "full";
console.log(`check-contract · root ${ROOT} · ${mode}`);
console.log(`n8n callers: ${n8nCallers.map((f) => f.rel).join(", ") || "-"} · callback routes: ${callbackRoutes.map((f) => f.rel).join(", ") || "-"}`);
for (const r of results) {
  console.log(`${r.id.padEnd(4)} ${r.status.padEnd(4)} ${r.title}`);
  for (const { f, line, msg } of r.failures) console.log(`       ${f.rel}:${line || 1}  ${msg}`);
}
const n = (s) => results.filter((r) => r.status === s).length;
console.log(`Summary: ${n("PASS")} PASS, ${n("FAIL")} FAIL, ${n("N/A")} N/A`);
process.exit(n("FAIL") ? 1 : 0);
