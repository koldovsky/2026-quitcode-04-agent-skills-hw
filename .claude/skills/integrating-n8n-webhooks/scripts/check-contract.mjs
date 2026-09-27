#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract.
// Node built-ins only. Exit code: 0 — no FAIL, 1 — at least one FAIL, 2 — usage error.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const HELP = `check-contract.mjs — static check of the Next.js <-> n8n contract

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>] [--help]

Options:
  --root <dir>              Project to check (default: current directory).
  --changed-since <ref>     Only files changed after <ref> (plus new untracked files); in files
                            that already existed, only changed lines. Needs git in <dir>.
  -h, --help                Show this help.

Checks (each prints PASS or FAIL; FAIL lists file:line):
  C1   no test webhook URL (/webhook-test/) in code or .env.example
  C2   no NEXT_PUBLIC_N8N_* variables (n8n config stays server-only)
  C3   n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/
  C4   every lib/n8n/ module starts with import "server-only" (and exists if n8n is used)
  C5   every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   callback route reads the raw body (req.text()); no req.json() / JSON.parse before the signature check
  C7   callback signature is compared with timingSafeEqual, never === / !==
  C8   no export const runtime = "edge"
  C9   no bodies, form data, personal data or secrets in console.* calls
  C10  .env.example has the contract keys, change-me-… secrets, a /webhook base URL, no legacy N8N_WEBHOOK_URL
  C11  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
  C12  Server Actions trigger n8n inside after(), not while the user waits
  C13  callback route deduplicates by the idempotency-key header
  C14  N8N_CALLBACK_SECRET is used only in callback routes (never sent to n8n, rendered or logged)

Skipped directories: node_modules, .next, .git, .claude, tools, docs, materials, .github, out, build, coverage.
Exit code: 0 when there is no FAIL, 1 when there is at least one FAIL, 2 on usage errors.`;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const out = { root: process.cwd(), changedSince: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--root" || a === "--changed-since") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) usage(`${a} needs a value`);
      if (a === "--root") out.root = value;
      else out.changedSince = value;
    } else if (a.startsWith("--root=")) out.root = a.slice(7);
    else if (a.startsWith("--changed-since=")) out.changedSince = a.slice(16);
    else usage(`unknown argument: ${a}`);
  }
  return out;
}

function usage(message) {
  console.error(`check-contract: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}
if (!existsSync(args.root) || !statSync(args.root).isDirectory()) usage(`--root is not a directory: ${args.root}`);

// ---------------------------------------------------------------- files

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".claude", "tools", "docs", "materials", ".github",
  "out", "build", "coverage", ".vercel", "dist",
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...walk(join(dir, entry.name)));
    } else if (entry.isFile() && (CODE_EXT.test(entry.name) || entry.name === ".env.example")) {
      if (entry.name.endsWith(".d.ts")) continue;
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const toRel = (abs) => relative(args.root, abs).split(sep).join("/");

const files = walk(args.root).map((abs) => {
  const text = readFileSync(abs, "utf8");
  return { rel: toRel(abs), text, lines: text.split(/\r?\n/) };
});
const code = files.filter((f) => CODE_EXT.test(f.rel));
const envExample = files.find((f) => f.rel === ".env.example");

const isComment = (line) => /^\s*(\/\/|\/\*|\*|#)/.test(line);
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// ---------------------------------------------------------------- changed-since

function changedLines(root, ref) {
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    git("rev-parse", "--verify", `${ref}^{commit}`);
  } catch {
    usage(`--changed-since: unknown git ref "${ref}" in ${root}`);
  }
  const map = new Map(); // rel -> Set<line> | "all"
  let current = null;
  for (const line of git("diff", "-U0", "--no-color", "--no-renames", ref, "--").split("\n")) {
    if (line.startsWith("+++ ")) {
      current = line === "+++ /dev/null" ? null : line.slice(6);
      if (current && !map.has(current)) map.set(current, new Set());
    } else if (line.startsWith("--- /dev/null")) {
      // new file relative to ref: the following +++ line names it
    } else if (current && line.startsWith("@@")) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (m) {
        const start = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        const set = map.get(current);
        if (set !== "all") for (let n = start; n < start + count; n++) set.add(n);
      }
    }
  }
  for (const f of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) map.set(f, "all");
  // files that are new relative to ref: every line counts
  for (const f of git("diff", "--name-only", "--diff-filter=A", ref, "--").split("\n").filter(Boolean)) map.set(f, "all");
  return map;
}

