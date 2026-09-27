#!/usr/bin/env node
// Sends a matrix of signed n8n callbacks to a callback route and compares the status codes
// with the contract (skill integrating-n8n-webhooks). Node built-ins only. The secret is read
// from N8N_CALLBACK_SECRET and never printed; bodies are never printed either.

import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback.mjs — does the callback route follow the contract?

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [options]

Options:
  --url <url>              Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request
  --job-id <id>            Also send a VALID callback for this job (then a duplicate of it).
  --request-key <key>      data.requestIdempotencyKey of the valid callback (the idempotency-key
                           the app sent to n8n). Required for the valid case to match a record.
  --correlation-id <id>    data.correlationId / x-correlation-id of the valid callback.
  --event <event>          Body event (default "<last path segment>.completed").
  -h, --help               Show this help.

Environment:
  N8N_CALLBACK_SECRET      HMAC secret (the same value the app uses). Required.

Cases (expected status):
  unknown event path            404     path "toString"             404
  wrong content-type            415
  body over 64 KB               413     timestamp 10 min old        401
  timestamp 10 min ahead        401     wrong signature             401
  signature without sha256=     401     body reformatted after signing  401
  valid signature, key != jobId:event   400
  valid signature, event of another path 400
  [--job-id] valid callback     202     [--job-id] same key again   200 {"duplicate":true}
  [--job-id] same bytes, new key        400

Exit code: 0 if every case got the expected status, 1 otherwise, 2 on usage errors.`;

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    console.log(HELP);
    process.exit(0);
  }
  const m = arg.match(/^--(url|job-id|request-key|correlation-id|event)$/);
  if (!m || !args[i + 1]) {
    console.error(`Unknown or incomplete argument: ${arg}\n\n${HELP}`);
    process.exit(2);
  }
  opts[m[1]] = args[++i];
}
const secret = process.env.N8N_CALLBACK_SECRET;
if (!opts.url || !secret) {
  console.error(`${!opts.url ? "--url is required" : "N8N_CALLBACK_SECRET is not set"}\n\n${HELP}`);
  process.exit(2);
}

const url = new URL(opts.url);
const path = url.pathname.split("/").filter(Boolean).pop();
const event = opts.event ?? `${path}.completed`;
const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw) => `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;

function bodyFor(jobId, { evt = event, requestKey = opts["request-key"] ?? randomUUID(), correlationId = opts["correlation-id"] ?? randomUUID() } = {}) {
  return JSON.stringify({
    version: 1,
    event: evt,
    data: {
      jobId,
      status: "completed",
      correlationId,
      requestIdempotencyKey: requestKey,
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
    },
  });
}

async function send({ target = url, raw, ts = now(), signature, key, contentType = "application/json" }) {
  const headers = {
    "content-type": contentType,
    "x-n8n-timestamp": String(ts),
    "x-n8n-signature": signature ?? sign(ts, raw),
    "idempotency-key": key,
    "x-correlation-id": opts["correlation-id"] ?? randomUUID(),
  };
  try {
    const res = await fetch(target, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    return { status: res.status, duplicate: /"duplicate"\s*:\s*true/.test(text) };
  } catch (error) {
    return { status: `error:${error.name}` };
  }
}

const cases = [];
const add = (name, expected, run, extra) => cases.push({ name, expected, run, extra });

const fakeJob = randomUUID();
const fakeRaw = bodyFor(fakeJob);
const fakeKey = `${fakeJob}:${event}`;
const otherPath = new URL(url);
otherPath.pathname = otherPath.pathname.replace(/[^/]+$/, "no-such-event-path");

add("unknown event path", 404, () => send({ target: otherPath, raw: fakeRaw, key: fakeKey }));
const protoPath = new URL(url);
protoPath.pathname = protoPath.pathname.replace(/[^/]+$/, "toString");
add("event path \"toString\" (Object.prototype key)", 404, () => send({ target: protoPath, raw: fakeRaw, key: fakeKey }));
add("wrong content-type", 415, () => send({ raw: fakeRaw, key: fakeKey, contentType: "text/plain" }));
add("body over 64 KB", 413, () => {
  const raw = JSON.stringify({ version: 1, event, data: { jobId: fakeJob, padding: "x".repeat(70 * 1024) } });
  return send({ raw, key: fakeKey });
});
add("timestamp 10 min old", 401, () => {
  const ts = now() - 600;
  return send({ raw: fakeRaw, ts, signature: sign(ts, fakeRaw), key: fakeKey });
});
add("timestamp 10 min ahead", 401, () => {
  const ts = now() + 600;
  return send({ raw: fakeRaw, ts, signature: sign(ts, fakeRaw), key: fakeKey });
});
add("wrong signature", 401, () => send({ raw: fakeRaw, signature: `sha256=${"0".repeat(64)}`, key: fakeKey }));
add("signature without sha256= prefix", 401, () => {
  const ts = now();
  return send({ raw: fakeRaw, ts, signature: sign(ts, fakeRaw).slice("sha256=".length), key: fakeKey });
});
add("body reformatted after signing", 401, () => {
  const ts = now();
  return send({ raw: JSON.stringify(JSON.parse(fakeRaw), null, 2), ts, signature: sign(ts, fakeRaw), key: fakeKey });
});
add("valid signature, key != jobId:event", 400, () => send({ raw: fakeRaw, key: `${randomUUID()}:${event}` }));
add("valid signature, event of another path", 400, () => {
  const evt = "some-other-event.completed";
  return send({ raw: bodyFor(fakeJob, { evt }), key: `${fakeJob}:${evt}` });
});

if (opts["job-id"]) {
  const job = opts["job-id"];
  const raw = bodyFor(job);
  const key = `${job}:${event}`;
  add("valid callback", 202, () => send({ raw, key }));
  add("same key again (n8n retry)", 200, () => send({ raw, key }), (r) => (r.duplicate ? "" : ' (no {"duplicate":true})'));
  add("same bytes, new key (replay)", 400, () => send({ raw, key: `${randomUUID()}:${event}` }));
}

console.log(`send-signed-callback · ${url.origin}${url.pathname} · event ${event} · ${cases.length} cases`);
let failures = 0;
for (const c of cases) {
  const result = await c.run();
  const problem = result.status !== c.expected ? "" : c.extra?.(result) ?? "";
  const ok = result.status === c.expected && !problem;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(40)} expected ${c.expected}, got ${result.status}${problem}`);
}
console.log(`\n${failures} FAIL, ${cases.length - failures} PASS`);
// exitCode, not process.exit(): exiting while fetch sockets close crashes Node on Windows.
process.exitCode = failures ? 1 : 0;
