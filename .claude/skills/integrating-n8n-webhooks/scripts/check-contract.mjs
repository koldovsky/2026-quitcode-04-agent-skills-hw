#!/usr/bin/env node
// check-contract — static check of the team's Next.js <-> n8n contract (checks C1-C10).
//
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs            # project = cwd
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root <dir>
//   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --json
//
// Exit code: 0 = no failures, 1 = at least one FAIL, 2 = usage error.
// A check whose subject does not exist in the project (no call to n8n, no callback route)
// reports N/A, never PASS: "everything is green" must not mean "nothing was looked at".
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
  C10 every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL

A check with nothing to look at (no n8n call, no callback route) prints N/A, not PASS.
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
const SECRET_IN_URL = /[?&]\s*(token|secret|key|apikey|api_key|access_token|auth|signature)\s*=/i;

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

// Text from `start` up to where its brackets close (or the first top-level ";" / newline):
// enough to capture an object literal, a call or a function body.
function balancedFrom(code, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return code.slice(start, i);
      depth--;
    } else if ((c === ";" || c === "\n") && depth === 0) return code.slice(start, i);
  }
  return code.slice(start);
}

// `const <name> = <this>` in the same file: lets a check follow `fetch(url, init)`.
function initializerOf(code, name) {
  const m = new RegExp(String.raw`\b(?:const|let|var)\s+${name}\b[^=;\n]*=\s*`).exec(code);
  return m ? balancedFrom(code, m.index + m[0].length) : null;
}

// Signature + body of `export function name(...)` / `export const name = ...` in a module.
function declarationText(file, name) {
  const fn = new RegExp(String.raw`\bexport\s+(?:async\s+)?function\s+${name}\s*\(`).exec(file.code);
  if (fn) return balancedFrom(file.code, fn.index + fn[0].length - 1);
  const con = new RegExp(String.raw`\bexport\s+(?:const|let|var)\s+${name}\b[^=;\n]*=\s*`).exec(file.code);
  return con ? balancedFrom(file.code, con.index + con[0].length) : null;
}

