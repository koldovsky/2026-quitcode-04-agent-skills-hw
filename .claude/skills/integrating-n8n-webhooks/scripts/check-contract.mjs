#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n webhook contract
// (skill integrating-n8n-webhooks). Zero dependencies. Reads source files and .env.example
// only (never .env.local or any other .env* file) and prints file:line plus a message for
// every finding: never code, request bodies or secret values.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const CONTRACT_VARS = ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"];
const CONTRACT_SECRETS = new Set(["N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".claude", ".cursor", ".agents", ".codex",
  ".vercel", ".turbo", "out", "build", "dist", "coverage",
]);
// The skill's own scripts (and the LeadDesk copy of the mock) talk to n8n by design.
const SKIP_FILES = new Set(["mock-n8n.mjs", "check-contract.mjs", "send-signed-callback.mjs"]);
const MAX_FILE_BYTES = 1024 * 1024;

const CLIENT_MODULE = /(^|\/)(src\/)?lib\/n8n\/client\.(ts|js|mjs|mts)$/;
const N8N_LIB = /(^|\/)(src\/)?lib\/n8n\//;
const ROUTE_FILE = /(^|\/)(src\/)?app\/(.+\/)?route\.(ts|tsx|js|jsx|mjs)$/;
const N8N_ROUTE_DIR = /(^|\/)(src\/)?app\/api\/n8n\//;
const N8N_HINT = /N8N_|\bn8n\b|\/webhook(-test)?\//i;
const LENGTH_COMPARE = /\.(?:byteLength|length)\s*(?:===|!==|==|!=)|(?:===|!==|==|!=)\s*[\w$.]+\.(?:byteLength|length)\b/;

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const CHECKS = [
  {
    id: "C1",
    slug: "no-test-url",
    title: "only production webhook URLs: no /webhook-test/ in code or .env.example",
    run: checkNoTestUrl,
  },
  {
    id: "C2",
    slug: "env-server-only",
    title: "n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components",
    run: checkEnvServerOnly,
  },
  {
    id: "C3",
    slug: "env-example",
    title: ".env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets",
    run: checkEnvExample,
  },
  {
    id: "C4",
    slug: "one-client",
    title: "n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/",
    run: checkOneClient,
  },
  {
    id: "C5",
    slug: "server-only",
    title: 'lib/n8n modules that hold config start with import "server-only"',
    run: checkServerOnlyImport,
  },
  {
    id: "C6",
    slug: "fetch-timeout",
    title: "every fetch to n8n has signal: AbortSignal.timeout(…)",
    run: checkFetchTimeout,
  },
  {
    id: "C7",
    slug: "request-contract",
    title: "requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope",
    run: checkRequestContract,
  },
  {
    id: "C8",
    slug: "no-waiting",
    title: "Server Actions start n8n only inside after()",
    run: checkNoWaiting,
  },
  {
    id: "C9",
    slug: "no-edge",
    title: 'no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)',
    run: checkNoEdge,
  },
  {
    id: "C10",
    slug: "callback-raw-body",
    title: "callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check",
    run: checkCallbackRawBody,
  },
  {
    id: "C11",
    slug: "callback-signature",
    title: "callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never ===",
    run: checkCallbackSignature,
  },
  {
    id: "C12",
    slug: "callback-timestamp",
    title: "callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401",
    run: checkCallbackTimestamp,
  },
  {
    id: "C13",
    slug: "callback-idempotency",
    title: "callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure",
    run: checkCallbackIdempotency,
  },
  {
    id: "C14",
    slug: "log-hygiene",
    title: "n8n code logs no bodies, personal data, secrets, env or whole error objects",
    run: checkLogHygiene,
  },
];

