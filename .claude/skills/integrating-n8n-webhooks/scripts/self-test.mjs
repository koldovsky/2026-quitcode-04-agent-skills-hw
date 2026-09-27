#!/usr/bin/env node
// self-test.mjs — regression suite for check-contract.mjs (skill integrating-n8n-webhooks).
// Builds small projects in a temp folder, runs check-contract.mjs on each and compares every
// C1–C13 verdict with the expected one. Node built-ins only; nothing is written outside the temp
// folder, which is removed afterwards. Fixtures are strings here, not .ts files, so the project's
// TypeScript and ESLint never see the deliberately bad code.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HELP = `self-test.mjs — checks that check-contract.mjs still finds what it must and passes what it must

Usage:
  node self-test.mjs [--keep]

Options:
  --keep       Keep the temp folder with the fixture projects (its path is printed).
  -h, --help   Show this help.

Cases: main-like code (C1 C3 C5 C6 C11 C13 FAIL), deliberately bad code (all 13 FAIL, the secret
value is not printed), the templates from references/code-templates.md (LF, CRLF, src/ layout:
0 FAIL), C5 with a timeout elsewhere in the file or on another name (FAIL) or in a variable
(PASS), --changed-since (only the new file's FAILs; also with Cyrillic names and spaces in names;
needs git), CLI exit codes (--help, unknown option, missing --root, unknown ref).

Exit code: 0 — every case as expected, 1 — at least one case differs.
`;

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(HELP);
  process.exit(0);
}
const keep = args.includes("--keep");

const here = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(here, "check-contract.mjs");
const TEMPLATES_MD = join(here, "..", "references", "code-templates.md");
const ALL = Array.from({ length: 13 }, (_, i) => `C${i + 1}`);

// ── Fixtures ────────────────────────────────────────────────────────────────

const GOOD_ENV = [
  "N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook",
  "N8N_WEBHOOK_TOKEN=change-me-webhook-token",
  "N8N_CALLBACK_SECRET=change-me-callback-secret",
  "APP_BASE_URL=http://127.0.0.1:3000",
  "",
].join("\n");

// Shaped like LeadDesk main: the public form awaits a bare fetch to the test URL.
const MAIN_LIKE = {
  "app/actions.ts": `"use server";

import { db } from "@/lib/db";

