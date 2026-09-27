#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract.
// Node >= 20, no dependencies. Run `node check-contract.mjs --help`.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";

const HELP = `check-contract.mjs — static check of the Next.js <-> n8n contract (skill integrating-n8n-webhooks)

Usage:
  node check-contract.mjs [--root <dir>] [--changed-since <git-ref>]

Options:
  --root <dir>             Project to check (default: current directory).
  --changed-since <ref>    Only what changed after <ref> (git diff <ref> + untracked files):
                           line findings only on changed lines, file findings only for
                           changed files. Without it the whole project is checked.
  -h, --help               Show this help.

Checks (each prints PASS or FAIL; FAIL lists file:line):
  C1  No test webhook URL (/webhook-test/) in code or .env.example
  C2  No N8N_* variable with the NEXT_PUBLIC_ prefix
  C3  n8n is called only from lib/n8n/ (fetch to n8n, process.env.N8N_*), wherever the code lives
  C4  Modules that call n8n (lib/n8n/ and any other) start with import "server-only"
  C5  Every fetch to n8n has a timeout: signal: AbortSignal.timeout(...)
  C6  Requests to n8n set the headers x-n8n-token, idempotency-key and x-correlation-id
  C7  Callback route reads the raw body (request.text()); no .json(), no JSON.parse
      before the signature is verified
  C8  Callback signature: length check, then crypto.timingSafeEqual; never ===, ==, .equals()
  C9  Callback route compares x-n8n-timestamp with Date.now() (300 s) and checks
      idempotency-key against data.jobId from the signed body
  C10 No runtime = "edge"
  C11 .env.example: N8N_WEBHOOK_BASE_URL (local, ends with /webhook), APP_BASE_URL (local),
      N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET and any other secret = change-me-…
  C12 console.* in n8n code, callback routes and their callers: no bodies, secrets,
      form data or personal data
  C13 A Server Action does not wait for n8n: calls to n8n only inside after()

Scanned: *.ts, *.tsx, *.js, *.jsx, *.mjs, *.cjs and .env.example under --root, except
node_modules, .next, .git, .claude, .agents, .cursor, .codex, tools, docs, materials.
Both app/ + lib/ and src/app/ + src/lib/ layouts. A callback route is app/api/n8n/**/route.*
or any route.* that mentions x-n8n-signature, or a POST route that mentions n8n and does not call it.
A fetch is a call to n8n when its URL mentions n8n or is a variable named or assigned like a
webhook URL. Helpers imported from local modules are followed one level. Secret values are
never printed.

Exit code: 0 — no FAIL, 1 — at least one FAIL, 2 — usage error.`;

// ---------- arguments ----------

function parseArgs(argv) {
  const args = { root: process.cwd(), since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "--root" || a === "--changed-since") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) usage(`${a} needs a value`);
      if (a === "--root") args.root = value;
      else args.since = value;
    } else {
      usage(`unknown argument: ${a}`);
    }
  }
  args.root = resolve(args.root);
  if (!existsSync(args.root) || !statSync(args.root).isDirectory()) usage(`--root is not a directory: ${args.root}`);
  return args;
}

function usage(message) {
  console.error(`check-contract: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

// ---------- files ----------

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", ".agents", ".cursor", ".codex", "tools", "docs", "materials", "out", "dist", "build", "coverage"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function walk(dir, root, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), root, out);
    } else if (CODE_EXT.test(entry.name)) {
      out.push(relative(root, join(dir, entry.name)).split(sep).join("/"));
    }
  }
  return out;
}

// Blanks comments (-> `code`) and additionally string/template contents (-> `bare`),
// keeping offsets and newlines so that indexes map to the same line numbers.
function scan(src) {
  const code = src.split("");
  const bare = src.split("");
  const blank = (arr, i) => {
    if (arr[i] !== "\n" && arr[i] !== "\r") arr[i] = " ";
  };
  let i = 0;
  const stack = []; // template-literal nesting: brace depth per `${`
  let braces = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      for (; i < src.length && src[i] !== "\n"; i++) {
        blank(code, i);
        blank(bare, i);
      }
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      for (; i < stop; i++) {
        blank(code, i);
        blank(bare, i);
      }
    } else if (c === '"' || c === "'") {
      i++;
      while (i < src.length && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\") blank(bare, i++);
        blank(bare, i++);
      }
      i++;
    } else if (c === "`" || (c === "}" && stack.length && braces === stack[stack.length - 1])) {
      if (c === "}") stack.pop();
      i++;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") {
          blank(bare, i++);
          blank(bare, i++);
          continue;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          stack.push(braces);
          i += 2;
          break;
        }
        blank(bare, i++);
      }
      if (src[i] === "`") i++;
    } else {
      if (c === "{") braces++;
      if (c === "}") braces--;
      i++;
    }
  }
  return { code: code.join(""), bare: bare.join("") };
}

