#!/usr/bin/env node
// send-signed-callback — sends a matrix of n8n-style signed callbacks to your callback route and
// compares the status codes with the contract. Node only, no dependencies.
//
//   node --env-file=.env.local send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request [options]
//
// Exit code: 0 — every case got the expected status; 1 — at least one did not; 2 — usage error.
import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback — check a callback route against the n8n contract

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [options]

Options:
  --url <url>            Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request (required).
  --event <name>         "event" in the body (default: <last path segment>.completed).
  --request-key <key>    data.requestIdempotencyKey — the idempotency-key your app sent to n8n for an
                         existing record. Without it the "valid" case may get 404 (record not found).
  --document-url <url>   data.result.documentUrl (default https://files.example.test/n8n/<jobId>.pdf).
  --only <ids>           Run only these cases, comma-separated (e.g. bad-signature,stale).
  -h, --help             Show this help.

Environment:
  N8N_CALLBACK_SECRET    HMAC secret, the same as in the app. Never pass it as a flag.

Cases (expected status):
  unknown-event      404  POST to <url>-does-not-exist
  wrong-type         415  content-type text/plain
  too-large          413  signed body > 64 KB
  bad-signature      401  signature made with another secret
  stale              401  x-n8n-timestamp 301 s in the past
  reformatted        401  body pretty-printed after signing
  key-mismatch       400  valid signature, idempotency-key does not match data.jobId
  valid              202  correct callback
  duplicate          200  the same callback again ({"duplicate": true})

Values of secrets and signatures are never printed.
`;

const argv = process.argv.slice(2);
const opts = {};
const FLAGS = { "--url": "url", "--event": "event", "--request-key": "requestKey", "--document-url": "documentUrl", "--only": "only" };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  }
  const key = FLAGS[a];
  if (!key || argv[i + 1] === undefined) {
    process.stderr.write(`Bad argument: ${a}\n\n${HELP}`);
    process.exit(2);
  }
  opts[key] = argv[++i];
}
if (!opts.url) {
  process.stderr.write(`--url is required\n\n${HELP}`);
  process.exit(2);
}
const secret = process.env.N8N_CALLBACK_SECRET;
if (!secret) {
  process.stderr.write("N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local …)\n");
  process.exit(2);
}

const url = new URL(opts.url);
const pathEvent = url.pathname.split("/").filter(Boolean).at(-1);
const event = opts.event ?? `${pathEvent}.completed`;
const now = () => Math.floor(Date.now() / 1000);
const sign = (timestamp, raw, key) => `sha256=${createHmac("sha256", key).update(`${timestamp}.${raw}`).digest("hex")}`;

function callback(jobId, extra = {}) {
  return {
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId: randomUUID(),
      requestIdempotencyKey: opts.requestKey ?? randomUUID(),
      result: { documentUrl: opts.documentUrl ?? `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...extra,
    },
  };
}

function signedRequest(body, { timestamp = now(), key, signWith = secret, sendBody, contentType = "application/json" } = {}) {
  const raw = JSON.stringify(body);
  return {
    headers: {
      "content-type": contentType,
      "x-n8n-timestamp": String(timestamp),
      "x-n8n-signature": sign(timestamp, raw, signWith),
      "idempotency-key": key ?? `${body.data.jobId}:${body.event}`,
      "x-correlation-id": body.data.correlationId,
    },
    body: sendBody ?? raw,
  };
}

const validRequest = signedRequest(callback(randomUUID()));
const reformattedBody = callback(randomUUID());
const cases = [
  { id: "unknown-event", expect: 404, target: `${url.origin}${url.pathname}-does-not-exist`, ...signedRequest(callback(randomUUID())) },
  { id: "wrong-type", expect: 415, ...signedRequest(callback(randomUUID()), { contentType: "text/plain" }) },
  { id: "too-large", expect: 413, ...signedRequest(callback(randomUUID(), { padding: "x".repeat(70 * 1024) })) },
  { id: "bad-signature", expect: 401, ...signedRequest(callback(randomUUID()), { signWith: "not-the-secret" }) },
  { id: "stale", expect: 401, ...signedRequest(callback(randomUUID()), { timestamp: now() - 301 }) },
  { id: "reformatted", expect: 401, ...signedRequest(reformattedBody, { sendBody: JSON.stringify(reformattedBody, null, 2) }) },
  { id: "key-mismatch", expect: 400, ...signedRequest(callback(randomUUID()), { key: `${randomUUID()}:${event}` }) },
  { id: "valid", expect: 202, ...validRequest },
  { id: "duplicate", expect: 200, ...validRequest, check: (text) => /"duplicate"\s*:\s*true/.test(text) },
];

const only = opts.only ? new Set(opts.only.split(",")) : null;
let failed = 0;
console.log(`send-signed-callback → ${url.origin}${url.pathname} (event ${event})\n`);
console.log("case            expected  got      result");
for (const c of cases) {
  if (only && !only.has(c.id)) continue;
  let got = "ERR";
  let ok = false;
  try {
    const response = await fetch(c.target ?? url, {
      method: "POST",
      headers: c.headers,
      body: c.body,
      signal: AbortSignal.timeout(10_000),
    });
    got = response.status;
    const text = await response.text();
    ok = got === c.expect && (!c.check || c.check(text));
  } catch (error) {
    got = error.name === "TimeoutError" ? "timeout" : "network";
  }
  if (!ok) failed++;
  console.log(`${c.id.padEnd(16)}${String(c.expect).padEnd(10)}${String(got).padEnd(9)}${ok ? "PASS" : "FAIL"}`);
}
console.log(`\n${failed === 0 ? "all cases match the contract" : `${failed} case(s) differ from the contract`}`);
if (!opts.requestKey) console.log("note: no --request-key — a 404 on 'valid' can mean «record not found», not a bug");
process.exit(failed === 0 ? 0 : 1);
