#!/usr/bin/env node
// send-signed-callback — sends a fixed matrix of callbacks, signed like n8n does it, to a
// Next.js callback route and compares the HTTP status with the team contract.
//
//   node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs \
//     --url http://127.0.0.1:3000/api/n8n/quote-request --request-key <idempotency key of a real job>
//
// Without --request-key only the negative cases run (nothing in the app changes).
// The secret comes from N8N_CALLBACK_SECRET in the environment only - never from a flag.
// Exit code: 0 = every case matched, 1 = at least one mismatch, 2 = usage error.
// Zero dependencies (node: built-ins + global fetch). Prints statuses only, never the secret or signatures.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const HELP = `send-signed-callback: signed-callback matrix against a Next.js route (n8n -> Next.js contract)

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [--request-key <key>] [options]

Options:
  --url <url>            Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request (required)
  --request-key <key>    idempotency-key of the request that started a real job (for quotes: the quote id).
                         Enables the positive cases: valid (202), replay with the same key
                         (200 {"duplicate":true}) and replay with a fresh key (400).
                         Note: the valid case completes that job in the app.
  --event <name>         "event" in the body (default: <last path segment>.completed)
  --only <a,b,...>       Run only these cases (names from the table)
  -h, --help             Show this help

Environment:
  N8N_CALLBACK_SECRET    Same value as the Hmac Secret of the n8n Crypto credential.

Signature (team contract):
  x-n8n-timestamp: <unix seconds>
  x-n8n-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
  idempotency-key: <jobId>:<event>   (the same values as data.jobId and event in the body)
`;

let args;
try {
  args = parseArgs({
    options: {
      url: { type: "string" },
      "request-key": { type: "string" },
      event: { type: "string" },
      only: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  }).values;
} catch (error) {
  console.error(`send-signed-callback: ${error.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const secret = process.env.N8N_CALLBACK_SECRET ?? "";
if (!args.url) {
  console.error(`send-signed-callback: --url is required\n\n${HELP}`);
  process.exit(2);
}
if (!secret) {
  console.error("send-signed-callback: N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local ...)");
  process.exit(2);
}

let target;
try {
  target = new URL(args.url);
} catch {
  console.error("send-signed-callback: --url must be an absolute http(s) URL");
  process.exit(2);
}
const pathEvent = target.pathname.split("/").filter(Boolean).pop() ?? "event";
const event = args.event ?? `${pathEvent}.completed`;
const requestKey = args["request-key"] ?? null;
const unknownEventUrl = new URL(target);
unknownEventUrl.pathname = target.pathname.replace(/[^/]+\/?$/, "unknown-event-check");

const now = () => Math.floor(Date.now() / 1000);
const sign = (key, ts, raw) => `sha256=${createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex")}`;

function payload(jobId, extra = {}) {
  return {
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId: randomUUID(),
      requestIdempotencyKey: requestKey ?? randomUUID(),
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...extra,
    },
  };
}

// Each case builds one request. `sign` decides what is signed; `raw` is what is sent.
function request({ url = target, jobId = randomUUID(), body, raw, ts = String(now()), signWith = secret, signedRaw, contentType = "application/json", signature, key }) {
  const sent = raw ?? JSON.stringify(body ?? payload(jobId));
  const headers = {
    "content-type": contentType,
    "x-n8n-timestamp": ts,
    "idempotency-key": key ?? `${jobId}:${event}`,
    "x-correlation-id": randomUUID(),
  };
  const sig = signature === undefined ? sign(signWith, ts, signedRaw ?? sent) : signature;
  if (sig !== null) headers["x-n8n-signature"] = sig;
  return { url, init: { method: "POST", headers, body: sent } };
}