export async function submitLead(_prev: unknown, formData: FormData) {
  const lead = await db.insertLead(Object.fromEntries(formData));
  try {
    await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (error) {
    console.error(\`Failed to send lead \${lead.id} to n8n\`, error);
  }
  return { status: "ok" };
}
`,
  ".env.example": "N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created\n",
};

// A placeholder-looking-but-not-change-me value: C11 must flag it without printing it.
const FAKE_SECRET = "not-a-placeholder-fixture-value";

// Every check has something to find.
const BAD = {
  ".env.example": [
    "N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook-test",
    `N8N_WEBHOOK_TOKEN=${FAKE_SECRET}`,
    "NEXT_PUBLIC_N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request",
    "",
  ].join("\n"),
  "components/quote-button.tsx": `"use client";
export const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
`,
  "lib/n8n/client.ts": `export async function sendQuote(data: Record<string, unknown>) {
  const token = process.env.N8N_WEBHOOK_TOKEN;
  console.info("sending to n8n with token", token);
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/quote-request\`, { method: "POST", headers: { "x-n8n-token": token ?? "" }, body: JSON.stringify(data) });
}
`,
  "app/quotes/actions.ts": `"use server";
import { sendQuote } from "@/lib/n8n/client";

export async function requestQuote(_prev: unknown, formData: FormData) {
  const res = await sendQuote(Object.fromEntries(formData));
  await fetch(process.env.N8N_WEBHOOK_BASE_URL + "/quote-audit", { method: "POST", body: "{}" });
  return { status: res.ok ? "ok" : "error" };
}
`,
  "app/api/n8n/[event]/route.ts": `export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json();
  const signature = request.headers.get("x-n8n-signature");
  const expected = "sha256=" + String(body.hash);
  if (signature !== expected) return new Response("bad signature", { status: 401 });
  console.log("callback", body);
  return Response.json({ ok: true }, { status: 202 });
}
`,
};

const HEADERS_OK = `{ "x-n8n-token": "t", "idempotency-key": "k", "x-correlation-id": "c" }`;

// C5: a timeout somewhere in the file must not count for a request that does not use it.
const TIMEOUT_ELSEWHERE = {
  "lib/n8n/client.ts": `import "server-only";

const unused = AbortSignal.timeout(10_000);
const controller = new AbortController();

export function ping() {
  void unused;
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/ping\`, { method: "POST", headers: ${HEADERS_OK}, signal: controller.signal });
}
`,
  ".env.example": GOOD_ENV,
};

// C5: the timeout in a variable — shorthand { signal } and signal: <name> — is fine.
const TIMEOUT_VARIABLE = {
  "lib/n8n/client.ts": `import "server-only";

export function ping() {
  const signal = AbortSignal.timeout(10_000);
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/ping\`, {
    method: "POST",
    headers: ${HEADERS_OK},
    signal,
  });
}

export function pong() {
  const deadline = AbortSignal.timeout(10_000);
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/pong\`, { method: "POST", headers: ${HEADERS_OK}, signal: deadline });
}
`,
  ".env.example": GOOD_ENV,
};

// C5: a typed declaration of the same name without a timeout, next to a timeout for another name.
const TIMEOUT_TYPED_NAME = {
  "lib/n8n/client.ts": `import "server-only";

let signal: AbortSignal | undefined;
const other = AbortSignal.timeout(10_000);

export function ping() {
  void other;
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/ping\`, { method: "POST", headers: ${HEADERS_OK}, signal });
}
`,
  ".env.example": GOOD_ENV,
};

// --changed-since with spaces in file names: git ends such "+++ " lines with a TAB, and quotes the
// name if it is also non-ASCII ("+++ \\"b/lib/n8n/\\320… \\320…\\"<TAB>").
const SPACES_BASE = {
  ...MAIN_LIKE,
  "lib/n8n/with space.ts": `import "server-only";\n\nexport const version = 1;\n`,
  "lib/n8n/з пробілом.ts": `import "server-only";\n\nexport const version = 1;\n`,
};
const SPACES_CHANGES = {
  // the new line: a fetch without a timeout → C5
  "lib/n8n/with space.ts": `import "server-only";

export const version = 1;
export const send = () =>
  fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/x\`, { method: "POST", headers: ${HEADERS_OK} });
`,
  // import "server-only" removed → C4
  "lib/n8n/з пробілом.ts": "export const version = 2;\n",
};

// --changed-since with non-ASCII file names: git prints them quoted ("lib/n8n/\\320…").
const CYRILLIC_BASE = { ...MAIN_LIKE, "lib/n8n/відправка.ts": `import "server-only";\n\nexport const version = 1;\n` };
const CYRILLIC_CHANGES = {
  // tracked, changed after base: the new line has a fetch without a timeout → C5
  "lib/n8n/відправка.ts": `import "server-only";

export const version = 1;
export const send = () =>
  fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/x\`, { method: "POST", headers: ${HEADERS_OK} });
`,
  // untracked: no import "server-only" → C4
  "lib/n8n/клієнт.ts": "export const base = process.env.N8N_WEBHOOK_BASE_URL;\n",
};
// Git's own env config: quote non-ASCII paths whatever the user's core.quotePath is.
const QUOTED_PATHS_ENV = { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.quotePath", GIT_CONFIG_VALUE_0: "true" };

// Added after the base commit in the --changed-since case.
const NEW_CLIENT = {
  "lib/n8n/client.ts": `export async function trigger(data: unknown) {
  return fetch(\`\${process.env.N8N_WEBHOOK_BASE_URL}/quote-request\`, { method: "POST", body: JSON.stringify(data) });
}
`,
  ".env.example": GOOD_ENV,
};

// The skill's own templates: if a template drifts from the contract, this case fails.
function templateFiles() {
  const md = readFileSync(TEMPLATES_MD, "utf8").replace(/\r\n/g, "\n");
  const files = {};
  for (const section of md.split(/^## /m).slice(1)) {
    const heading = section.slice(0, section.indexOf("\n"));
    const path = /^`([^`]+)`/.exec(heading)?.[1] ?? (heading.startsWith("Server Action") ? "app/quotes/actions.ts" : null);
    const code = /```ts\n([\s\S]*?)\n```/.exec(section)?.[1];
    if (path && code) files[path] = `${code}\n`;
  }
  for (const path of ["lib/n8n/client.ts", "lib/n8n/idempotency.ts", "app/api/n8n/[event]/route.ts", "app/quotes/actions.ts"]) {
    if (!files[path]) throw new Error(`references/code-templates.md: no template for ${path}`);
  }
  return { ...files, ".env.example": GOOD_ENV };
}

const crlf = (files) => Object.fromEntries(Object.entries(files).map(([p, c]) => [p, c.replace(/\n/g, "\r\n")]));
const underSrc = (files) =>
  Object.fromEntries(Object.entries(files).map(([p, c]) => [p === ".env.example" ? p : `src/${p}`, c]));

// ── Runner ──────────────────────────────────────────────────────────────────

const root = mkdtempSync(join(tmpdir(), "check-contract-self-test-"));
let failures = 0;

function writeProject(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

function runChecker(extraArgs, env = process.env) {
  const r = spawnSync(process.execPath, [CHECKER, ...extraArgs], { encoding: "utf8", env });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function verdicts(out) {
  const failed = [...out.matchAll(/^(C\d+)\s+FAIL\b/gm)].map((m) => m[1]);
  const passed = [...out.matchAll(/^(C\d+)\s+PASS\b/gm)].map((m) => m[1]);
  return { failed, seen: [...passed, ...failed] };
}

function report(ok, name, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(38)} ${detail}`);
}

function expectCase(name, dir, expectFail, { args: extraArgs = [], notPrinted = [], env } = {}) {
  const { code, out } = runChecker(["--root", dir, ...extraArgs], env);
  const { failed, seen } = verdicts(out);
  const missing = ALL.filter((id) => !seen.includes(id));
  const sameFails = failed.length === expectFail.length && expectFail.every((id) => failed.includes(id));
  const leaked = notPrinted.filter((s) => out.includes(s));
  const wantCode = expectFail.length ? 1 : 0;
  const ok = sameFails && missing.length === 0 && code === wantCode && leaked.length === 0;
  const detail = ok
    ? `${13 - failed.length} PASS, ${failed.length} FAIL, exit ${code}`
    : [
        !sameFails && `FAIL expected [${expectFail.join(" ")}] got [${failed.join(" ")}]`,
        missing.length && `no verdict for ${missing.join(" ")}`,
        code !== wantCode && `exit ${code}, expected ${wantCode}`,
        leaked.length && "a secret value was printed",
      ]
        .filter(Boolean)
        .join("; ");
  report(ok, name, detail);
}

function expectExit(name, extraArgs, wantCode) {
  const { code } = runChecker(extraArgs);
  report(code === wantCode, name, `exit ${code}${code === wantCode ? "" : `, expected ${wantCode}`}`);
}

function git(dir, ...gitArgs) {
  const r = spawnSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=self-test", "-c", "user.email=self-test@example.test", ...gitArgs], {
    cwd: dir,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`git ${gitArgs[0]} failed`);
}

try {
  console.log(`check-contract self-test · ${CHECKER}\n`);

  const cases = [
    ["main-like (LeadDesk main)", MAIN_LIKE, ["C1", "C3", "C5", "C6", "C11", "C13"]],
    ["deliberately bad code", BAD, ALL, { notPrinted: [FAKE_SECRET] }],
    ["templates (LF)", templateFiles(), []],
    ["templates (CRLF)", crlf(templateFiles()), []],
    ["templates (src/ layout)", underSrc(templateFiles()), []],
    ["C5: timeout elsewhere in the file", TIMEOUT_ELSEWHERE, ["C5"]],
    ["C5: timeout in a variable", TIMEOUT_VARIABLE, []],
    ["C5: typed name, timeout for another", TIMEOUT_TYPED_NAME, ["C5"]],
  ];
  for (const [name, files, expectFail, options] of cases) {
    const dir = join(root, name.replace(/[^a-z0-9]+/gi, "-"));
    writeProject(dir, files);
    expectCase(name, dir, expectFail, options);
  }

  // --changed-since: old violations of main-like code are hidden, the new file's are shown.
  const hasGit = spawnSync("git", ["--version"]).status === 0;
  if (hasGit) {
    const dir = join(root, "changed-since");
    writeProject(dir, MAIN_LIKE);
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    git(dir, "tag", "base");
    writeProject(dir, NEW_CLIENT);
    expectCase("--changed-since base", dir, ["C4", "C5", "C6"], { args: ["--changed-since", "base"] });
    expectExit("--changed-since <unknown ref>", ["--root", dir, "--changed-since", "no-such-ref"], 2);

    const cyr = join(root, "changed-since-cyrillic");
    writeProject(cyr, CYRILLIC_BASE);
    git(cyr, "init", "-q");
    git(cyr, "add", "-A");
    git(cyr, "commit", "-qm", "base");
    git(cyr, "tag", "base");
    writeProject(cyr, CYRILLIC_CHANGES);
    expectCase("--changed-since, Cyrillic file names", cyr, ["C4", "C5"], { args: ["--changed-since", "base"], env: QUOTED_PATHS_ENV });

    const spaces = join(root, "changed-since-spaces");
    writeProject(spaces, SPACES_BASE);
    git(spaces, "init", "-q");
    git(spaces, "add", "-A");
    git(spaces, "commit", "-qm", "base");
    git(spaces, "tag", "base");
    writeProject(spaces, SPACES_CHANGES);
    expectCase("--changed-since, spaces in file names", spaces, ["C4", "C5"], { args: ["--changed-since", "base"], env: QUOTED_PATHS_ENV });
  } else {
    console.log("skip  --changed-since                     git not found");
  }

  expectExit("--help", ["--help"], 0);
  expectExit("unknown option", ["--no-such-option"], 2);
  expectExit("--root that does not exist", ["--root", join(root, "missing")], 2);
} catch (error) {
  failures++;
  console.log(`FAIL  self-test aborted: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (keep) console.log(`\nfixtures kept in ${root}`);
  else rmSync(root, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} case(s) differ` : "\nall cases as expected");
process.exitCode = failures ? 1 : 0;