// Identifiers passed as a whole argument: fetch(url, init), fetch(url, { ...init }).
const argIdentifiers = (argsText) =>
  [...argsText.matchAll(/(?:^|,)\s*(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/g)].map((m) => m[1]);

// First argument of a call (top-level comma; strings and brackets aware).
function firstArgument(argsText) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < argsText.length; i++) {
    const c = argsText[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) return argsText.slice(0, i);
  }
  return argsText;
}

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
// N8N_*, but also the names agents invent for the same thing (WEBHOOK_URL, QUOTE_WORKFLOW_URL).
const N8N_ENV = /process\.env\.(?:NEXT_PUBLIC_)?\w*(?:N8N|WEBHOOK|WORKFLOW)\w*|process\.env\[\s*["'](?:NEXT_PUBLIC_)?\w*(?:N8N|WEBHOOK|WORKFLOW)/;
const readsN8nEnv = (f) => N8N_ENV.test(f.code);
const mentionsWebhookUrl = (f) => /\/webhook(-test)?\//.test(f.code);
const hasFetch = (f) => /\bfetch\s*\(/.test(f.code);

// Local modules a file imports (@/..., ./..., ../...), with the names it binds from them.
function localImportBindings(f) {
  const out = [];
  for (const m of f.code.matchAll(/\bimport\s+([^;]*?)\s*from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[2] ?? m[3];
    const clause = m[1] ?? "";
    let base;
    if (spec.startsWith("@/")) base = join(root, spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(f.full), spec);
    else continue;
    let target;
    for (const candidate of [base, ...[".ts", ".tsx", ".js", ".mjs"].map((e) => base + e), ...["index.ts", "index.js"].map((e) => join(base, e))]) {
      if (byFull.has(candidate)) {
        target = byFull.get(candidate);
        break;
      }
    }
    if (!target) continue;
    const bindings = [];
    const named = /\{([^}]*)\}/.exec(clause);
    if (named) {
      for (const part of named[1].split(",")) {
        const [imported, local] = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        if (imported) bindings.push({ imported: imported.trim(), local: (local ?? imported).trim() });
      }
    }
    const def = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.replace(/\{[^}]*\}/, ""));
    if (def) bindings.push({ imported: "default", local: def[1] });
    out.push({ module: target, bindings });
  }
  return out;
}

// Modules that only hold configuration (typed env, config object) for n8n: a fetch that uses
// one of their exports is a call to n8n even though the URL is nowhere near the fetch.
const configModules = files.filter((f) => !inN8nLib(f) && !hasFetch(f) && (readsN8nEnv(f) || mentionsWebhookUrl(f)));

// Every fetch that goes to n8n: inside lib/n8n/, or in a file that reads N8N_* / holds a webhook
// URL, or whose URL argument (directly or through a `const url = ...`) mentions n8n / a webhook
// or comes from a config module.
const n8nCalls = [];
for (const f of files) {
  if (!hasFetch(f)) continue;
  const fromConfig = localImportBindings(f)
    .filter(({ module }) => configModules.includes(module))
    .flatMap(({ bindings }) => bindings.map((b) => b.local));
  const fileLevel = inN8nLib(f) || readsN8nEnv(f) || mentionsWebhookUrl(f);
  for (const m of f.code.matchAll(/\bfetch\s*\(/g)) {
    const argsText = callArgs(f.code, m.index + m[0].length - 1);
    const first = firstArgument(argsText);
    const urlText = [first, ...argIdentifiers(first).concat(first.match(/[A-Za-z_$][\w$]*/g) ?? []).map((id) => initializerOf(f.code, id) ?? "")].join(" ");
    const looksLikeN8n = /n8n|webhook|workflow/i.test(urlText) || fromConfig.some((b) => new RegExp(String.raw`\b${b}\b`).test(urlText));
    if (fileLevel || looksLikeN8n) {
      n8nCalls.push({ file: f, rel: f.rel, line: lineOf(f.code, m.index), args: argsText, url: urlText });
    }
  }
}
const outboundFiles = [...new Set(n8nCalls.map((c) => c.file))];

// Callback routes: route handlers whose path or source mentions n8n, callback, webhook or a signature.
const callbackRoutes = files.filter(
  (f) =>
    /(^|\/)app\/.*\/route\.(ts|js|mjs)$/.test(f.rel) &&
    (/n8n|callback|webhook/i.test(f.rel) || /n8n|x-n8n-signature|callback|webhook|signature/i.test(f.raw)),
);

const VERIFY_CALL = /\btimingSafeEqual\s*\(|\bcreateHmac\s*\(/;
const PARSE_CALL = /\bJSON\.parse\s*\(|\.\s*(?:json|formData)\s*\(\s*\)/;

// A callback "unit" = the route, the local modules it imports that do the crypto, and the names
// the route imported: which of them verify (crypto inside) and which parse the body.
const callbackUnits = callbackRoutes.map((route) => {
  const imports = localImportBindings(route);
  const helpers = imports.map((i) => i.module).filter((m) => /timingSafeEqual|createHmac/.test(m.code));
  const verifyNames = [];
  const parseNames = [];
  for (const { module, bindings } of imports) {
    for (const b of bindings) {
      const text = declarationText(module, b.imported) ?? "";
      if (!text) continue;
      if (VERIFY_CALL.test(text)) verifyNames.push(b.local);
      else if (PARSE_CALL.test(text)) parseNames.push(b.local);
    }
  }
  return { route, helpers: [...new Set(helpers)], all: [route, ...new Set(helpers)], verifyNames, parseNames };
});

// The request parameter of POST, in any of the shapes an agent writes it.
function postParam(code) {
  const patterns = [
    /export\s+(?:async\s+)?function\s+POST\s*\(\s*(\w+)/,
    /export\s+const\s+POST\s*(?::[^=]+)?=\s*(?:async\s*)?\(\s*(\w+)/,
    /export\s+const\s+POST\s*(?::[^=]+)?=\s*(?:async\s+)?function\s*\w*\s*\(\s*(\w+)/,
  ];
  for (const p of patterns) {
    const m = p.exec(code);
    if (m) return m[1];
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

const results = [];
function check(id, title, run) {
  const findings = [];
  let note = "";
  let na = false;
  run(
    (file, line, reason) => findings.push({ where: line ? `${file}:${line}` : file, reason }),
    (text) => {
      note = text;
      na = true;
    },
  );
  results.push({ id, title, status: findings.length ? "FAIL" : na ? "N/A" : "PASS", note, findings });
}

check("C1", "no /webhook-test/ URL in code or .env.example", (fail) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/\/webhook-test\b/g)) fail(f.rel, lineOf(f.code, m.index), "test URL works only 120 s after 'Listen for test event'; use the production /webhook/ URL");
  }
  for (const { line, text } of envExample ?? []) {
    if (/\/webhook-test\b/.test(text)) fail(".env.example", line, `${text.split("=")[0].trim()} points at a /webhook-test/ URL`);
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
  if (!n8nCalls.length && !libFiles.length) note("no call to n8n found in app/, lib/, components/ or src/");
  for (const call of n8nCalls) {
    if (!inN8nLib(call.file)) fail(call.rel, call.line, "fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)");
  }
  for (const f of libFiles) {
    const firstStatement = f.code.replace(/^\s+/, "").split("\n")[0];
    if (!/^import\s+["']server-only["']/.test(firstStatement)) fail(f.rel, 1, "first statement must be import 'server-only'");
  }
});

check("C4", "callback route reads the raw body; parses only after the signature check", (fail, note) => {
  if (!callbackUnits.length) note("no callback route found (app/**/route.ts mentioning n8n/callback/webhook/signature)");
  for (const { route, helpers, all, verifyNames, parseNames } of callbackUnits) {
    const param = postParam(route.code);
    for (const f of all) {
      const names = ["req", "request", ...(param ? [param] : [])].join("|");
      for (const m of f.code.matchAll(new RegExp(`\\b(${names})\\s*\\.\\s*(json|formData)\\s*\\(\\s*\\)`, "g"))) {
        fail(f.rel, lineOf(f.code, m.index), `${m[0]} parses/re-serialises the body: read it once with .text() or .arrayBuffer()`);
      }
      for (const m of f.code.matchAll(/\.\s*update\s*\(\s*JSON\.stringify\s*\(/g)) {
        fail(f.rel, lineOf(f.code, m.index), "HMAC over JSON.stringify(...): sign the exact bytes n8n sent, not a re-serialised object");
      }
    }
    // Order inside the route: the first parse (here or in an imported helper) must come after
    // the first verification step.
    const verifyPatterns = [VERIFY_CALL, ...verifyNames.map((n) => new RegExp(String.raw`\b${n}\s*\(`))];
    const verifyIdx = Math.min(...verifyPatterns.map((p) => p.exec(route.code)?.index ?? Infinity));
    const parsePatterns = [/\bJSON\.parse\s*\(/, ...parseNames.map((n) => new RegExp(String.raw`\b${n}\s*\(`))];
    const parse = parsePatterns
      .map((p) => p.exec(route.code))
      .filter(Boolean)
      .sort((a, b) => a.index - b.index)[0];
    if (parse && parse.index < verifyIdx) {
      fail(route.rel, lineOf(route.code, parse.index), `${parse[0].trim()} before the signature is verified`);
    }
    for (const h of helpers) {
      const p = /\bJSON\.parse\s*\(/.exec(h.code);
      const v = /\btimingSafeEqual\s*\(/.exec(h.code);
      if (p && (!v || p.index < v.index)) fail(h.rel, lineOf(h.code, p.index), "JSON.parse before timingSafeEqual");
    }
  }
});

check("C5", "signature: length check + timingSafeEqual, never === / !==", (fail, note) => {
  if (!callbackUnits.length) note("no callback route found");
  for (const { route, all } of callbackUnits) {
    const text = all.map((f) => f.code).join("\n");
    if (!/\btimingSafeEqual\s*\(/.test(text)) fail(route.rel, null, "no crypto.timingSafeEqual (in the route or the helpers it imports)");
    else if (!/\.(byteLength|length)\s*!==|\.(byteLength|length)\s*===|!==\s*\w+\.(byteLength|length)\b/.test(text)) {
      fail(route.rel, null, "no length check before timingSafeEqual (it throws on different lengths)");
    }
    for (const f of all) {
      const code = codeOnly(f.code);
      // Comparing a signature with a string literal, null/undefined or typeof is a guard, not a
      // comparison of two signatures - only the latter must go through timingSafeEqual.
      const cmp =
        /(?<!typeof\s)(?<!\w)\w*(?:signature|digest|hmac)\w*\s*[!=]==(?!\s*(?:null\b|undefined\b|["'`]))|(?<!["'`]\s)[!=]==\s*\w*(?:signature|digest|hmac)\w*\b(?!\s*\.\s*(?:length|byteLength))/gi;
      for (const m of code.matchAll(cmp)) fail(f.rel, lineOf(code, m.index), `'${m[0].trim()}': compare signatures with timingSafeEqual`);
    }
  }
});

check("C6", "every fetch to n8n has signal: AbortSignal.timeout(...)", (fail, note) => {
  if (!n8nCalls.length) note("no call to n8n found");
  for (const call of n8nCalls) {
    if (/\bsignal\b/.test(call.args)) continue;
    // fetch(url, init) / fetch(url, { ...init }): follow the object one level.
    const viaVariable = argIdentifiers(call.args).some((id) => /\bsignal\b/.test(initializerOf(call.file.code, id) ?? ""));
    if (!viaVariable) fail(call.rel, call.line, "fetch without signal: add AbortSignal.timeout(10_000)");
  }
});

check("C7", "no bodies, payloads or headers in console.* in n8n code", (fail, note) => {
  const n8nFiles = new Set([...outboundFiles, ...callbackUnits.flatMap((u) => u.all), ...files.filter(inN8nLib)]);
  if (!n8nFiles.size) note("no n8n code found (no call to n8n, no callback route, no lib/n8n/)");
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

check("C10", "every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL", (fail, note) => {
  if (!n8nCalls.length) note("no call to n8n found");
  for (const f of outboundFiles) {
    const line = n8nCalls.find((c) => c.file === f).line;
    if (!/["']idempotency-key["']/i.test(f.code)) {
      fail(f.rel, line, "no idempotency-key header (UUID created once per operation, reused on retries)");
    }
    if (!/["']x-n8n-token["']/i.test(f.code)) {
      fail(f.rel, line, "no x-n8n-token header (n8n Header Auth; a missing or wrong token is a 403)");
    }
  }
  for (const call of n8nCalls) {
    if (SECRET_IN_URL.test(call.url)) fail(call.rel, call.line, "token/secret in the query string: it lands in logs and proxies - send it as a header");
  }
  for (const f of outboundFiles) {
    for (const m of f.code.matchAll(/searchParams\s*\.\s*(?:set|append)\s*\(\s*["'](token|secret|key|apikey|api_key|access_token|auth)["']/gi)) {
      fail(f.rel, lineOf(f.code, m.index), `${m[1]} added to the query string: n8n auth goes in the x-n8n-token header`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const failed = results.filter((r) => r.status === "FAIL");
const passed = results.filter((r) => r.status === "PASS");
const skipped = results.filter((r) => r.status === "N/A");
if (args.json) {
  console.log(JSON.stringify({ root: toPosix(root), failed: failed.length, passed: passed.length, na: skipped.length, results }, null, 2));
} else {
  console.log(`check-contract (integrating-n8n-webhooks) - ${toPosix(root)}`);
  console.log(`scanned ${files.length} source files; n8n callers: ${outboundFiles.map((f) => f.rel).join(", ") || "none"}; callback routes: ${callbackRoutes.map((f) => f.rel).join(", ") || "none"}\n`);
  for (const r of results) {
    console.log(`${r.id.padEnd(3)} ${r.status.padEnd(4)} ${r.title}${r.note ? `  (${r.note})` : ""}`);
    for (const f of r.findings) console.log(`      ${f.where}  ${f.reason}`);
  }
  console.log(`\n${failed.length} failed, ${passed.length} passed, ${skipped.length} n/a (${results.length} checks)`);
}
process.exitCode = failed.length ? 1 : 0;
