#!/usr/bin/env node
// check-contract — static check of the team's Next.js <-> n8n contract (checks C1-C10).
//
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs            # project = cwd
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root <dir>
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --json
//
// Exit code: 0 = no failures, 1 = at least one FAIL, 2 = usage error.
// Static only: reads source files (app/, lib/, components/, src/ and root proxy/middleware/
// instrumentation/next.config files), .env.example and .gitignore. It never reads .env.local
// or any other real env file and never prints values - only file:line and a short reason.
// Zero dependencies (node: built-ins only).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const HELP = `check-contract: static check of the Next.js <-> n8n contract (C1-C10)

Usage: node check-contract.mjs [--root <project dir>] [--json]

  C1  no /webhook-test/ URL in code or .env.example
  C2  no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
  C3  n8n is called only from lib/n8n/*, which starts with import 'server-only'
  C4  callback route reads the raw body and parses only after verifying the signature
  C5  signature compared with a length check + timingSafeEqual, never === / !==
  C6  every fetch to n8n has signal (AbortSignal.timeout)
  C7  no request/response bodies, payloads or headers in console.* in n8n code
  C8  no runtime = 'edge'
  C9  .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
  C10 every call to n8n sends an idempotency-key header
`;

let args;
try {
  args = parseArgs({
    options: { root: { type: "string" }, json: { type: "boolean", default: false }, help: { type: "boolean", short: "h", default: false } },
    strict: true,
  }).values;
} catch (error) {
  console.error(`check-contract: ${error.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const root = resolve(args.root ?? process.cwd());
if (!existsSync(join(root, "package.json"))) {
  console.error(`check-contract: ${root} has no package.json - pass --root <project dir>`);
  process.exit(2);
}

const CODE_DIRS = ["app", "lib", "components", "src"];
const ROOT_FILES = /^(proxy|middleware|instrumentation|next\.config)\.(ts|tsx|js|jsx|mjs|cjs)$/;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage"]);
const ENV_KEYS = ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"];
const SECRET_KEYS = ["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"];

const toPosix = (p) => p.split(sep).join("/");
const readText = (file) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (CODE_EXT.test(entry.name)) files.push(full);
  }
  return files;
}

// Blank out comments (keep newlines so line numbers stay right). String contents are kept.
function blankComments(code) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Replace string literal contents with spaces but keep ${...} expressions of template literals.
function codeOnly(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < text.length && text[i] !== c && text[i] !== "\n") {
        if (text[i] === "\\") {
          out += " ";
          i++;
        }
        out += " ";
        i++;
      }
      out += text[i] ?? "";
      i++;
      continue;
    }
    if (c === "`") {
      out += c;
      i++;
      while (i < text.length && text[i] !== "`") {
        if (text[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          let depth = 0;
          while (i < text.length) {
            if (text[i] === "{") depth++;
            if (text[i] === "}") {
              depth--;
              if (depth === 0) {
                out += "}";
                i++;
                break;
              }
            }
            out += text[i];
            i++;
          }
          continue;
        }
        out += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += text[i] ?? "";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Text of the argument list of a call whose "(" is at openIndex (paren matching, strings aware).
function callArgs(code, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return code.slice(openIndex + 1, i);
    }
  }
  return code.slice(openIndex + 1);
}

const lineOf = (code, index) => code.slice(0, index).split("\n").length;

// ---------------------------------------------------------------------------------------------
// Collect files
// ---------------------------------------------------------------------------------------------

const files = [
  ...CODE_DIRS.flatMap((d) => walk(join(root, d))),
  ...readdirSync(root).filter((name) => ROOT_FILES.test(name) && statSync(join(root, name)).isFile()).map((name) => join(root, name)),
].map((full) => {
  const raw = readText(full);
  const code = blankComments(raw);
  return { full, rel: toPosix(relative(root, full)), raw, code };
});
const byFull = new Map(files.map((f) => [f.full, f]));

const envExamplePath = join(root, ".env.example");
const envExample = existsSync(envExamplePath)
  ? readText(envExamplePath)
      .split("\n")
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter(({ text }) => text.trim() && !text.trim().startsWith("#"))
  : null;

const isClientComponent = (f) => /^\s*["']use client["']/.test(f.code.replace(/^\s+/, ""));
const inN8nLib = (f) => /(^|\/)lib\/n8n\//.test(f.rel);
const readsN8nEnv = (f) => /process\.env\.(NEXT_PUBLIC_)?N8N_|process\.env\[\s*["'](NEXT_PUBLIC_)?N8N_/.test(f.code);
const mentionsWebhookUrl = (f) => /\/webhook(-test)?\//.test(f.code);
const hasFetch = (f) => /\bfetch\s*\(/.test(f.code);

// Files that call n8n: they fetch and either live in lib/n8n/, read N8N_* env or contain a webhook URL.
const outboundFiles = files.filter((f) => hasFetch(f) && (inN8nLib(f) || readsN8nEnv(f) || mentionsWebhookUrl(f)));

// Callback routes: route handlers whose path or source mentions n8n, callback, webhook or a signature.
const callbackRoutes = files.filter(
  (f) =>
    /(^|\/)app\/.*\/route\.(ts|js|mjs)$/.test(f.rel) &&
    (/n8n|callback|webhook/i.test(f.rel) || /n8n|x-n8n-signature|callback|webhook|signature/i.test(f.raw)),
);

// Local modules a file imports (@/..., ./..., ../...), resolved to scanned files.
function localImports(f) {
  const out = [];
  for (const m of f.code.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] ?? m[2];
    let base;
    if (spec.startsWith("@/")) base = join(root, spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(f.full), spec);
    else continue;
    for (const candidate of [base, ...[".ts", ".tsx", ".js", ".mjs"].map((e) => base + e), ...["index.ts", "index.js"].map((e) => join(base, e))]) {
      if (byFull.has(candidate)) {
        out.push(byFull.get(candidate));
        break;
      }
    }
  }
  return out;
}

// A callback "unit" = the route + local modules it imports that do the crypto (verification helpers).
const callbackUnits = callbackRoutes.map((route) => {
  const helpers = localImports(route).filter((m) => /timingSafeEqual|createHmac/.test(m.code));
  return { route, helpers, all: [route, ...helpers] };
});

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

const results = [];
function check(id, title, run) {
  const findings = [];
  let note = "";
  run(
    (file, line, reason) => findings.push({ where: line ? `${file}:${line}` : file, reason }),
    (text) => (note = text),
  );
  results.push({ id, title, status: findings.length ? "FAIL" : "PASS", note, findings });
}

check("C1", "no /webhook-test/ URL in code or .env.example", (fail) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/\/webhook-test\//g)) fail(f.rel, lineOf(f.code, m.index), "test URL works only 120 s after 'Listen for test event'; use the production /webhook/ URL");
  }
  for (const { line, text } of envExample ?? []) {
    if (/\/webhook-test\//.test(text)) fail(".env.example", line, `${text.split("=")[0].trim()} points at a /webhook-test/ URL`);
  }
});

check("C2", "no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components", (fail) => {
  const publicN8n = /NEXT_PUBLIC_\w*(N8N|WEBHOOK|CALLBACK_SECRET)\w*/g;
  for (const f of files) {
    for (const m of f.code.matchAll(publicN8n)) fail(f.rel, lineOf(f.code, m.index), `${m[0]}: NEXT_PUBLIC_ variables are inlined into the browser bundle`);
    if (isClientComponent(f)) {
      for (const m of f.code.matchAll(/process\.env\.N8N_\w+/g)) fail(f.rel, lineOf(f.code, m.index), `${m[0]} in a 'use client' file`);
    }
  }
  for (const { line, text } of envExample ?? []) {
    const key = text.split("=")[0].trim();
    if (/^NEXT_PUBLIC_\w*(N8N|WEBHOOK|CALLBACK_SECRET)/.test(key)) fail(".env.example", line, `${key}: n8n settings are server-only`);
  }
});