const negative = [
  {
    name: "wrong-content-type",
    expect: 415,
    why: "only application/json is accepted",
    build: () => request({ contentType: "text/plain" }),
  },
  {
    name: "oversized-body",
    expect: 413,
    why: "callbacks carry links, not files (limit 64 KB)",
    build: () => {
      const jobId = randomUUID();
      return request({ jobId, body: payload(jobId, { padding: "x".repeat(70 * 1024) }) });
    },
  },
  { name: "missing-signature", expect: 401, why: "no x-n8n-signature header", build: () => request({ signature: null }) },
  { name: "bad-signature", expect: 401, why: "random hex instead of the HMAC", build: () => request({ signature: `sha256=${randomBytes(32).toString("hex")}` }) },
  { name: "short-signature", expect: 401, why: "wrong length must not crash timingSafeEqual", build: () => request({ signature: "sha256=abcd" }) },
  { name: "wrong-secret", expect: 401, why: "signed with another secret", build: () => request({ signWith: `${secret}-wrong` }) },
  { name: "stale-timestamp", expect: 401, why: "timestamp 10 min old (window 300 s)", build: () => request({ ts: String(now() - 600) }) },
  { name: "future-timestamp", expect: 401, why: "timestamp 10 min ahead (window 300 s)", build: () => request({ ts: String(now() + 600) }) },
  { name: "non-numeric-timestamp", expect: 401, why: "x-n8n-timestamp is not unix seconds", build: () => request({ ts: "yesterday" }) },
  {
    name: "reserialized-body",
    expect: 401,
    why: "signed compact JSON, sent pretty-printed JSON (same data, other bytes)",
    build: () => {
      const body = payload(randomUUID());
      return request({ raw: JSON.stringify(body, null, 2), signedRaw: JSON.stringify(body) });
    },
  },
  { name: "malformed-json", expect: 400, why: "valid signature over a body that is not JSON", build: () => request({ raw: '{"version":1,"event":' }) },
  { name: "unknown-event", expect: 404, why: "valid signature, route for an event the app does not handle", build: () => request({ url: unknownEventUrl }) },
];

const validJob = randomUUID();
const validKey = `${validJob}:${event}`;
let captured = null; // the exact bytes, timestamp and signature of the "valid" case
const positive = [
  {
    name: "valid",
    expect: 202,
    why: "fresh, correctly signed callback for a real job",
    build: () => (captured = request({ jobId: validJob, key: validKey })),
  },
  {
    name: "replay-same-key",
    expect: 200,
    why: "same idempotency-key again (n8n Retry On Fail): acknowledged, not applied twice",
    expectBody: /"duplicate"\s*:\s*true/,
    build: () => request({ jobId: validJob, key: validKey }),
  },
  {
    name: "replay-new-key",
    expect: 400,
    why: "captured callback replayed under a fresh key: the key must equal <jobId>:<event> from the signed body",
    build: () => {
      const source = captured ?? request({ jobId: validJob, key: validKey });
      return { url: source.url, init: { ...source.init, headers: { ...source.init.headers, "idempotency-key": `replay-${randomUUID()}` } } };
    },
  },
];

const only = args.only ? new Set(args.only.split(",").map((s) => s.trim())) : null;
let cases = [...negative, ...(requestKey ? positive : [])];
if (only) cases = cases.filter((c) => only.has(c.name));

console.log(`send-signed-callback -> ${target.origin}${target.pathname}  event=${event}`);
if (!requestKey) console.log("(positive cases skipped: pass --request-key <idempotency key of a real job> to run valid + replay)");
console.log("");

const rows = [];
for (const c of cases) {
  const { url, init } = c.build();
  let status;
  let body = "";
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    status = res.status;
    body = await res.text();
  } catch (error) {
    status = `error: ${error.cause?.code ?? error.name}`;
  }
  const ok = status === c.expect && (!c.expectBody || c.expectBody.test(body));
  rows.push({ name: c.name, expect: c.expect, status, ok, why: c.why });
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(22)} expected ${c.expect}  got ${status}${ok ? "" : c.expectBody && status === c.expect ? " (body lacks duplicate:true)" : ""}   ${c.why}`);
}

const failed = rows.filter((r) => !r.ok).length;
console.log(`\n${failed} failed, ${rows.length - failed} passed (${rows.length} cases)`);
process.exitCode = failed ? 1 : 0;
