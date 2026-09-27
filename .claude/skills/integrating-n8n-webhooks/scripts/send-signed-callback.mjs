#!/usr/bin/env node
// Matrix of n8n callbacks against a running callback route: every case has an expected status.
// Node built-ins only. The secret comes from the environment and is never printed.
import { createHmac, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const HELP = `send-signed-callback.mjs — send n8n-style callbacks to a running app and check the answers

Usage:
  node --env-file=.env.local send-signed-callback.mjs [--url <callback url>] [--event <event>]
       [--request-key <key>] [--job-id <id>]

Options:
  --url <url>           Callback endpoint (default http://127.0.0.1:3000/api/n8n/quote-request).
  --event <event>       Event of the path (default quote-request); the body event is <event>.completed.
  --request-key <key>   idempotency-key that the app sent to n8n for an EXISTING record
                        (data.requestIdempotencyKey). Enables the success cases; without it they
                        are skipped, because the app has nothing to update.
  --job-id <id>         data.jobId for the success cases (default: a new UUID).
  -h, --help            This help.

Environment: N8N_CALLBACK_SECRET (required; never printed).

Cases and expected status (contract, references/contract.md section 3):
  unknown event in the path ........ 404     wrong content-type ............. 415
  body larger than 64 KB ........... 413     timestamp 301 s in the past .... 401
  timestamp 301 s in the future .... 401     wrong signature ................ 401
  body reformatted after signing ... 401
  with --request-key:
  valid signed callback ............ 202     the same callback again ........ 200 {"duplicate":true}
  same signed bytes, new key ....... 400
Exit code 1 if any answer differs from the expectation, 2 on usage errors.
`;

let args;
try {
  args = parseArgs({
    options: {
      url: { type: "string", default: "http://127.0.0.1:3000/api/n8n/quote-request" },
      event: { type: "string", default: "quote-request" },
      "request-key": { type: "string" },
      "job-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
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
const secret = process.env.N8N_CALLBACK_SECRET;
if (!secret) {
  console.error("N8N_CALLBACK_SECRET is not set. Run: node --env-file=.env.local send-signed-callback.mjs …");
  process.exit(2);
}

const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw) => `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;
const bodyFor = (jobId, requestKey, extra = {}) =>
  JSON.stringify({
    version: 1,
    event: `${args.event}.completed`,
    data: {
      jobId,
      status: "completed",
      correlationId: randomUUID(),
      requestIdempotencyKey: requestKey,
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...extra,
    },
  });

async function send({ url = args.url, raw, ts = now(), signature, key, contentType = "application/json" }) {
  const headers = {
    "content-type": contentType,
    "x-n8n-timestamp": String(ts),
    "x-n8n-signature": signature ?? sign(ts, raw),
    "idempotency-key": key,
    "x-correlation-id": randomUUID(),
  };
  const response = await fetch(url, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json };
}

const cases = [];
const add = (name, expected, run, extraCheck) => cases.push({ name, expected, run, extraCheck });
const probeJob = randomUUID();
const probe = bodyFor(probeJob, randomUUID());
const probeKey = `${probeJob}:${args.event}.completed`;
const otherPath = args.url.replace(/[^/]+$/, "no-such-event-xyz");

add("unknown event in the path", 404, () => send({ url: otherPath, raw: probe, key: probeKey }));
add("wrong content-type (text/plain)", 415, () => send({ raw: probe, key: probeKey, contentType: "text/plain" }));
add("body larger than 64 KB", 413, () => {
  const raw = bodyFor(probeJob, randomUUID(), { padding: "x".repeat(70 * 1024) });
  return send({ raw, key: probeKey });
});
add("timestamp 301 s in the past", 401, () => send({ raw: probe, ts: now() - 301, key: probeKey }));
add("timestamp 301 s in the future", 401, () => send({ raw: probe, ts: now() + 301, key: probeKey }));
add("wrong signature", 401, () => send({ raw: probe, key: probeKey, signature: sign(now(), probe).replace(/.$/, (c) => (c === "0" ? "1" : "0")) }));
add("body reformatted after signing", 401, () => {
  const ts = now();
  return send({ raw: JSON.stringify(JSON.parse(probe), null, 2), ts, signature: sign(ts, probe), key: probeKey });
});

if (args["request-key"]) {
  const jobId = args["job-id"] ?? randomUUID();
  const raw = bodyFor(jobId, args["request-key"]);
  const ts = now();
  const key = `${jobId}:${args.event}.completed`;
  add("valid signed callback", 202, () => send({ raw, ts, key }));
  add("the same callback again", 200, () => send({ raw, ts, key }), (r) => r.json?.duplicate === true || "no {\"duplicate\": true}");
  add("same signed bytes, new idempotency-key", 400, () => send({ raw, ts, key: `${randomUUID()}:${args.event}.completed` }));
}

let mismatches = 0;
console.log(`send-signed-callback · ${args.url} · event ${args.event}${args["request-key"] ? " · with success cases" : " · success cases skipped (no --request-key)"}`);
for (const c of cases) {
  let got;
  let note = "";
  try {
    const r = await c.run();
    got = r.status;
    const extra = c.extraCheck?.(r);
    if (extra !== undefined && extra !== true) note = ` (${extra})`;
  } catch (error) {
    got = `error: ${error.cause?.code ?? error.name}`;
  }
  const ok = got === c.expected && !note;
  if (!ok) mismatches++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.name.padEnd(40)} expected ${c.expected}, got ${got}${note}`);
}
console.log(`${cases.length - mismatches}/${cases.length} as expected`);
process.exit(mismatches ? 1 : 0);