check("C3", "n8n is called only from lib/n8n/*, which starts with import 'server-only'", (fail, note) => {
  const libFiles = files.filter((f) => inN8nLib(f) && (hasFetch(f) || readsN8nEnv(f)));
  if (!outboundFiles.length && !libFiles.length) note("n/a: no calls to n8n found");
  for (const f of outboundFiles) {
    if (!inN8nLib(f)) {
      const m = /\bfetch\s*\(/.exec(f.code);
      fail(f.rel, lineOf(f.code, m.index), "fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)");
    }
  }
  for (const f of libFiles) {
    const firstStatement = f.code.replace(/^\s+/, "").split("\n")[0];
    if (!/^import\s+["']server-only["']/.test(firstStatement)) fail(f.rel, 1, "first statement must be import 'server-only'");
  }
});

check("C4", "callback route reads the raw body; parses only after the signature check", (fail, note) => {
  if (!callbackUnits.length) note("n/a: no callback route found (app/**/route.ts mentioning n8n/callback/webhook/signature)");
  for (const { route, helpers, all } of callbackUnits) {
    const param = /export\s+(?:async\s+)?function\s+POST\s*\(\s*(\w+)/.exec(route.code)?.[1];
    for (const f of all) {
      const names = ["req", "request", ...(param ? [param] : [])].join("|");
      for (const m of f.code.matchAll(new RegExp(`\\b(${names})\\s*\\.\\s*(json|formData)\\s*\\(\\s*\\)`, "g"))) {
        fail(f.rel, lineOf(f.code, m.index), `${m[0]} parses/re-serialises the body: read it once with .text() or .arrayBuffer()`);
      }
    }
    // Order inside the route: first JSON.parse must come after the first verification step.
    const helperNames = helpers.flatMap((h) =>
      [...route.code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
        .filter((m) => localImports({ ...route, code: m[0] }).some((x) => x.full === h.full))
        .flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop())),
    );
    const verifyPatterns = [/\btimingSafeEqual\s*\(/, ...helperNames.filter(Boolean).map((n) => new RegExp(`\\b${n}\\s*\\(`))];
    const verifyIdx = Math.min(...verifyPatterns.map((p) => p.exec(route.code)?.index ?? Infinity));
    const parse = /\bJSON\.parse\s*\(/.exec(route.code);
    if (parse && parse.index < verifyIdx) {
      fail(route.rel, lineOf(route.code, parse.index), "JSON.parse before the signature is verified");
    }
    for (const h of helpers) {
      const p = /\bJSON\.parse\s*\(/.exec(h.code);
      const v = /\btimingSafeEqual\s*\(/.exec(h.code);
      if (p && (!v || p.index < v.index)) fail(h.rel, lineOf(h.code, p.index), "JSON.parse before timingSafeEqual");
    }
  }
});

check("C5", "signature: length check + timingSafeEqual, never === / !==", (fail, note) => {
  if (!callbackUnits.length) note("n/a: no callback route found");
  for (const { route, all } of callbackUnits) {
    const text = all.map((f) => f.code).join("\n");
    if (!/\btimingSafeEqual\s*\(/.test(text)) fail(route.rel, null, "no crypto.timingSafeEqual (in the route or the helpers it imports)");
    else if (!/\.(byteLength|length)\s*!==|\.(byteLength|length)\s*===|!==\s*\w+\.(byteLength|length)\b/.test(text)) {
      fail(route.rel, null, "no length check before timingSafeEqual (it throws on different lengths)");
    }
    for (const f of all) {
      const code = codeOnly(f.code);
      const cmp = /(?<![.\w])\w*(?:signature|digest|hmac)\w*\s*[!=]==(?!\s*(?:null|undefined)\b)|[!=]==\s*\w*(?:signature|digest|hmac)\w*\b(?!\s*\.\s*(?:length|byteLength))/gi;
      for (const m of code.matchAll(cmp)) fail(f.rel, lineOf(code, m.index), `'${m[0].trim()}': compare signatures with timingSafeEqual`);
    }
  }
});

check("C6", "every fetch to n8n has signal: AbortSignal.timeout(...)", (fail, note) => {
  if (!outboundFiles.length) note("n/a: no calls to n8n found");
  for (const f of outboundFiles) {
    for (const m of f.code.matchAll(/\bfetch\s*\(/g)) {
      const argsText = callArgs(f.code, m.index + m[0].length - 1);
      if (!/\bsignal\b/.test(argsText)) fail(f.rel, lineOf(f.code, m.index), "fetch without signal: add AbortSignal.timeout(10_000)");
    }
  }
});

check("C7", "no bodies, payloads or headers in console.* in n8n code", (fail) => {
  const n8nFiles = new Set([...outboundFiles, ...callbackUnits.flatMap((u) => u.all), ...files.filter(inN8nLib)]);
  const leaky = /\b(raw|rawBody|body|payload|envelope|formData|headers|text)\b(?!\s*\.\s*(length|byteLength)\b)|JSON\.stringify\s*\(|[,(]\s*(data|lead|quote|input|values|result|request|req)\s*[,)]/;
  for (const f of n8nFiles) {
    for (const m of f.code.matchAll(/\bconsole\s*\.\s*(log|info|warn|error|debug)\s*\(/g)) {
      const argsText = codeOnly(callArgs(f.code, m.index + m[0].length - 1)).replace(/\b(sha256|hash|digest|byteLength)\s*\([^)]*\)/g, "");
      const hit = leaky.exec(argsText);
      if (hit) fail(f.rel, lineOf(f.code, m.index), `console.${m[1]} logs '${hit[0].replace(/[,()\s]/g, "")}': log event, status, duration, correlation id, body length + sha256 only`);
    }
  }
});

check("C8", "no runtime = 'edge'", (fail) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/\bruntime\s*[:=]\s*["']edge["']/g)) fail(f.rel, lineOf(f.code, m.index), "edge runtime is deprecated in Next.js 16 and has no node:crypto");
  }
});

check("C9", ".env.example has the contract keys with placeholder secrets; .env.local is git-ignored", (fail) => {
  if (!envExample) {
    fail(".env.example", null, "missing: commit an .env.example with the contract keys");
  } else {
    const entries = new Map(envExample.map(({ line, text }) => [text.split("=")[0].trim(), { line, value: text.slice(text.indexOf("=") + 1).trim() }]));
    for (const key of ENV_KEYS) if (!entries.has(key)) fail(".env.example", null, `key ${key} is missing`);
    for (const key of SECRET_KEYS) {
      const e = entries.get(key);
      if (e && e.value && !/^["']?change-me/.test(e.value)) fail(".env.example", e.line, `${key} must be a change-me-... placeholder, not a real secret`);
    }
    const base = entries.get("N8N_WEBHOOK_BASE_URL");
    if (base && base.value && !/\/webhook\/?["']?$/.test(base.value)) fail(".env.example", base.line, "N8N_WEBHOOK_BASE_URL must end with /webhook");
  }
  const gitignorePath = join(root, ".gitignore");
  const rules = existsSync(gitignorePath) ? readText(gitignorePath).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
  const ignoresLocal = rules.some((r) => /^\/?(\.env\*|\.env\.local|\.env\*\.local|\*\.local|\.env\.\*)$/.test(r));
  if (!ignoresLocal) fail(".gitignore", null, ".env.local is not ignored (add .env* or .env*.local)");
  const ignoresAllEnv = rules.some((r) => /^\/?\.env\*$/.test(r));
  if (ignoresAllEnv && envExample && !rules.some((r) => /^!\/?\.env\.example$/.test(r))) fail(".gitignore", null, ".env* also ignores .env.example: add !.env.example");
});

check("C10", "every call to n8n sends an idempotency-key header", (fail, note) => {
  if (!outboundFiles.length) note("n/a: no calls to n8n found");
  for (const f of outboundFiles) {
    if (!/["']idempotency-key["']/i.test(f.code)) {
      const m = /\bfetch\s*\(/.exec(f.code);
      fail(f.rel, lineOf(f.code, m.index), "no idempotency-key header (UUID created once per operation, reused on retries)");
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const failed = results.filter((r) => r.status === "FAIL");
if (args.json) {
  console.log(JSON.stringify({ root: toPosix(root), failed: failed.length, passed: results.length - failed.length, results }, null, 2));
} else {
  console.log(`check-contract (integrating-n8n-webhooks) - ${toPosix(root)}`);
  console.log(`scanned ${files.length} source files; n8n callers: ${outboundFiles.map((f) => f.rel).join(", ") || "none"}; callback routes: ${callbackRoutes.map((f) => f.rel).join(", ") || "none"}\n`);
  for (const r of results) {
    console.log(`${r.id.padEnd(3)} ${r.status}  ${r.title}${r.note ? `  (${r.note})` : ""}`);
    for (const f of r.findings) console.log(`      ${f.where}  ${f.reason}`);
  }
  console.log(`\n${failed.length} failed, ${results.length - failed.length} passed (${results.length} checks)`);
}
process.exitCode = failed.length ? 1 : 0;
