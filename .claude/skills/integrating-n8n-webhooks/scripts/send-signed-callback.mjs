#!/usr/bin/env node
// Sends a matrix of signed / tampered n8n callbacks to a callback route and compares the
// HTTP status with what the contract expects. Node >= 20, no dependencies.

import crypto from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against a running Next.js callback route

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [--request-key <key>] [--job-id <id>] [--only <case>]

  --url <url>           Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request
  --request-key <key>   idempotency-key the app sent to n8n for a request that is still WAITING for
                        its callback (data.requestIdempotencyKey). With it, "valid" completes that
                        request and "other-job-same-request" is checked; without it they use a
                        random key (an unknown request) and "other-job-same-request" is skipped.
  --job-id <id>         data.jobId (default: random UUID), e.g. the job id from the mock log.
  --only <case>         Run one case (names below).
  -h, --help            Show this help.

Environment: N8N_CALLBACK_SECRET (HMAC secret; never pass it as a flag, never printed).

Cases (expected status per the contract), in this order:
  wrong-content-type      text/plain                                         -> 415
  json-lookalike-type     application/jsonx (only starts with application/json) -> 415
  json-with-charset       application/json; charset=utf-8, bad signature      -> 401 (passes the 415 gate)
  oversized-body          body > 64 KB                                        -> 413
  missing-signature       no x-n8n-signature                                  -> 401
  bad-signature           random hex instead of the HMAC                      -> 401
  short-signature         "sha256=abc" (must not crash timingSafeEqual)        -> 401
  wrong-secret            signed with another secret                          -> 401
  stale-timestamp         timestamp 10 min old (window 300 s)                 -> 401
  future-timestamp        timestamp 10 min ahead                              -> 401
  non-numeric-timestamp   x-n8n-timestamp is not unix seconds                 -> 401
  reformatted-body        signed compact JSON, sent pretty-printed            -> 401
  malformed-json          valid signature over a body that is not JSON        -> 400
  unknown-event           valid signature, event the app does not handle      -> 404
  valid                   fresh, correctly signed callback                    -> 202
  repeat                  same bytes + same idempotency-key again             -> 200 {"duplicate":true}
  replay-new-key          bytes of "valid" replayed under a new key           -> 400
  other-job-same-request  another job's signed callback for the same request  -> 409 (needs --request-key)
Exit code: 0 — every case matched, 1 — a mismatch, 2 — usage error.
`;

const args = process.argv.slice(2);
let url = null, jobId = crypto.randomUUID(), requestKey = null, only = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-h" || args[i] === "--help") { process.stdout.write(HELP); process.exit(0); }
  else if (args[i] === "--url") url = args[++i];
  else if (args[i] === "--job-id") jobId = args[++i];
  else if (args[i] === "--request-key") requestKey = args[++i];
  else if (args[i] === "--only") only = args[++i];
  else { console.error(`Unknown argument: ${args[i]}`); process.exit(2); }
}
const secret = process.env.N8N_CALLBACK_SECRET;
if (!url || !secret) { console.error(!url ? "--url is required" : "N8N_CALLBACK_SECRET is not set (use node --env-file=.env.local …)"); process.exit(2); }

const pathEvent = new URL(url).pathname.split("/").filter(Boolean).pop();
const event = `${pathEvent}.completed`;
const correlationId = crypto.randomUUID();
const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw, key = secret) => "sha256=" + crypto.createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex");

function makeBody({ job = jobId, reqKey = requestKey ?? crypto.randomUUID(), extra = {} } = {}) {
  return JSON.stringify({
    version: 1,
    event,
    data: {
      jobId: job,
      status: "completed",
      correlationId,
      requestIdempotencyKey: reqKey,
      result: { documentUrl: `https://files.example.test/n8n/${job}.pdf` },
      completedAt: new Date().toISOString(),
      ...extra,
    },
  });
}