function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineOf(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function loadFile(root, rel) {
  const src = readFileSync(join(root, rel), "utf8");
  const { code, bare } = scan(src);
  const starts = lineStarts(src);
  const lines = src.split(/\r?\n/);
  return { rel, src, code, bare, starts, lines, line: (idx) => lineOf(starts, idx), snippet: (n) => (lines[n - 1] ?? "").trim().slice(0, 100) };
}

// Index of the bracket that closes the one at `open` ("(", "{" or "[").
function closing(file, open) {
  const opener = file.bare[open];
  const closer = { "(": ")", "{": "}", "[": "]" }[opener];
  let depth = 0;
  for (let i = open; i < file.bare.length; i++) {
    if (file.bare[i] === opener) depth++;
    else if (file.bare[i] === closer && --depth === 0) return i;
  }
  return file.bare.length;
}

// Text of the call arguments starting at the "(" at `open`.
const callArgs = (file, open) => file.code.slice(open + 1, closing(file, open));
const escapeRe = (s) => s.replace(/[$.*+?^()[\]{}|\\]/g, "\\$&");

// ---------- git (--changed-since) ----------

function changedLines(root, ref) {
  const git = (args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    usage(`--changed-since: not a git ref in ${root}: ${ref}`);
  }
  const changed = new Map(); // file -> Set(lines) | "all"
  let current = null;
  for (const l of git(["diff", "-U0", "--no-color", "--no-ext-diff", ref, "--"]).split("\n")) {
    if (l.startsWith("+++ ")) {
      current = l === "+++ /dev/null" ? null : l.slice(6);
      if (current && !changed.has(current)) changed.set(current, new Set());
    } else if (current && l.startsWith("@@")) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(l);
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let k = 0; k < count; k++) changed.get(current).add(start + k);
    }
  }
  for (const f of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) changed.set(f, "all");
  return changed;
}

// ---------- what the checks look for ----------