function checkNoTestUrl(project) {
  const findings = [];
  for (const file of project.files) {
    for (const m of file.nocomment.matchAll(/\/webhook-test(?=[/'"`?#\s]|$)/g)) {
      findings.push(at(file, m.index, "test webhook URL (/webhook-test/): code uses only the production /webhook/<event>"));
    }
  }
  // Values and commented-out assignments ("# KEY=…"); a prose comment may name the test path.
  project.env?.lines.forEach((line, index) => {
    const key = /^\s*#?\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (!key || !/\/webhook-test\b/.test(line)) return;
    findings.push({
      file: ".env.example",
      line: index + 1,
      message: `${key} points at a test webhook URL (/webhook-test/): use …/webhook`,
    });
  });
  return { findings };
}

function checkEnvServerOnly(project) {
  const findings = [];
  const PUBLIC = /\bNEXT_PUBLIC_[A-Z0-9_]*(?:N8N|WEBHOOK|CALLBACK|HMAC)[A-Z0-9_]*/g;
  for (const file of project.files) {
    for (const m of file.nocomment.matchAll(PUBLIC)) {
      findings.push(at(file, m.index, `${m[0]}: NEXT_PUBLIC_ inlines the value into the browser bundle`));
    }
    if (file.directive !== "client") continue;
    for (const m of file.nocomment.matchAll(/\bN8N_[A-Z0-9_]+/g)) {
      findings.push(at(file, m.index, `${m[0]} in a Client Component`));
    }
    for (const imp of file.imports) {
      if (!imp.typeOnly && /n8n/i.test(imp.spec)) {
        findings.push({ file: file.rel, line: imp.line, message: `Client Component imports ${imp.spec}` });
      }
    }
  }
  for (const entry of project.env?.entries ?? []) {
    if (/^NEXT_PUBLIC_.*(N8N|WEBHOOK|CALLBACK|HMAC)/.test(entry.key)) {
      findings.push({ file: ".env.example", line: entry.line, message: `${entry.key}: n8n settings are never NEXT_PUBLIC_` });
    }
  }
  return { findings };
}

function checkEnvExample(project) {
  const findings = [];
  const refs = new Map();
  for (const file of project.files) {
    for (const m of file.nocomment.matchAll(/\b(N8N_[A-Z0-9_]+|APP_BASE_URL)\b/g)) {
      if (!refs.has(m[1])) refs.set(m[1], []);
      refs.get(m[1]).push(at(file, m.index, ""));
    }
  }
  const env = project.env;
  const envN8n = (env?.entries ?? []).filter((e) => e.key.startsWith("N8N_") || e.key === "APP_BASE_URL");
  if (!refs.size && !envN8n.length && !project.clients.length && !project.routes.length) {
    return { skip: "no N8N_* / APP_BASE_URL variables in code or .env.example" };
  }

  for (const [name, uses] of refs) {
    if (CONTRACT_VARS.includes(name)) continue;
    for (const use of uses) {
      findings.push({ ...use, message: `${name} is not a contract variable (${CONTRACT_VARS.join(", ")})` });
    }
  }
  if (!env) {
    findings.push({ file: ".env.example", line: null, message: "missing .env.example with the contract variables" });
    return { findings };
  }

  const declared = new Map(env.entries.map((e) => [e.key, e]));
  for (const entry of env.entries) {
    if (entry.key.startsWith("N8N_") && !CONTRACT_VARS.includes(entry.key)) {
      findings.push({ file: ".env.example", line: entry.line, message: `${entry.key} is not a contract variable (${CONTRACT_VARS.join(", ")})` });
    }
  }

  const callbacks =
    project.routes.length > 0 ||
    refs.has("N8N_CALLBACK_SECRET") ||
    refs.has("APP_BASE_URL") ||
    declared.has("N8N_CALLBACK_SECRET") ||
    project.callers.some((file) => /\bcallbackUrl\b/.test(file.code));
  const required = new Set(["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN"]);
  if (callbacks) {
    required.add("N8N_CALLBACK_SECRET");
    required.add("APP_BASE_URL");
  }
  for (const name of CONTRACT_VARS) {
    if (declared.has(name)) continue;
    const uses = refs.get(name);
    if (uses) {
      for (const use of uses) findings.push({ ...use, message: `${name} is read here but not declared in .env.example` });
    } else if (required.has(name)) {
      findings.push({ file: ".env.example", line: null, message: `missing ${name}` });
    }
  }

  const base = declared.get("N8N_WEBHOOK_BASE_URL");
  if (base) {
    const url = parseUrl(base.value);
    if (!url) {
      findings.push({ file: ".env.example", line: base.line, message: "N8N_WEBHOOK_BASE_URL is not an http(s) URL" });
    } else {
      if (!url.pathname.replace(/\/+$/, "").endsWith("/webhook")) {
        findings.push({ file: ".env.example", line: base.line, message: "N8N_WEBHOOK_BASE_URL must end with /webhook (the production path)" });
      }
      if (!isLocalHost(url.hostname)) {
        findings.push({ file: ".env.example", line: base.line, message: "N8N_WEBHOOK_BASE_URL in .env.example must be a local address (the real one goes to .env.local)" });
      }
    }
  }
  const app = declared.get("APP_BASE_URL");
  if (app) {
    const url = parseUrl(app.value);
    if (!url || !isLocalHost(url.hostname)) {
      findings.push({ file: ".env.example", line: app.line, message: "APP_BASE_URL in .env.example must be a local http(s) URL" });
    }
  }
  for (const entry of env.entries) {
    const secretLike = CONTRACT_SECRETS.has(entry.key) || /SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE/.test(entry.key);
    if (!secretLike) continue;
    const placeholder = entry.value.startsWith("change-me") || (!CONTRACT_SECRETS.has(entry.key) && entry.value === "");
    if (!placeholder) {
      findings.push({ file: ".env.example", line: entry.line, message: `${entry.key} must be a change-me-… placeholder in .env.example (value not shown)` });
    }
  }
  return { findings };
}

function checkOneClient(project) {
  const findings = [];
  let outbound = false;
  for (const file of project.files) {
    if (CLIENT_MODULE.test(file.rel)) continue;
    for (const m of file.nocomment.matchAll(/\bN8N_WEBHOOK_[A-Z0-9_]*/g)) {
      outbound = true;
      findings.push(at(file, m.index, `${m[0]} is read outside lib/n8n/client.ts`));
    }
    for (const call of file.n8nFetches) {
      outbound = true;
      findings.push({ file: file.rel, line: call.line, message: "request to n8n outside lib/n8n/client.ts: call triggerWorkflow() from the client module" });
    }
  }
  for (const route of project.routes) {
    if (!N8N_ROUTE_DIR.test(route.rel)) {
      findings.push({ file: route.rel, line: null, message: "n8n callback route outside app/api/n8n/: use app/api/n8n/[event]/route.ts" });
    }
  }
  if (!project.clients.length && outbound) {
    findings.push({ file: "lib/n8n/client.ts", line: null, message: "missing: the project calls n8n but has no lib/n8n/client.ts" });
  }
  if (!project.clients.length && !outbound && !project.routes.length) {
    return { skip: "no n8n calls and no callback routes" };
  }
  return { findings };
}

function checkServerOnlyImport(project) {
  if (!project.n8nLib.length) return { skip: "no lib/n8n/ modules" };
  const findings = [];
  for (const file of project.n8nLib) {
    const holdsConfig = CLIENT_MODULE.test(file.rel) || /\bprocess\.env\b/.test(file.code);
    if (!holdsConfig) continue;
    if (!/^\s*(?:#![^\n]*\n\s*)?import\s+(['"])server-only\1/.test(file.nocomment)) {
      findings.push({ file: file.rel, line: null, message: 'the first statement must be import "server-only"' });
    }
  }
  return { findings };
}

function checkFetchTimeout(project) {
  const findings = [];
  let calls = 0;
  for (const file of project.callers) {
    const hasTimeout = /\bAbortSignal\.timeout\s*\(/.test(file.code);
    const signalElsewhere = /\bsignal\s*[:,}]/.test(file.code);
    for (const call of file.n8nFetches) {
      calls++;
      const inline = /\bsignal\b/.test(call.args);
      if (!inline && !signalElsewhere) {
        findings.push({ file: file.rel, line: call.line, message: "fetch to n8n without a timeout: add signal: AbortSignal.timeout(10_000)" });
      } else if (!hasTimeout) {
        findings.push({ file: file.rel, line: call.line, message: "the signal is not AbortSignal.timeout(10_000)" });
      }
    }
  }
  if (!calls) return { skip: "no fetch to n8n" };
  return { findings };
}

function checkRequestContract(project) {
  if (!project.callers.length) return { skip: "no fetch to n8n" };
  const findings = [];
  for (const file of project.callers) {
    const anchor = file.n8nFetches[0]?.line ?? null;
    const missing = ["x-n8n-token", "idempotency-key", "x-correlation-id"].filter(
      (name) => !new RegExp(`['"\`]${name}['"\`]`, "i").test(file.nocomment),
    );
    if (missing.length) {
      findings.push({ file: file.rel, line: anchor, message: `request to n8n without the ${missing.join(", ")} header${missing.length > 1 ? "s" : ""}` });
    }
    if (!/application\/json/i.test(file.nocomment)) {
      findings.push({ file: file.rel, line: anchor, message: "request to n8n without content-type: application/json" });
    }
    for (const m of file.nocomment.matchAll(/['"]x-n8n-token['"]\s*:\s*['"`]/gi)) {
      findings.push(at(file, m.index, "x-n8n-token is a string literal: read it from N8N_WEBHOOK_TOKEN"));
    }
    for (const m of file.nocomment.matchAll(/[?&](?:token|secret|signature|sig|api[_-]?key)=/gi)) {
      findings.push(at(file, m.index, "secret in a query string: send it in a header"));
    }
    for (const call of file.n8nFetches) {
      if (envelopeOf(file, call) === "missing") {
        findings.push({ file: file.rel, line: call.line, message: "the body is not the envelope {version, event, data}: send only what the workflow needs" });
      }
    }
  }
  return { findings };
}

function checkNoWaiting(project) {
  const findings = [];
  let inspected = 0;
  for (const file of project.files) {
    if (file.directive !== "server") continue;
    const sites = n8nCallSites(project, file);
    if (!sites.length) continue;
    inspected++;
    const { decls, depth } = topLevelDeclarations(file);
    const afters = findCalls(file, "after").map((call) => [call.open, call.close]);
    const inAfter = (offset) => afters.some(([open, close]) => offset > open && offset < close);
    const enclosing = (offset) => {
      if (depth[offset] === 0) return null;
      let found = null;
      for (const decl of decls) {
        if (decl.start < offset) found = decl;
        else break;
      }
      return found;
    };
    for (const site of sites) {
      if (inAfter(site.offset)) continue;
      const fn = enclosing(site.offset);
      if (!fn) continue;
      if (fn.exported) {
        findings.push(at(file, site.offset, `Server Action ${fn.name}() waits for n8n (${site.label}): save the record, return, call n8n inside after()`));
        continue;
      }
      for (const call of findCalls(file, escapeRe(fn.name))) {
        if (/function\s*\*?\s*$/.test(file.code.slice(Math.max(0, call.start - 20), call.start))) continue;
        if (inAfter(call.start)) continue;
        const caller = enclosing(call.start);
        if (caller?.exported) {
          findings.push(at(file, call.start, `Server Action ${caller.name}() waits for n8n through ${fn.name}(): call it inside after()`));
        }
      }
    }
  }
  if (!inspected) return { skip: 'no Server Action ("use server" file) calls n8n' };
  return { findings };
}

function checkNoEdge(project) {
  const findings = [];
  for (const file of project.files) {
    const re = /export\s+const\s+runtime\s*=\s*(['"`])(?:experimental-)?edge\1|\bruntime\s*:\s*(['"`])(?:experimental-)?edge\2/g;
    for (const m of file.nocomment.matchAll(re)) {
      findings.push(at(file, m.index, 'runtime "edge": deprecated in Next.js 16, and the contract needs node:crypto; remove the export'));
    }
  }
  return { findings };
}

function checkCallbackRawBody(project) {
  if (!project.routes.length) return { skip: "no callback route (app/api/n8n/[event]/route.ts)" };
  const findings = [];
  for (const route of project.routes) {
    const chain = project.chains.get(route);
    const has = (re) => chain.some((file) => re.test(file.nocomment));
    const post = handlerSpan(route, "POST");
    if (!post) {
      findings.push({ file: route.rel, line: null, message: "no POST handler found" });
      continue;
    }
    const param = post.param ?? "request";
    const p = escapeRe(param);
    const body = route.code.slice(post.bodyStart, post.bodyEnd);
    if (!new RegExp(`\\b${p}\\.(?:text|arrayBuffer)\\s*\\(`).test(body)) {
      findings.push({ file: route.rel, line: post.line, message: `the raw body is never read: const raw = await ${param}.text()` });
    }
    for (const m of route.code.matchAll(new RegExp(`\\b${p}\\.(json|formData)\\s*\\(`, "g"))) {
      findings.push(at(route, m.index, `${param}.${m[1]}(): the signature is checked on the raw text; parse only after it`));
    }
    const anchorAt = body.search(/\b(?:timingSafeEqual|[\w$]*(?:[vV]erify|[sS]ignature)[\w$]*)\s*\(/);
    const anchor = anchorAt === -1 ? Infinity : post.bodyStart + anchorAt;
    for (const m of route.code.matchAll(/\bJSON\.parse\s*\(/g)) {
      if (m.index < post.bodyStart || m.index > post.bodyEnd || m.index > anchor) continue;
      findings.push(at(route, m.index, anchor === Infinity ? "JSON.parse, and POST never checks a signature" : "JSON.parse before the signature check"));
    }
    if (!/['"`]content-type['"`]/i.test(route.nocomment)) {
      findings.push({ file: route.rel, line: post.line, message: "content-type is never checked (415 for anything but application/json)" });
    }
    if (!has(/\b404\b/)) findings.push({ file: route.rel, line: post.line, message: "no 404 for an unknown event" });
    if (!has(/\b415\b/)) findings.push({ file: route.rel, line: post.line, message: "no 415 for a non-JSON content-type" });
    if (!has(/\b413\b/)) findings.push({ file: route.rel, line: post.line, message: "no 413 for bodies over 64 KB" });
  }
  return { findings };
}

function checkCallbackSignature(project) {
  if (!project.routes.length) return { skip: "no callback route (app/api/n8n/[event]/route.ts)" };
  const findings = [];
  for (const route of project.routes) {
    const chain = project.chains.get(route);
    const n8nChain = chain.filter((file) => file === route || isN8nFile(file));
    const has = (re) => chain.some((file) => re.test(file.nocomment));
    if (!has(/['"`]x-n8n-signature['"`]/i)) {
      findings.push({ file: route.rel, line: null, message: "x-n8n-signature is never read" });
    }
    if (!has(/createHmac\s*\(\s*['"`]sha256['"`]/i)) {
      findings.push({ file: route.rel, line: null, message: 'no HMAC-SHA256: createHmac("sha256", N8N_CALLBACK_SECRET)' });
    }
    if (!has(/['"`]sha256=/)) {
      findings.push({ file: route.rel, line: null, message: "the signature is not compared in the sha256=<hex> format" });
    }
    const safe = n8nChain.filter((file) => /\btimingSafeEqual\s*\(/.test(file.code));
    if (!safe.length) {
      findings.push({ file: route.rel, line: null, message: "no crypto.timingSafeEqual: compare signatures in constant time" });
    }
    for (const file of safe) {
      if (!LENGTH_COMPARE.test(file.code)) {
        const m = /\btimingSafeEqual\s*\(/.exec(file.code);
        findings.push(at(file, m.index, "timingSafeEqual without a length check first (it throws on different lengths)"));
      }
    }
    for (const file of n8nChain) {
      for (const hit of unsafeComparisons(file)) {
        findings.push({ file: file.rel, line: hit.line, message: `signature compared with ${hit.op}: use a length check + crypto.timingSafeEqual` });
      }
    }
  }
  return { findings };
}

function checkCallbackTimestamp(project) {
  if (!project.routes.length) return { skip: "no callback route (app/api/n8n/[event]/route.ts)" };
  const findings = [];
  for (const route of project.routes) {
    const chain = project.chains.get(route);
    const has = (re) => chain.some((file) => re.test(file.nocomment));
    if (!has(/['"`]x-n8n-timestamp['"`]/i)) {
      findings.push({ file: route.rel, line: null, message: "x-n8n-timestamp is never read" });
    }
    if (!has(/\b300\b|\b300_?000\b|\b5\s*\*\s*60\b/)) {
      findings.push({ file: route.rel, line: null, message: "no ±300 s window for x-n8n-timestamp" });
    }
    const twoSided =
      chain.some((file) => /\bMath\.abs\s*\(/.test(file.code)) ||
      chain.some((file) => file.code.split("\n").some((line) => /[<>][^\n]*(\|\||&&)[^\n]*[<>]/.test(line)));
    if (!twoSided) {
      findings.push({ file: route.rel, line: null, message: "the time window must work both ways: Math.abs(now - timestamp) > 300" });
    }
    const hmacFiles = chain.filter((file) => /\bcreateHmac\s*\(/.test(file.code));
    const updates = hmacFiles.flatMap((file) => findCalls(file, "[\\w$.)\\]]*\\.update").map((call) => ({ file, call })));
    const signsTimestamp = updates.some(({ call }) => /\$\{[^}]*\}\.|(['"`])\.\1/.test(call.argsNc));
    if (hmacFiles.length && !signsTimestamp) {
      const first = updates[0];
      findings.push(
        first
          ? { file: first.file.rel, line: first.call.line, message: "the HMAC must cover `${timestamp}.${rawBody}`, not the body alone" }
          : { file: hmacFiles[0].rel, line: null, message: "the HMAC must cover `${timestamp}.${rawBody}`" },
      );
    }
    if (!has(/\b401\b/)) {
      findings.push({ file: route.rel, line: null, message: "no 401 for a stale timestamp or a bad signature" });
    }
  }
  return { findings };
}

function checkCallbackIdempotency(project) {
  if (!project.routes.length) return { skip: "no callback route (app/api/n8n/[event]/route.ts)" };
  const findings = [];
  for (const route of project.routes) {
    const chain = project.chains.get(route);
    const has = (re) => chain.some((file) => re.test(file.nocomment));
    if (!has(/['"`]idempotency-key['"`]/i)) {
      findings.push({ file: route.rel, line: null, message: "idempotency-key is never read" });
    }
    if (!has(/\bduplicate\b/)) {
      findings.push({ file: route.rel, line: null, message: "no 200 {duplicate: true} for a repeated idempotency-key" });
    }
    if (!has(/\$\{[^}]*jobId[^}]*\}\s*:\s*\$\{|jobId\s*\+\s*['"`]:/)) {
      findings.push({ file: route.rel, line: null, message: "idempotency-key is not matched to `${data.jobId}:${event}` of the signed body" });
    }
    if (!has(/\b(?:release|unclaim|forget)\w*\s*\(|\.delete\s*\(\s*[\w$.]*[kK]ey\b/)) {
      findings.push({ file: route.rel, line: null, message: 'the claimed key is never released when processing fails (n8n\'s retry would get "duplicate")' });
    }
  }
  return { findings };
}

function checkLogHygiene(project) {
  const scope = new Set([...project.clients, ...project.n8nLib, ...project.callers]);
  for (const route of project.routes) {
    for (const file of project.chains.get(route)) if (file === route || isN8nFile(file)) scope.add(file);
  }
  for (const file of project.files) {
    if (file.directive === "server" && n8nCallSites(project, file).length) scope.add(file);
  }
  if (!scope.size) return { skip: "no n8n code" };
  const findings = [];
  for (const file of scope) {
    for (const call of findCalls(file, "console\\.(?:log|info|warn|error|debug|trace)")) {
      const problems = logProblems(call.args);
      if (problems.length) {
        findings.push({
          file: file.rel,
          line: call.line,
          message: `logs ${problems.join(", ")}: log the event, correlation id, status, duration, size, sha256, error.name`,
        });
      }
    }
  }
  return { findings };
}

// ---------------------------------------------------------------------------
// Heuristics shared by the checks
// ---------------------------------------------------------------------------

function isN8nFile(file) {
  return N8N_LIB.test(file.rel) || /x-n8n-|N8N_|\bcreateHmac\b|\btimingSafeEqual\b/.test(file.nocomment);
}

function n8nCallSites(project, file) {
  const sites = file.n8nFetches.map((call) => ({ offset: call.start, label: "fetch" }));
  for (const imp of file.imports) {
    if (imp.typeOnly) continue;
    const target = resolveImport(project, file, imp.spec);
    if (!/n8n/i.test(imp.spec) && !(target && N8N_LIB.test(target.rel))) continue;
    for (const name of imp.names) {
      for (const call of findCalls(file, escapeRe(name))) sites.push({ offset: call.start, label: `${name}()` });
    }
    if (imp.namespace) {
      for (const call of findCalls(file, `${escapeRe(imp.namespace)}\\.[\\w$]+`)) {
        sites.push({ offset: call.start, label: `${imp.namespace}.…()` });
      }
    }
  }
  return sites;
}

// "body" of a fetch call: the envelope, a bare record, or something we can't resolve.
function envelopeOf(file, call) {
  const property = /\bbody\b\s*(:)?\s*/.exec(call.args);
  if (!property) return "unknown";
  const valueAt = call.open + 1 + property.index + property[0].length;
  let expr = property[1] ? file.code.slice(valueAt) : "body";
  for (let hop = 0; hop < 3; hop++) {
    const stringify = /^\s*JSON\.stringify\s*\(/.exec(expr);
    if (stringify) {
      const open = expr.indexOf("(");
      const close = matchClose(expr, open);
      expr = expr.slice(open + 1, close === -1 ? undefined : close);
      continue;
    }
    if (/^\s*\{/.test(expr)) {
      const close = matchClose(expr, expr.indexOf("{"));
      const object = expr.slice(0, close === -1 ? undefined : close + 1);
      return /\bversion\b/.test(object) && /\bevent\b/.test(object) && /\bdata\b/.test(object) ? "envelope" : "missing";
    }
    const ident = /^\s*([A-Za-z_$][\w$]*)\s*(?:[,)}\n]|$)/.exec(expr);
    if (!ident) return "unknown";
    const decl = new RegExp(`\\b(?:const|let|var)\\s+${escapeRe(ident[1])}\\s*(?::[^=]+)?=\\s*`).exec(file.code);
    if (!decl) return "unknown";
    const init = file.code.slice(decl.index + decl[0].length);
    if (!/^\s*(?:JSON\.stringify\s*\(|\{)/.test(init)) return "missing";
    expr = init;
  }
  return "unknown";
}

function unsafeComparisons(file) {
  const hits = [];
  const code = file.code;
  for (const m of code.matchAll(/(?<![=!<>])(===|!==|==|!=)(?!=)/g)) {
    const left = operandBefore(code, m.index).replace(/^\s*(?:return|await|yield)\b/, "");
    const right = operandAfter(code, m.index + m[1].length);
    if (isTrivialOperand(left) || isTrivialOperand(right)) continue;
    if (/^\s*typeof\b/.test(left) || /^\s*typeof\b/.test(right)) continue;
    if (/\.(?:length|byteLength|size)\s*$/.test(left) || /\.(?:length|byteLength|size)\s*$/.test(right)) continue;
    if (signatureLike(left) || signatureLike(right)) hits.push({ line: lineOf(file, m.index), op: m[1] });
  }
  for (const m of code.matchAll(/([\w$]+)\s*\.equals\s*\(/g)) {
    if (signatureLike(m[1])) hits.push({ line: lineOf(file, m.index), op: ".equals()" });
  }
  return hits;
}

function signatureLike(text) {
  return (text.match(/[A-Za-z_$][\w$]*/g) ?? []).some(
    (t) => /signature|digest|hmac/i.test(t) || /^sig(?:[A-Z_]|$)/.test(t) || /Sig(?:[A-Z_]|$)/.test(t) || t === "expected" || t === "computed",
  );
}

function isTrivialOperand(text) {
  return /^\s*(?:null|undefined|true|false|-?\d[\d_.]*|(["'`])\s*\1)\s*$/.test(text);
}

function operandBefore(code, index) {
  let depth = 0;
  let i = index - 1;
  for (; i >= 0; i--) {
    const c = code[i];
    if (c === ")" || c === "]" || c === "}") depth++;
    else if (c === "(" || c === "[" || c === "{") {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0) {
      if (c === "\n" || c === ";" || c === "," || c === ":") break;
      if (c === "?" && code[i + 1] !== ".") break;
      if ((c === "&" || c === "|") && code[i - 1] === c) break;
      if (c === "=" && !"=!<>".includes(code[i - 1] ?? "") && code[i + 1] !== "=" && code[i + 1] !== ">") break;
    }
  }
  return code.slice(i + 1, index);
}

function operandAfter(code, index) {
  let depth = 0;
  let i = index;
  for (; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0) {
      if (c === "\n" || c === ";" || c === "," || c === ":") break;
      if (c === "?" && code[i + 1] !== ".") break;
      if ((c === "&" || c === "|") && code[i + 1] === c) break;
    }
  }
  return code.slice(index, i);
}

const LOG_WHOLE = new Set([
  "body", "rawBody", "raw", "payload", "data", "formData", "envelope", "headers", "lead", "quote",
  "record", "row", "user", "request", "req", "response", "res", "error", "err", "e", "parsed",
  "values", "fields", "input", "url", "token", "secret", "signature", "result",
]);
const LOG_PROPS = new Set([
  "email", "phone", "fullName", "firstName", "lastName", "ipAddress", "ip", "userAgent", "message",
  "body", "rawBody", "payload", "data", "headers", "token", "secret", "signature", "url", "href",
  "search", "query", "text", "formData", "values", "rawPayload", "internalNotes", "description",
  "note", "notes", "env",
]);
const LOG_IGNORE = new Set([
  "await", "async", "new", "typeof", "instanceof", "void", "null", "undefined", "true", "false",
  "this", "console", "Error", "TypeError", "Math", "Date", "Number", "String", "Boolean", "Object",
  "Array", "Buffer", "Promise", "Symbol", "BigInt", "in", "of", "as",
]);

function logProblems(args) {
  const problems = new Set();
  const chain = /(?<![\w$.])([A-Za-z_$][\w$]*)((?:\s*\??\.\s*[A-Za-z_$][\w$]*)*)/g;
  for (const m of args.matchAll(chain)) {
    const root = m[1];
    const props = m[2] ? m[2].split(/\??\./).map((s) => s.trim()).filter(Boolean) : [];
    const before = args.slice(0, m.index);
    const after = args.slice(m.index + m[0].length);
    if (root === "JSON" && props[0] === "stringify") {
      problems.add("JSON.stringify(…)");
      continue;
    }
    if (root === "process" && props[0] === "env") {
      problems.add("process.env");
      continue;
    }
    if (LOG_IGNORE.has(root)) continue;
    if (/^\s*\(/.test(after)) continue; // a call: its arguments are scanned on their own
    if (/^\s*:(?!:)/.test(after) && !/\?\s*$/.test(before)) continue; // object key
    if (/^\s*instanceof\b/.test(after) || /\btypeof\s*$/.test(before)) continue;
    const last = props.at(-1);
    if (!last && LOG_WHOLE.has(root)) problems.add(`${root} (the whole value)`);
    else if (last && LOG_PROPS.has(last)) problems.add(`${root}.${props.join(".")}`);
  }
  return [...problems];
}

// ---------------------------------------------------------------------------
// Source model: two views of each file with the same offsets.
//   code      — comments and string/template text blanked (template ${…} kept)
//   nocomment — only comments blanked
// ---------------------------------------------------------------------------

function sanitize(src) {
  const n = src.length;
  const code = src.split("");
  const nocomment = src.split("");
  const blank = (arr, from, to) => {
    for (let k = from; k < to && k < n; k++) if (arr[k] !== "\n" && arr[k] !== "\r") arr[k] = " ";
  };
  const templates = [];
  let depth = 0;
  let prev = "";
  let i = 0;

  const readTemplate = (start) => {
    let j = start;
    while (j < n) {
      const ch = src[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === "`") {
        blank(code, start, j);
        return j + 1;
      }
      if (ch === "$" && src[j + 1] === "{") {
        blank(code, start, j);
        templates.push(depth);
        depth++;
        return j + 2;
      }
      j++;
    }
    blank(code, start, n);
    return n;
  };

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      let end = src.indexOf("\n", i);
      if (end === -1) end = n;
      blank(code, i, end);
      blank(nocomment, i, end);
      i = end;
      continue;
    }
    if (ch === "/" && next === "*") {
      let end = src.indexOf("*/", i + 2);
      end = end === -1 ? n : end + 2;
      blank(code, i, end);
      blank(nocomment, i, end);
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      blank(code, i + 1, j);
      i = j + 1;
      prev = ch;
      continue;
    }
    if (ch === "`") {
      i = readTemplate(i + 1);
      prev = "`";
      continue;
    }
    if (ch === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev))) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== "\n") {
        const c = src[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) break;
        j++;
      }
      blank(code, i + 1, j);
      i = j + 1;
      prev = "/";
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (templates.length && templates.at(-1) === depth) {
        templates.pop();
        i = readTemplate(i + 1);
        prev = "`";
        continue;
      }
    }
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  return { code: code.join(""), nocomment: nocomment.join("") };
}

function loadSource(root, abs) {
  let text;
  try {
    if (fs.statSync(abs).size > MAX_FILE_BYTES) return null;
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
  const { code, nocomment } = sanitize(text);
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  return { rel: toRel(root, abs), abs, text, code, nocomment, lineStarts };
}

function walk(root) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(abs);
      } else if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
        !SKIP_FILES.has(entry.name) &&
        !entry.name.endsWith(".d.ts")
      ) {
        out.push(abs);
      }
    }
  };
  visit(root);
  return out.sort();
}

function loadEnvExample(root) {
  const abs = path.join(root, ".env.example");
  if (!fs.existsSync(abs)) return null;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const entries = [];
  lines.forEach((raw, index) => {
    if (/^\s*#/.test(raw)) return;
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    if (!m) return;
    let value = m[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    entries.push({ key: m[1], value, line: index + 1 });
  });
  return { lines, entries };
}

function parseImports(file) {
  const imports = [];
  const add = (spec, clause, offset, typeOnly) => {
    const names = [];
    let namespace = null;
    if (clause) {
      namespace = /\*\s*as\s+([\w$]+)/.exec(clause)?.[1] ?? null;
      const braces = /\{([^}]*)\}/.exec(clause);
      if (braces) {
        for (const part of braces[1].split(",")) {
          const m = /^\s*(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(part);
          if (m && !m[1]) names.push(m[3] ?? m[2]);
        }
      }
      const def = /^\s*([\w$]+)\s*(?:,|$)/.exec(clause);
      if (def && def[1] !== "type") names.push(def[1]);
    }
    imports.push({ spec, names, namespace, typeOnly, line: lineOf(file, offset) });
  };
  for (const m of file.nocomment.matchAll(/(?:^|[\n;])\s*(import|export)\s+(type\s+)?([^;=()'"]*?)\s*from\s*(['"])([^'"\n]+)\4/g)) {
    add(m[5], m[1] === "import" ? m[3] : "", m.index, Boolean(m[2]));
  }
  for (const m of file.nocomment.matchAll(/(?:^|[\n;])\s*import\s*(['"])([^'"\n]+)\1/g)) add(m[2], "", m.index, false);
  for (const m of file.nocomment.matchAll(/\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g)) add(m[2], "", m.index, false);
  return imports;
}

function resolveImport(project, from, spec) {
  let bases;
  if (spec.startsWith("@/") || spec.startsWith("~/")) {
    bases = [path.join(project.root, spec.slice(2)), path.join(project.root, "src", spec.slice(2))];
  } else if (spec.startsWith(".")) {
    bases = [path.resolve(path.dirname(from.abs), spec)];
  } else {
    return null;
  }
  const suffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", "/index.ts", "/index.tsx", "/index.js"];
  for (const base of bases) {
    for (const suffix of suffixes) {
      const hit = project.byAbs.get(base + suffix);
      if (hit) return hit;
    }
  }
  return null;
}

function importChain(project, start, maxDepth = 3) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next = [];
    for (const file of frontier) {
      for (const imp of file.imports) {
        const target = resolveImport(project, file, imp.spec);
        if (target && !seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

// A POST Route Handler that n8n calls. One that only calls n8n (a non-React caller, allowed by
// the contract) is not a callback, unless it also reads the callback headers or secret.
function isCallbackRoute(project, file) {
  if (!ROUTE_FILE.test(file.rel)) return false;
  if (!/export\s+(?:async\s+)?function\s+POST\b|export\s+const\s+POST\b|export\s*\{[^}]*\bPOST\b/.test(file.code)) return false;
  if (N8N_ROUTE_DIR.test(file.rel)) return true;
  if (/x-n8n-signature|x-n8n-timestamp|N8N_CALLBACK_SECRET/i.test(file.nocomment)) return true;
  const caller =
    file.n8nFetches.length > 0 ||
    file.imports.some((imp) => CLIENT_MODULE.test(resolveImport(project, file, imp.spec)?.rel ?? "") || /n8n\/client$/.test(imp.spec));
  return !caller && (/n8n|callback|webhook/i.test(file.rel) || /\bn8n\b/i.test(file.text));
}

function loadProject(root) {
  const files = walk(root).map((abs) => loadSource(root, abs)).filter(Boolean);
  const project = { root, files, byAbs: new Map(files.map((f) => [f.abs, f])), env: loadEnvExample(root) };
  for (const file of files) {
    file.directive = /^\s*(?:#![^\n]*\n\s*)?(['"])use (server|client)\1/.exec(file.nocomment)?.[2] ?? null;
    file.imports = parseImports(file);
    const fetches = findCalls(file, "(?:globalThis\\.|window\\.)?fetch|axios(?:\\.[\\w$]+)?");
    const webhookEnv = /\bN8N_WEBHOOK_\w*/.test(file.nocomment);
    file.n8nFetches = CLIENT_MODULE.test(file.rel)
      ? fetches
      : fetches.filter((call) => webhookEnv || N8N_HINT.test(call.argsNc));
  }
  project.clients = files.filter((f) => CLIENT_MODULE.test(f.rel));
  project.n8nLib = files.filter((f) => N8N_LIB.test(f.rel));
  project.callers = files.filter((f) => f.n8nFetches.length > 0);
  project.routes = files.filter((file) => isCallbackRoute(project, file));
  project.chains = new Map(project.routes.map((route) => [route, importChain(project, route)]));
  return project;
}

// ---------------------------------------------------------------------------
// Small parsing helpers
// ---------------------------------------------------------------------------

function lineOf(file, offset) {
  const starts = file.lineStarts;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function at(file, offset, message) {
  return { file: file.rel, line: lineOf(file, offset), message };
}

function matchClose(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findCalls(file, callee) {
  const re = new RegExp(`(?<![\\w$.])(?:${callee})\\s*\\(`, "g");
  const calls = [];
  for (const m of file.code.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(file.code, open);
    const end = close === -1 ? file.code.length : close;
    calls.push({
      start: m.index,
      open,
      close: end,
      args: file.code.slice(open + 1, end),
      argsNc: file.nocomment.slice(open + 1, end),
      line: lineOf(file, m.index),
    });
  }
  return calls;
}

// The "{" that opens a function body after its parameter list (skips a return type).
function findBodyBrace(code, closeParen) {
  let depth = 0;
  let prev = ")";
  for (let i = closeParen + 1; i < code.length; i++) {
    const c = code[i];
    if (c === "=" && code[i + 1] === ">") {
      i++;
      prev = ">";
      continue;
    }
    if (c === "(" || c === "[" || c === "<") depth++;
    else if (c === ")" || c === "]" || c === ">") depth--;
    else if (c === "{") {
      if (depth <= 0 && !":|&,<=".includes(prev)) return i;
      const close = matchClose(code, i);
      if (close === -1) return -1;
      i = close;
      prev = "}";
      continue;
    } else if (c === ";") return -1;
    if (!/\s/.test(c)) prev = c;
  }
  return -1;
}

function handlerSpan(file, name) {
  const re = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(|export\\s+const\\s+${name}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?\\(`,
  );
  const m = re.exec(file.code);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = matchClose(file.code, open);
  if (close === -1) return null;
  const param = /^\s*([A-Za-z_$][\w$]*)/.exec(file.code.slice(open + 1, close))?.[1] ?? null;
  const bodyStart = findBodyBrace(file.code, close);
  if (bodyStart === -1) return null;
  const bodyEnd = matchClose(file.code, bodyStart);
  return { line: lineOf(file, m.index), param, bodyStart, bodyEnd: bodyEnd === -1 ? file.code.length : bodyEnd };
}

function topLevelDeclarations(file) {
  const code = file.code;
  const depth = new Int32Array(code.length + 1);
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    depth[i] = d;
    if (code[i] === "{") d++;
    else if (code[i] === "}") d = Math.max(0, d - 1);
  }
  depth[code.length] = d;
  const exportedLater = new Set();
  for (const m of code.matchAll(/(?<![\w$.])export\s*\{([^}]*)\}/g)) {
    if (depth[m.index] !== 0) continue;
    for (const part of m[1].split(",")) {
      const name = /^\s*([\w$]+)/.exec(part)?.[1];
      if (name) exportedLater.add(name);
    }
  }
  for (const m of code.matchAll(/(?<![\w$.])export\s+default\s+([\w$]+)\s*;?\s*$/gm)) exportedLater.add(m[1]);
  const decls = [];
  const re = /(?<![\w$.])(export\s+(?:default\s+)?)?(?:(?:async\s+)?function\s*\*?\s*|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)/g;
  for (const m of code.matchAll(re)) {
    if (depth[m.index] !== 0) continue;
    decls.push({ name: m[2], start: m.index, exported: Boolean(m[1]) || exportedLater.has(m[2]) });
  }
  return { decls, depth };
}

function parseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isLocalHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  return (
    ["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"].includes(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".test")
  );
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRel(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// --changed-since: files and lines changed since a git ref (+ untracked files)
// ---------------------------------------------------------------------------

function gitChanges(root, ref) {
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  } catch {
    usageError(`--changed-since: "${ref}" is not a commit in ${root} (is it a git repository?)`);
  }
  const changed = new Map();
  const diff = git(["-c", "core.quotePath=false", "diff", "--relative", "--no-renames", "--no-color", "--no-ext-diff", "-U0", ref, "--"]);
  let current = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      let target = line.slice(4).replace(/\t$/, "");
      if (target.startsWith('"')) target = target.slice(1, -1).replace(/\\(.)/g, "$1");
      current = target === "/dev/null" ? null : target.replace(/^b\//, "");
      if (current && !changed.has(current)) changed.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const lines = changed.get(current);
      for (let k = 0; k < count; k++) lines.add(start + k);
    }
  }
  for (const rel of git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0")) {
    if (rel) changed.set(rel, "all");
  }
  return changed;
}

function inScope(finding, changed) {
  if (!changed) return true;
  const lines = changed.get(finding.file);
  if (!lines) return false;
  if (lines === "all" || finding.line == null) return true;
  return lines.has(finding.line);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `check-contract: static check of a Next.js project against the team's
Next.js <-> n8n webhook contract (skill integrating-n8n-webhooks). Zero dependencies.

Usage:
  node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs [options]

Options:
  --root <dir>            Project to check (default: the current directory).
  --changed-since <ref>   Report only findings in lines changed since the git <ref>
                          (committed, staged and unstaged changes, plus new untracked
                          files). A finding about a whole file counts if the file changed.
                          Without it, the whole project is checked.
  -h, --help              Show this help.

Reads source files (${[...SOURCE_EXTENSIONS].join(" ")}) and .env.example only. Skips
${[...SKIP_DIRS].join(", ")}
and the skill's own scripts (mock-n8n.mjs…). Never opens .env.local or other .env* files.
Prints file:line and a message, never code, request bodies or secret values.

Checks (each prints PASS, FAIL or SKIP; SKIP = the project has nothing of that kind):
${CHECKS.map((c) => `  ${c.id.padEnd(4)}${c.slug.padEnd(22)}${c.title}`).join("\n")}

The checks are static heuristics: they read the code, they don't run it. C8 follows direct
calls and one level of helpers in the same file; C10-C13 follow the callback route's
imports three levels deep.

Exit code: 0 no FAIL · 1 at least one FAIL · 2 usage error (bad option, missing --root,
unknown git ref).
`;

function usageError(message) {
  console.error(`check-contract: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        root: { type: "string", default: "." },
        "changed-since": { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    usageError(error.message);
  }
  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  const root = path.resolve(args.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) usageError(`--root ${args.root} is not a directory`);

  const ref = args["changed-since"];
  const changed = ref ? gitChanges(root, ref) : null;
  const project = loadProject(root);

  const scope = changed ? `changes since ${ref} (${changed.size} file${changed.size === 1 ? "" : "s"})` : "all files";
  console.log(`check-contract (integrating-n8n-webhooks) · root ${root} · ${project.files.length} source files · scope: ${scope}`);
  console.log("");

  const totals = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const check of CHECKS) {
    let result;
    try {
      result = check.run(project);
    } catch (error) {
      result = { findings: [{ file: "(checker)", line: null, message: `internal error: ${error.message}` }] };
    }
    const head = (status, extra = "") => console.log(`${status}  ${check.id.padEnd(4)}${check.slug.padEnd(22)}${check.title}${extra}`);
    if (result.skip) {
      totals.SKIP++;
      head("SKIP", ` (${result.skip})`);
      continue;
    }
    const merged = mergeFindings(result.findings);
    const kept = merged.filter((f) => inScope(f, changed));
    const hidden = merged.length - kept.length;
    const note = hidden ? ` (${hidden} more in unchanged code)` : "";
    if (!kept.length) {
      totals.PASS++;
      head("PASS", note);
      continue;
    }
    totals.FAIL++;
    head("FAIL", note);
    for (const f of kept) console.log(`        ${f.file}${f.line == null ? "" : `:${f.line}`}  ${f.message}`);
  }

  console.log("");
  console.log(`${CHECKS.length} checks: ${totals.PASS} PASS · ${totals.FAIL} FAIL · ${totals.SKIP} SKIP`);
  process.exit(totals.FAIL ? 1 : 0);
}

function mergeFindings(findings) {
  const byKey = new Map();
  for (const f of findings) {
    const key = `${f.file}\0${f.line ?? ""}`;
    const seen = byKey.get(key);
    if (!seen) byKey.set(key, { ...f, messages: [f.message] });
    else if (!seen.messages.includes(f.message)) seen.messages.push(f.message);
  }
  return [...byKey.values()]
    .map((f) => ({ file: f.file, line: f.line, message: f.messages.join("; ") }))
    .sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
}

main();