async function send(target, raw, headers) {
  const res = await fetch(target, { method: "POST", body: raw, headers, signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  return { status: res.status, duplicate: /"duplicate"\s*:\s*true/.test(text) };
}

const headersFor = (ts, raw, over = {}, job = jobId) => {
  const h = {
    "content-type": "application/json",
    "x-n8n-timestamp": String(ts),
    "x-n8n-signature": sign(ts, raw),
    "idempotency-key": `${job}:${event}`,
    "x-correlation-id": correlationId,
    ...over,
  };
  for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
  return h;
};
// Negative cases use their own job ids, so they never claim the key of "valid".
const neg = (over, bodyOpts = {}, tsShift = 0) => () => {
  const job = crypto.randomUUID();
  const raw = makeBody({ job, reqKey: crypto.randomUUID(), ...bodyOpts });
  const ts = now() + tsShift;
  return send(url, raw, headersFor(ts, raw, typeof over === "function" ? over(ts, raw) : over, job));
};

const validRaw = makeBody();
const validTs = now();

const cases = [
  ["wrong-content-type", 415, neg({ "content-type": "text/plain" })],
  ["json-lookalike-type", 415, neg({ "content-type": "application/jsonx" })],
  ["json-with-charset", 401, neg({ "content-type": "application/json; charset=utf-8", "x-n8n-signature": "sha256=" + "0".repeat(64) })],
  ["oversized-body", 413, neg({}, { extra: { pad: "x".repeat(70 * 1024) } })],
  ["missing-signature", 401, neg({ "x-n8n-signature": undefined })],
  ["bad-signature", 401, neg({ "x-n8n-signature": "sha256=" + crypto.randomBytes(32).toString("hex") })],
  ["short-signature", 401, neg({ "x-n8n-signature": "sha256=abc" })],
  ["wrong-secret", 401, neg((ts, raw) => ({ "x-n8n-signature": sign(ts, raw, "another-secret") }))],
  ["stale-timestamp", 401, neg({}, {}, -600)],
  ["future-timestamp", 401, neg({}, {}, 600)],
  ["non-numeric-timestamp", 401, neg((ts, raw) => ({ "x-n8n-timestamp": "yesterday", "x-n8n-signature": sign("yesterday", raw) }))],
  ["reformatted-body", 401, () => { const job = crypto.randomUUID(); const raw = makeBody({ job, reqKey: crypto.randomUUID() }); const ts = now(); return send(url, JSON.stringify(JSON.parse(raw), null, 2), headersFor(ts, raw, {}, job)); }],
  ["malformed-json", 400, () => { const job = crypto.randomUUID(); const raw = "{not json"; const ts = now(); return send(url, raw, headersFor(ts, raw, {}, job)); }],
  ["unknown-event", 404, () => { const raw = makeBody({ reqKey: crypto.randomUUID() }); const ts = now(); return send(url.replace(/[^/]+$/, "no-such-event"), raw, headersFor(ts, raw)); }],
  ["valid", 202, () => send(url, validRaw, headersFor(validTs, validRaw))],
  ["repeat", 200, () => send(url, validRaw, headersFor(validTs, validRaw)), (r) => r.duplicate],
  ["replay-new-key", 400, () => send(url, validRaw, headersFor(validTs, validRaw, { "idempotency-key": `${crypto.randomUUID()}:${event}` }))],
  ["other-job-same-request", 409, () => { const job = crypto.randomUUID(); const raw = makeBody({ job }); const ts = now(); return send(url, raw, headersFor(ts, raw, {}, job)); }, null, () => Boolean(requestKey)],
];

let mismatches = 0, ran = 0;
console.log(`callback matrix -> ${url} (jobId ${jobId}${requestKey ? ", waiting request" : ", unknown request"})\n`);
for (const [name, expected, run, extra, enabled] of cases) {
  if (only && name !== only) continue;
  if (enabled && !enabled()) { console.log(`SKIP  ${name.padEnd(23)} needs --request-key`); continue; }
  ran++;
  try {
    const r = await run();
    const ok = r.status === expected && (!extra || extra(r));
    if (!ok) mismatches++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(23)} expected ${expected}  got ${r.status}${name === "repeat" ? `  duplicate=${r.duplicate}` : ""}`);
  } catch (e) {
    mismatches++;
    console.log(`FAIL  ${name.padEnd(23)} expected ${expected}  got ${e.name}`);
  }
}
console.log(`\n${mismatches} failed, ${ran - mismatches} passed (${ran} cases)`);
process.exit(mismatches === 0 ? 0 : 1);