const N8N_TARGET = /N8N_|n8n|:5678|\/webhook(-test)?\//i;
const N8N_LIB = /^(src\/)?lib\/n8n\//;
const inN8nLib = (rel) => N8N_LIB.test(rel);
const isRoute = (f) => /(^|\/)route\.(ts|js|mjs)$/.test(f.rel);
const hasPostHandler = (f) => /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH)\b|export\s+const\s+(?:POST|PUT|PATCH)\s*=/.test(f.bare);
const isServerActionFile = (f) => /^\s*["']use server["']/.test(f.code);
const SECRET_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE/i;
const LOCAL_URL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/;
const LENGTH_CHECK = /\.(?:length|byteLength)\s*(?:!==|===|!=|==|<|>)|(?:!==|===|!=|==)\s*[\w$.]+\.(?:length|byteLength)\b/;
const WINDOW_LITERAL = /\b(?:300|300_000|300000)\b|\b5\s*\*\s*60\b/;

// A .env.example line as it may be printed: values of secret-like variables are hidden.
function envText(line) {
  const m = /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=/.exec(line);
  return m && SECRET_NAME.test(m[1]) ? `${m[1]}=<значення приховано>` : line.trim();
}

// A fetch counts as a call to n8n when it is in lib/n8n/, its arguments mention n8n (N8N_* env,
// :5678, /webhook/), or its URL is a variable named like a webhook or assigned from such a value —
// so code outside the agreed files (e.g. fetch(webhookUrl, …) in lib/quotes.ts) is checked too.
function n8nFetches(file) {
  const found = [];
  for (const m of file.bare.matchAll(/\bfetch\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const args = callArgs(file, open);
    const target = /^\s*([\w$.]+)/.exec(args)?.[1] ?? "";
    const declared = target
      ? new RegExp(`(?:const|let|var)\\s+${escapeRe(target.split(".")[0])}\\s*(?::[^=]+)?=([^;\\n]+)`).exec(file.code)?.[1]
      : null;
    if (inN8nLib(file.rel) || N8N_TARGET.test(args) || /n8n|webhook/i.test(target) || (declared && N8N_TARGET.test(declared)))
      found.push({ index: m.index, args });
  }
  return found;
}

// Value imports of a file: [{ local, imported, spec }]. The clause has no quotes or semicolons,
// so a match never spans two import statements.
function importsOf(file) {
  const out = [];
  for (const m of file.code.matchAll(/import\s+(type\s+)?([\w$\s{},*]+?)\s+from\s+["']([^"']+)["']/g)) {
    if (m[1]) continue;
    const clause = m[2].trim();
    const spec = m[3];
    const named = /\{([^}]*)\}/.exec(clause);
    if (named)
      for (const part of named[1].split(",")) {
        const p = part.trim();
        if (!p || p.startsWith("type ")) continue;
        const alias = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(p);
        out.push(alias ? { imported: alias[1], local: alias[2], spec } : { imported: p, local: p, spec });
      }
    const ns = /\*\s+as\s+([\w$]+)/.exec(clause);
    if (ns) out.push({ imported: "*", local: ns[1], spec });
    const def = /^([\w$]+)\s*(,|$)/.exec(clause);
    if (def) out.push({ imported: "default", local: def[1], spec });
  }
  return out;
}

// "@/lib/x" or "./x" -> the scanned file it points to (app/ + lib/ or src/ layout).
function resolveSpec(fromRel, spec, byRel) {
  let bases;
  if (spec.startsWith("@/")) bases = [spec.slice(2), `src/${spec.slice(2)}`];
  else if (spec.startsWith(".")) bases = [posix.normalize(posix.join(posix.dirname(fromRel), spec))];
  else return null;
  for (const b of bases)
    for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"]) if (byRel.has(b + ext)) return b + ext;
  return null;
}

// Function declarations and function-valued consts, with the span of their body.
function functionSpans(file) {
  const spans = [];
  const re = /function\s+([\w$]+)\s*(?:<[^>]*>)?\s*\(|(?:const|let|var)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b[^(]*)?\(/g;
  for (const m of file.bare.matchAll(re)) {
    const paramsOpen = m.index + m[0].length - 1;
    const paramsEnd = closing(file, paramsOpen);
    const bodyOpen = file.bare.indexOf("{", paramsEnd);
    const statementEnd = file.bare.indexOf(";", paramsEnd);
    const blockBody = bodyOpen !== -1 && /^\s*(?::[^=;{]*)?(?:=>)?\s*$/.test(file.bare.slice(paramsEnd + 1, bodyOpen));
    const end = blockBody ? closing(file, bodyOpen) : statementEnd === -1 ? file.bare.length : statementEnd;
    spans.push({ name: m[1] ?? m[2], start: m.index, end });
  }
  return spans;
}

// What the checks need to know about the project as a whole: which files and functions call
// n8n, which functions verify a signature, what each file imports, which routes are callbacks.
function buildModel(files) {
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const fetches = new Map(files.map((f) => [f.rel, n8nFetches(f)]));
  const spans = new Map(files.map((f) => [f.rel, functionSpans(f)]));
  const names = (rel, test) => new Set(spans.get(rel).filter(test).map((s) => s.name));
  const n8nFns = new Map(files.map((f) => [f.rel, names(f.rel, (s) => fetches.get(f.rel).some((c) => c.index > s.start && c.index < s.end))]));
  const verifyFns = new Map(files.map((f) => [f.rel, names(f.rel, (s) => /timingSafeEqual\s*\(/.test(f.bare.slice(s.start, s.end)))]));
  const imports = new Map(files.map((f) => [f.rel, importsOf(f).map((i) => ({ ...i, rel: resolveSpec(f.rel, i.spec, byRel) }))]));
  // Local names through which a file reaches n8n: anything from lib/n8n/*, or a function of
  // another module that itself calls n8n.
  const n8nImportNames = (f) =>
    imports
      .get(f.rel)
      .filter((i) => (i.rel ? inN8nLib(i.rel) || (i.imported === "*" ? n8nFns.get(i.rel).size > 0 : n8nFns.get(i.rel).has(i.imported)) : /(^|\/)lib\/n8n(\/|$)/.test(i.spec)))
      .map((i) => i.local);
  // A callback route is where n8n reports back: app/api/n8n/**, a route reading x-n8n-signature,
  // or a POST route that mentions n8n (code or comments) and does not call n8n itself.
  const callbacks = files.filter(
    (f) => isRoute(f) && (/^(src\/)?app\/api\/n8n\//.test(f.rel) || /x-n8n-signature/i.test(f.code) || (/n8n/i.test(f.src) && hasPostHandler(f) && !fetches.get(f.rel).length)),
  );
  // The file plus the local modules it imports directly (helpers for signatures, keys, time).
  const related = (f) => [...new Set([f, ...imports.get(f.rel).map((i) => i.rel && byRel.get(i.rel)).filter(Boolean)])];
  return { fetches, n8nFns, verifyFns, imports, n8nImportNames, callbacks, related };
}

// Positions where a file calls n8n: fetch to n8n or a function that reaches n8n.
function n8nCalls(file, m) {
  const calls = m.fetches.get(file.rel).map((c) => c.index);
  for (const name of m.n8nImportNames(file)) {
    const re = new RegExp(`(?<![\\w$.])${escapeRe(name)}(?:\\.[\\w$]+)?\\s*\\(`, "g");
    for (const mm of file.bare.matchAll(re)) calls.push(mm.index);
  }
  return calls;
}

// Where the signature is verified inside the request handler (first call of timingSafeEqual or
// of a local or imported helper that calls it), and where the handler starts.
function verification(file, m) {
  const handler = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH)\b|export\s+const\s+(?:POST|PUT|PATCH)\s*=/.exec(file.bare);
  const start = handler ? handler.index : 0;
  const names = new Set(["timingSafeEqual", ...m.verifyFns.get(file.rel)]);
  for (const i of m.imports.get(file.rel)) if (i.rel && m.verifyFns.get(i.rel).has(i.imported)) names.add(i.local);
  let first = Infinity;
  for (const name of names)
    for (const mm of file.bare.matchAll(new RegExp(`(?<![\\w$.])${escapeRe(name)}\\s*\\(`, "g")))
      if (mm.index >= start && !/function\s+$/.test(file.bare.slice(Math.max(0, mm.index - 20), mm.index))) first = Math.min(first, mm.index);
  return { start, first };
}

function comparesSignature(lineCode, lineBare) {
  const re = /([\w$.\])]+)\s*(===|!==|==|!=)\s*([\w$.("'`[]+)/g;
  const secretish = /sig(?!nal)|hmac|digest/i;
  for (const m of lineBare.matchAll(re)) {
    const left = lineCode.slice(m.index, m.index + m[1].length);
    const right = lineCode.slice(m.index + m[0].length - m[3].length, m.index + m[0].length);
    const before = lineCode.slice(0, m.index);
    if (!secretish.test(left) && !secretish.test(right)) continue;
    if (/\.(length|byteLength)$/.test(left) || /^[\w$.]*\.(length|byteLength)\b/.test(right)) continue; // length pre-check is fine
    if (/typeof\s*$/.test(before)) continue;
    if (/^["'`]|^(null|undefined|true|false)\b/.test(right)) continue;
    return true;
  }
  return false;
}

// console.* arguments with object keys and harmless expressions (lengths, hashes) removed.
function loggedValues(argsBare) {
  return argsBare
    .replace(/([{,]\s*)[\w$]+\s*:/g, "$1")
    .replace(/Buffer\.byteLength\s*\([^)]*\)/g, " ")
    .replace(/\b[\w$.]+\.(?:length|byteLength)\b/g, " ")
    .replace(/createHash\s*\([^)]*\)(?:\s*\.\s*update\s*\([^)]*\))?(?:\s*\.\s*digest\s*\([^)]*\))?/g, " ")
    .replace(/\bsha256\s*\([^)]*\)/g, " ");
}
const SENSITIVE_LOG =
  /\b(token|secret|signature|sig|raw|rawBody|body|payload|formData|email|phone|headers|password|ipAddress|userAgent|fullName)\b|\bdata\b(?!\s*\.)|N8N_\w+|process\.env|\.(text|json)\s*\(\s*\)|JSON\.stringify/i;

// ---------- checks ----------

function runChecks(files, envExample) {
  const results = [];
  const add = (id, title, findings, note) => {
    const seen = new Set();
    const unique = findings.filter((f) => {
      const key = `${f.file}:${f.line}:${f.fileLevel ? f.text : ""}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
    results.push({ id, title, findings: unique, note });
  };
  const at = (file, index, fileLevel = false) => ({ file: file.rel, line: file.line(index), text: file.snippet(file.line(index)), fileLevel });
  const whole = (file, text) => ({ file: file.rel, line: 1, text, fileLevel: true });

  const model = buildModel(files);
  const fetchesByFile = model.fetches;
  const n8nFiles = files.filter((f) => fetchesByFile.get(f.rel).length || inN8nLib(f.rel));
  const callbacks = model.callbacks;
  const isCallback = (f) => callbacks.includes(f);
  const callers = files.filter((f) => model.n8nImportNames(f).length);

  // C1
  {
    const findings = [];
    for (const f of files) for (const m of f.code.matchAll(/\/webhook-test\b/g)) findings.push(at(f, m.index));
    if (envExample)
      envExample.lines.forEach((l, k) => {
        if (!l.trim().startsWith("#") && /\/webhook-test\b/.test(l)) findings.push({ file: ".env.example", line: k + 1, text: envText(l) });
      });
    add("C1", "Тестовий URL вебхука (/webhook-test/) у коді чи .env.example", findings);
  }
  // C2
  {
    const findings = [];
    for (const f of files) for (const m of f.code.matchAll(/NEXT_PUBLIC_N8N\w*/g)) findings.push(at(f, m.index));
    if (envExample)
      envExample.lines.forEach((l, k) => {
        if (/NEXT_PUBLIC_N8N/.test(l)) findings.push({ file: ".env.example", line: k + 1, text: envText(l) });
      });
    add("C2", "Змінні N8N_* з префіксом NEXT_PUBLIC_", findings);
  }
  // C3
  {
    const findings = [];
    for (const f of files) {
      if (inN8nLib(f.rel)) continue;
      for (const call of fetchesByFile.get(f.rel)) findings.push(at(f, call.index));
      for (const m of f.code.matchAll(/process\.env(?:\.|\[\s*["'])(N8N_\w+)/g)) {
        const allowedInCallback = m[1] === "N8N_CALLBACK_SECRET" && isCallback(f);
        if (!allowedInCallback) findings.push(at(f, m.index));
      }
    }
    add("C3", "Виклики n8n і змінні N8N_* лише в lib/n8n/", findings);
  }
  // C4
  {
    const findings = [];
    const runtime = /\bexport\s+(?:default\b|(?:async\s+)?function\b|const\b|let\b|class\b)|\bfetch\s*\(|process\.env|node:crypto/;
    // lib/n8n/ modules with runtime code, and any other module that calls n8n (routes and
    // "use server" files are server-only by themselves).
    const targets = files.filter(
      (f) => (inN8nLib(f.rel) && runtime.test(f.bare)) || (fetchesByFile.get(f.rel).length && !isRoute(f) && !isServerActionFile(f)),
    );
    for (const f of targets) {
      const first = f.code.search(/\S/);
      if (!/^import\s+["']server-only["']/.test(f.code.slice(first))) findings.push({ ...at(f, Math.max(first, 0), true), text: 'перший рядок не import "server-only"' });
    }
    add("C4", 'Модулі, що викликають n8n, починаються з import "server-only"', findings, targets.length ? null : "немає модулів n8n");
  }
  // C5
  {
    const findings = [];
    for (const f of files)
      for (const call of fetchesByFile.get(f.rel)) {
        const direct = /AbortSignal\.timeout\s*\(/.test(call.args);
        const viaVariable = /\bsignal\b/.test(call.args) && /AbortSignal\.timeout\s*\(/.test(f.code);
        if (!direct && !viaVariable) findings.push({ ...at(f, call.index), text: `${f.snippet(f.line(call.index))}  ← немає signal: AbortSignal.timeout(…)` });
      }
    const total = [...fetchesByFile.values()].reduce((s, v) => s + v.length, 0);
    add("C5", "fetch до n8n з таймаутом (signal: AbortSignal.timeout)", findings, total ? null : "викликів n8n немає");
  }
  // C6
  {
    const findings = [];
    const n8nLibCode = files.filter((f) => inN8nLib(f.rel)).map((f) => f.code).join("\n");
    for (const f of files) {
      const calls = fetchesByFile.get(f.rel);
      if (!calls.length) continue;
      const source = inN8nLib(f.rel) ? n8nLibCode : f.code;
      // A header counts only where it is set: an object key, headers.set/append(...) or headers[...] = ...
      const sets = (h) =>
        new RegExp(`(["'\`])${h}\\1\\s*:|\\.(?:set|append)\\(\\s*(["'\`])${h}\\2|\\[\\s*(["'\`])${h}\\3\\s*\\]\\s*=`, "i").test(source);
      const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter((h) => !sets(h));
      if (missing.length) findings.push({ ...at(f, calls[0].index), text: `заголовки не передаються: ${missing.join(", ")}` });
    }
    add("C6", "Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n", findings, n8nFiles.length ? null : "викликів n8n немає");
  }
  // C7
  {
    const findings = [];
    for (const f of callbacks) {
      const { start, first } = verification(f, model);
      for (const m of f.bare.matchAll(/\.json\s*\(\s*\)/g)) findings.push({ ...at(f, m.index), text: `${f.snippet(f.line(m.index))}  ← .json() замість request.text()` });
      for (const m of f.bare.matchAll(/JSON\.parse\s*\(/g))
        if (m.index >= start && m.index < first) findings.push({ ...at(f, m.index), text: `${f.snippet(f.line(m.index))}  ← JSON.parse до перевірки підпису` });
      if (!/\.text\s*\(\s*\)/.test(f.bare)) findings.push(whole(f, "немає request.text() — сире тіло не читається"));
    }
    add("C7", "Колбек читає сире тіло й не парсить JSON до перевірки підпису", findings, callbacks.length ? null : "колбек-роутів немає");
  }
  // C8
  {
    const findings = [];
    const scanned = new Set();
    for (const f of callbacks) {
      // The route and the helpers it imports: verification may live in e.g. lib/n8n/signature.ts.
      const rel = model.related(f);
      if (!rel.some((r) => /timingSafeEqual\s*\(/.test(r.bare))) findings.push(whole(f, "немає crypto.timingSafeEqual"));
      if (!rel.some((r) => /x-n8n-signature/i.test(r.code)) || !rel.some((r) => /createHmac\s*\(/.test(r.bare)))
        findings.push(whole(f, "немає перевірки підпису x-n8n-signature (HMAC-SHA256 від timestamp.rawBody)"));
      for (const r of rel) {
        if (scanned.has(r.rel)) continue;
        scanned.add(r.rel);
        const codeLines = r.code.split("\n");
        const bareLines = r.bare.split("\n");
        bareLines.forEach((lb, k) => {
          if (comparesSignature(codeLines[k], lb)) findings.push({ file: r.rel, line: k + 1, text: `${r.snippet(k + 1)}  ← підпис через ===/==` });
          if (/\.equals\s*\(|Buffer\.compare\s*\(/.test(lb) && /sig(?!nal)|hmac|digest|expected/i.test(codeLines[k]))
            findings.push({ file: r.rel, line: k + 1, text: `${r.snippet(k + 1)}  ← .equals()/Buffer.compare не сталого часу` });
          // timingSafeEqual throws on different lengths: the lengths are compared first (same or previous 3 lines).
          if (/timingSafeEqual\s*\(/.test(lb) && !/import\b/.test(lb) && !LENGTH_CHECK.test(bareLines.slice(Math.max(0, k - 3), k + 1).join("\n")))
            findings.push({ file: r.rel, line: k + 1, text: `${r.snippet(k + 1)}  ← немає перевірки довжини перед timingSafeEqual` });
        });
      }
    }
    add("C8", "Підпис: спершу довжини, потім timingSafeEqual; не ===", findings, callbacks.length ? null : "колбек-роутів немає");
  }
  // C9
  {
    const findings = [];
    // The 300 s window in one file: a literal or a constant holding it, next to Date.now() (±3 lines).
    const comparesWindow = (r) => {
      const bareLines = r.bare.split("\n");
      const windowNames = [...r.bare.matchAll(/(?:const|let)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:300|300_000|300000|5\s*\*\s*60(?:\s*\*\s*1000)?)\b/g)].map((m) => m[1]);
      const mentionsWindow = (text) => WINDOW_LITERAL.test(text) || windowNames.some((n) => new RegExp(`(?<![\\w$])${escapeRe(n)}(?![\\w$])`).test(text));
      return bareLines.some(
        (l, k) => /Date\.now\s*\(\s*\)/.test(l) && bareLines.slice(Math.max(0, k - 3), k + 4).some((near) => mentionsWindow(near) && !/(?:const|let)\s+[\w$]+\s*(?::[^=]+)?=\s*[\d_ *]+;?\s*$/.test(near.trim())),
      );
    };
    for (const f of callbacks) {
      const rel = model.related(f);
      const lower = rel.map((r) => r.code.toLowerCase()).join("\n");
      const missing = [];
      if (!lower.includes("x-n8n-timestamp")) missing.push("x-n8n-timestamp");
      if (!rel.some(comparesWindow)) missing.push("порівняння з Date.now() у вікні 300 с");
      if (!lower.includes("idempotency-key")) missing.push("idempotency-key");
      if (!rel.some((r) => /\bjobId\b/.test(r.bare))) missing.push("звірка ключа з data.jobId");
      if (missing.length) findings.push(whole(f, `немає: ${missing.join(", ")}`));
    }
    add("C9", "Колбек перевіряє час (±300 с) і idempotency-key", findings, callbacks.length ? null : "колбек-роутів немає");
  }
  // C10
  {
    const findings = [];
    for (const f of files) for (const m of f.code.matchAll(/export\s+const\s+runtime\s*=\s*["']edge["']/g)) findings.push(at(f, m.index));
    add("C10", 'Немає runtime = "edge"', findings);
  }
  // C11
  {
    const findings = [];
    if (!envExample) {
      findings.push({ file: ".env.example", line: 0, text: "файлу немає", fileLevel: true });
    } else {
      const vars = new Map();
      envExample.lines.forEach((l, k) => {
        const m = /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(l);
        if (m && !l.trim().startsWith("#")) vars.set(m[1], { value: m[2].trim().replace(/^["']|["']$/g, ""), line: k + 1, text: envText(l) });
      });
      const need = (name, test, why) => {
        const v = vars.get(name);
        if (!v) findings.push({ file: ".env.example", line: 0, text: `немає ${name}`, fileLevel: true });
        else if (!test(v.value)) findings.push({ file: ".env.example", line: v.line, text: `${v.text}  ← ${why}` });
      };
      const placeholder = (v) => /^change-me-/.test(v);
      need("N8N_WEBHOOK_BASE_URL", (v) => LOCAL_URL.test(v) && /\/webhook\/?$/.test(v), "локальна адреса, що закінчується на /webhook (http://127.0.0.1:5678/webhook)");
      need("N8N_WEBHOOK_TOKEN", placeholder, "секрет у прикладі — лише change-me-…");
      need("N8N_CALLBACK_SECRET", placeholder, "секрет у прикладі — лише change-me-…");
      need("APP_BASE_URL", (v) => LOCAL_URL.test(v) && /^http:\/\/[^/]+\/?$/.test(v), "локальна адреса застосунку (http://127.0.0.1:3000)");
      for (const [name, v] of vars)
        if (SECRET_NAME.test(name) && !["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"].includes(name) && v.value && !placeholder(v.value))
          findings.push({ file: ".env.example", line: v.line, text: `${v.text}  ← секрет у прикладі — лише change-me-…` });
    }
    add("C11", ".env.example з ключами контракту (секрети — change-me-…, адреси локальні)", findings);
  }
  // C12
  {
    const findings = [];
    for (const f of [...new Set([...n8nFiles, ...callbacks, ...callers])]) {
      for (const m of f.bare.matchAll(/\bconsole\.(log|info|warn|error|debug)\s*\(/g)) {
        const open = m.index + m[0].length - 1;
        if (SENSITIVE_LOG.test(loggedValues(f.bare.slice(open + 1, closing(f, open)))))
          // A string that looks like a token is not reprinted.
          findings.push({ ...at(f, m.index), text: f.snippet(f.line(m.index)).replace(/(["'`])[^"'`\s]{16,}\1/g, "$1<приховано>$1") });
      }
    }
    add("C12", "Журнали коду n8n без тіл, секретів і персональних даних", findings, n8nFiles.length || callbacks.length || callers.length ? null : "коду n8n немає");
  }
  // C13
  {
    const findings = [];
    const actionFiles = files.filter(isServerActionFile);
    for (const f of actionFiles) {
      const afterSpans = [...f.bare.matchAll(/(?<![\w$.])after\s*\(/g)].map((m) => {
        const open = m.index + m[0].length - 1;
        return [open, closing(f, open)];
      });
      for (const index of n8nCalls(f, model))
        if (!afterSpans.some(([s, e]) => index > s && index < e))
          findings.push({ ...at(f, index), text: `${f.snippet(f.line(index))}  ← виклик n8n поза after(): користувач чекає на n8n` });
    }
    const relevant = actionFiles.some((f) => n8nCalls(f, model).length);
    add("C13", "Server Action не чекає на n8n: виклик лише в after()", findings, relevant ? null : "Server Actions не викликають n8n");
  }
  return results;
}

// ---------- main ----------

const args = parseArgs(process.argv.slice(2));
const changed = args.since ? changedLines(args.root, args.since) : null;
const files = walk(args.root, args.root).map((rel) => loadFile(args.root, rel));
const envPath = join(args.root, ".env.example");
const envExample = existsSync(envPath) ? { lines: readFileSync(envPath, "utf8").split(/\r?\n/) } : null;

const keep = (finding) => {
  if (!changed) return true;
  const lines = changed.get(finding.file);
  if (!lines) return false;
  if (lines === "all" || finding.fileLevel || finding.line === 0) return true;
  return lines.has(finding.line);
};

const shownRoot = (relative(process.cwd(), args.root) || ".").split(sep).join("/");
console.log(`check-contract · root=${shownRoot}${changed ? ` · changed since ${args.since} (${changed.size} file(s))` : " · whole project"}`);
const results = runChecks(files, envExample);
let failed = 0;
for (const r of results) {
  const findings = r.findings.filter(keep);
  if (findings.length) {
    failed++;
    console.log(`${r.id.padEnd(4)} FAIL  ${r.title}`);
    for (const f of findings) console.log(`         ${f.file}${f.line ? `:${f.line}` : ""}  ${f.text}`);
  } else {
    console.log(`${r.id.padEnd(4)} PASS  ${r.title}${r.note ? `  (${r.note})` : ""}`);
  }
}
console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