const changed = args.changedSince ? changedLines(args.root, args.changedSince) : null;

function inScope(finding) {
  if (!changed) return true;
  const entry = changed.get(finding.file);
  if (!entry) return false;
  if (entry === "all" || finding.line === 0) return true;
  return entry.has(finding.line);
}

// ---------------------------------------------------------------- helpers

// Any N8N_* variable except the callback secret (which only the callback route reads), the
// default n8n port, or a webhook path. Covers ad-hoc names such as N8N_QUOTE_WEBHOOK_URL.
const N8N_URL_HINT = /process\.env\.N8N_(?!CALLBACK_SECRET\b)\w+|:5678|\/webhook(-test)?\//;

// Returns the text of a call starting at `openIndex` (the "(" after the callee), with balanced parens.
function callText(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length && i < openIndex + 4000; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return text.slice(openIndex, openIndex + 4000);
}

function n8nFetches(file) {
  // fetch(...) calls in a file that talks to n8n (URL built from N8N_* / :5678 / /webhook/)
  if (!N8N_URL_HINT.test(file.text)) return [];
  const out = [];
  const re = /\bfetch\s*\(/g;
  let m;
  while ((m = re.exec(file.text))) {
    const line = lineOf(file.text, m.index);
    if (isComment(file.lines[line - 1])) continue;
    out.push({ line, call: callText(file.text, m.index + m[0].length - 1) });
  }
  return out;
}

const inN8nModule = (rel) => /^(src\/)?lib\/n8n\//.test(rel);
const isCallbackRoute = (f) =>
  /(^|\/)route\.(ts|js|tsx|jsx|mjs)$/.test(f.rel) &&
  (/\/n8n\//.test(f.rel) || /x-n8n-signature|N8N_CALLBACK_SECRET/.test(f.text));
const usesServerDirective = (f) => /^\s*["']use server["']/m.test(f.text);
const n8nUsed = code.some((f) => N8N_URL_HINT.test(f.text) || /from\s+["'][^"']*lib\/n8n/.test(f.text));

function grepLines(fileList, regex, { skipComments = true } = {}) {
  const found = [];
  for (const f of fileList) {
    f.lines.forEach((line, i) => {
      if (skipComments && isComment(line)) return;
      if (regex.test(line)) found.push({ file: f.rel, line: i + 1, text: line.trim() });
    });
  }
  return found;
}

// ---------------------------------------------------------------- checks

const checks = [];
const check = (id, title, run) => checks.push({ id, title, run });

check("C1", "no test webhook URL (/webhook-test/) in code or .env.example", () =>
  // a test URL: ".../webhook-test/<path>" or "http(s)://host/webhook-test"; a guard such as
  // url.includes("/webhook-test") is not a URL and is not flagged
  grepLines([...code, ...(envExample ? [envExample] : [])], /\/webhook-test\/|https?:\/\/\S*\/webhook-test\b/));

check("C2", "no NEXT_PUBLIC_N8N_* variables", () =>
  grepLines([...code, ...(envExample ? [envExample] : [])], /NEXT_PUBLIC_N8N/));

check("C3", "n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/", () => {
  const found = [];
  for (const f of code) {
    if (inN8nModule(f.rel)) continue;
    for (const { line } of n8nFetches(f)) found.push({ file: f.rel, line, text: `fetch to n8n outside lib/n8n/: ${f.lines[line - 1].trim()}` });
    f.lines.forEach((l, i) => {
      if (!isComment(l) && /process\.env\.N8N_(?!CALLBACK_SECRET\b)\w+/.test(l) && !found.some((x) => x.file === f.rel && x.line === i + 1)) {
        found.push({ file: f.rel, line: i + 1, text: `N8N_* read outside lib/n8n/: ${l.trim()}` });
      }
    });
  }
  return found;
});

check("C4", 'lib/n8n/ modules start with import "server-only"', () => {
  const found = [];
  const modules = code.filter((f) => inN8nModule(f.rel));
  for (const f of modules) {
    const first = f.lines.findIndex((l) => l.trim() && !isComment(l));
    if (first === -1 || !/^\s*import\s+["']server-only["']/.test(f.lines[first])) {
      found.push({ file: f.rel, line: first + 1 || 1, text: 'first statement is not import "server-only"' });
    }
  }
  if (n8nUsed && modules.length === 0) {
    const user = code.find((f) => N8N_URL_HINT.test(f.text));
    const line = user ? user.lines.findIndex((l) => N8N_URL_HINT.test(l)) + 1 : 0;
    found.push({ file: user?.rel ?? "lib/n8n/client.ts", line, text: "n8n is used but there is no lib/n8n/ client module" });
  }
  return found;
});

check("C5", "every fetch to n8n has signal: AbortSignal.timeout(...)", () => {
  const found = [];
  for (const f of code) {
    for (const { line, call } of n8nFetches(f)) {
      if (!/AbortSignal\.timeout\s*\(/.test(call)) found.push({ file: f.rel, line, text: `fetch without AbortSignal.timeout: ${f.lines[line - 1].trim()}` });
    }
  }
  return found;
});

check("C6", "callback route reads the raw body and parses it only after the signature check", () => {
  const found = [];
  for (const f of code.filter(isCallbackRoute)) {
    const post = f.lines.findIndex((l) => /export\s+(async\s+)?function\s+POST|export\s+const\s+POST/.test(l));
    const start = post === -1 ? 0 : post;
    const verify = f.lines.findIndex(
      (l, i) => i > start && !isComment(l) && /timingSafeEqual\s*\(|verif\w*\s*\(|[sS]ignature\w*\s*\(/.test(l) && !/function\s/.test(l),
    );
    f.lines.forEach((l, i) => {
      if (isComment(l)) return;
      if (/\.json\s*\(\s*\)/.test(l) && !/(Response|NextResponse)\.json/.test(l)) {
        found.push({ file: f.rel, line: i + 1, text: `request body parsed with .json(): ${l.trim()}` });
      }
      if (i > start && /JSON\.parse\s*\(/.test(l) && (verify === -1 || i < verify)) {
        found.push({ file: f.rel, line: i + 1, text: `JSON.parse before the signature check: ${l.trim()}` });
      }
    });
    if (!/\.text\s*\(\s*\)/.test(f.text)) found.push({ file: f.rel, line: start + 1, text: "body is not read as raw text (req.text())" });
  }
  return found;
});

check("C7", "callback signature compared with timingSafeEqual, never === / !==", () => {
  const found = [];
  const cmp = /(signature|digest|hmac|\bsig\b|expected)\w*\s*[!=]==|[!=]==\s*\w*(signature|digest|hmac|\bsig\b|expected)/i;
  for (const f of code.filter(isCallbackRoute)) {
    f.lines.forEach((l, i) => {
      if (!isComment(l) && cmp.test(l) && !/\.length\s*[!=]==|[!=]==\s*\w+\.length/.test(l)) {
        found.push({ file: f.rel, line: i + 1, text: `signature compared with ===/!==: ${l.trim()}` });
      }
    });
    if (!/timingSafeEqual\s*\(/.test(f.text)) found.push({ file: f.rel, line: 1, text: "no crypto.timingSafeEqual in the callback route" });
  }
  return found;
});

check("C8", 'no export const runtime = "edge"', () =>
  grepLines(code, /export\s+const\s+runtime\s*=\s*["']edge["']/));

check("C9", "no bodies, form data, personal data or secrets in console.* calls", () =>
  grepLines(
    code,
    /console\.(log|info|warn|error|debug)\s*\(.*(\bformData\b|Object\.fromEntries|\brawBody\b|\braw\b|\bbody\b|req\.body|request\.body|\bemail\b|\bphone\b|\bfullName\b|process\.env|\btoken\b|\bsecret\b|\bsignature\b|JSON\.stringify\s*\(\s*(lead|quote|data|body|payload|parsed))/i,
  ).filter((x) => !/\bbytes?=|\.length\b|sha256/.test(x.text)));

check("C10", ".env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key", () => {
  if (!n8nUsed && !envExample) return [];
  if (!envExample) return [{ file: ".env.example", line: 0, text: "missing .env.example" }];
  const found = [];
  const vars = new Map();
  envExample.lines.forEach((l, i) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (m && !isComment(l)) vars.set(m[1], { value: m[2].trim().replace(/^["']|["']$/g, ""), line: i + 1 });
  });
  for (const key of ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"]) {
    if (!vars.has(key)) found.push({ file: ".env.example", line: 0, text: `missing ${key}` });
  }
  for (const key of ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]) {
    const v = vars.get(key);
    if (v && !v.value.startsWith("change-me-")) found.push({ file: ".env.example", line: v.line, text: `${key} must be a change-me-… placeholder` });
  }
  const base = vars.get("N8N_WEBHOOK_BASE_URL");
  if (base && !/\/webhook\/?$/.test(base.value)) found.push({ file: ".env.example", line: base.line, text: "N8N_WEBHOOK_BASE_URL must end with /webhook" });
  const legacy = vars.get("N8N_WEBHOOK_URL");
  if (legacy) found.push({ file: ".env.example", line: legacy.line, text: "legacy N8N_WEBHOOK_URL (use N8N_WEBHOOK_BASE_URL + event path)" });
  return found;
});

check("C11", "requests to n8n send x-n8n-token, idempotency-key and x-correlation-id", () => {
  const found = [];
  for (const f of code) {
    for (const { line } of n8nFetches(f)) {
      const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter((h) => !f.text.toLowerCase().includes(h));
      if (missing.length) found.push({ file: f.rel, line, text: `fetch to n8n without ${missing.join(", ")}` });
    }
  }
  return found;
});

check("C12", "Server Actions trigger n8n inside after()", () => {
  const found = [];
  for (const f of code.filter(usesServerDirective)) {
    const callLines = [];
    f.lines.forEach((l, i) => {
      if (isComment(l)) return;
      if (/\btriggerWorkflow\s*\(|\bn8n\w*\s*\(|\bsendTo[Nn]8n\w*\s*\(/.test(l) && !/function\s|import\s/.test(l)) callLines.push(i + 1);
    });
    for (const { line } of n8nFetches(f)) callLines.push(line);
    if (callLines.length === 0) continue;
    const hasAfter = /import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*["']next\/server["']/.test(f.text);
    for (const line of callLines) {
      const before = f.lines.slice(Math.max(0, line - 40), line).join("\n");
      if (!hasAfter || !/\bafter\s*\(/.test(before)) found.push({ file: f.rel, line, text: `n8n called outside after(): ${f.lines[line - 1].trim()}` });
    }
  }
  return found;
});

check("C13", "callback route deduplicates by the idempotency-key header", () =>
  code
    .filter(isCallbackRoute)
    .filter((f) => !/idempotency-key/i.test(f.text))
    .map((f) => ({ file: f.rel, line: 1, text: "callback route never reads idempotency-key" })));

check("C14", "N8N_CALLBACK_SECRET is used only in callback routes", () =>
  grepLines(code.filter((f) => !isCallbackRoute(f)), /N8N_CALLBACK_SECRET/).map((x) => ({
    ...x,
    text: `callback secret used outside the callback route: ${x.text}`,
  })));

// ---------------------------------------------------------------- report

let failed = 0;
const scope = args.changedSince ? `, changed since ${args.changedSince} (${changed.size} file(s))` : "";
console.log(`check-contract — root: ${args.root}${scope}`);
for (const c of checks) {
  const findings = c.run().filter(inScope);
  if (findings.length === 0) {
    console.log(`${c.id.padEnd(4)} PASS  ${c.title}`);
  } else {
    failed++;
    console.log(`${c.id.padEnd(4)} FAIL  ${c.title}`);
    for (const f of findings) console.log(`       ${f.file}:${f.line || "-"}  ${f.text.slice(0, 160)}`);
  }
}
console.log(`\n${checks.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
