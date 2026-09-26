#!/usr/bin/env node
// Sends a matrix of signed / tampered n8n callbacks to a callback route and compares the
// HTTP status with what the contract expects. Node >= 20, no dependencies.

import crypto from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against a running Next.js callback route

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [--job-id <id>] [--only <case>]

  --url <url>       Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request
  --job-id <id>     data.jobId to use (default: random UUID). Use a real job id to also see
                    the record switch to "ready"; unknown job ids may give 404 by design.
  --only <case>     Run one case (names below).
  -h, --help        Show this help.

Environment: N8N_CALLBACK_SECRET (HMAC secret; never pass it as a flag, never printed).

Cases (expected status per the contract):
  valid              correctly signed callback                      -> 202
  repeat             same bytes + same idempotency-key again        -> 200 {"duplicate":true}
  bad-signature      signature from another secret                  -> 401
  stale-timestamp    timestamp 10 minutes old (window is 300 s)      -> 401
  reformatted-body   body pretty-printed after signing              -> 401
  key-mismatch       idempotency-key not "<data.jobId>:<event>"      -> 400
  wrong-type         content-type text/plain                        -> 415
  unknown-event      path event that does not exist                 -> 404
  too-large          body > 64 KB                                   -> 413
Exit code: 0 — every case matched, 1 — a mismatch, 2 — usage error.
`;

const args = process.argv.slice(2);
let url = null, jobId = crypto.randomUUID(), only = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-h" || args[i] === "--help") { process.stdout.write(HELP); process.exit(0); }
  else if (args[i] === "--url") url = args[++i];
  else if (args[i] === "--job-id") jobId = args[++i];
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

function makeBody(extra = {}) {
  return JSON.stringify({
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId,
      requestIdempotencyKey: crypto.randomUUID(),
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
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

const validRaw = makeBody();
const validTs = now();
const baseHeaders = (ts, raw, over = {}) => ({
  "content-type": "application/json",
  "x-n8n-timestamp": String(ts),
  "x-n8n-signature": sign(ts, raw),
  "idempotency-key": `${jobId}:${event}`,
  "x-correlation-id": correlationId,
  ...over,
});

const cases = [
  ["valid", 202, () => send(url, validRaw, baseHeaders(validTs, validRaw))],
  ["repeat", 200, () => send(url, validRaw, baseHeaders(validTs, validRaw)), (r) => r.duplicate],
  ["bad-signature", 401, () => { const raw = makeBody(); const ts = now(); return send(url, raw, baseHeaders(ts, raw, { "x-n8n-signature": sign(ts, raw, "wrong-secret") })); }],
  ["stale-timestamp", 401, () => { const raw = makeBody(); const ts = now() - 600; return send(url, raw, baseHeaders(ts, raw)); }],
  ["reformatted-body", 401, () => { const raw = makeBody(); const ts = now(); return send(url, JSON.stringify(JSON.parse(raw), null, 2), baseHeaders(ts, raw)); }],
  ["key-mismatch", 400, () => { const raw = makeBody(); const ts = now(); return send(url, raw, baseHeaders(ts, raw, { "idempotency-key": `${crypto.randomUUID()}:${event}` })); }],
  ["wrong-type", 415, () => { const raw = makeBody(); const ts = now(); return send(url, raw, baseHeaders(ts, raw, { "content-type": "text/plain" })); }],
  ["unknown-event", 404, () => { const raw = makeBody(); const ts = now(); return send(url.replace(/[^/]+$/, "no-such-event"), raw, baseHeaders(ts, raw)); }],
  ["too-large", 413, () => { const raw = makeBody({ pad: "x".repeat(70 * 1024) }); const ts = now(); return send(url, raw, baseHeaders(ts, raw)); }],
];

let mismatches = 0;
console.log(`callback matrix -> ${url} (jobId ${jobId})\n`);
console.log("case               expected  got   result");
for (const [name, expected, run, extra] of cases) {
  if (only && name !== only) continue;
  try {
    const r = await run();
    const ok = r.status === expected && (!extra || extra(r));
    if (!ok) mismatches++;
    console.log(`${name.padEnd(18)} ${String(expected).padEnd(9)} ${String(r.status).padEnd(5)} ${ok ? "OK" : "MISMATCH"}${name === "repeat" ? `  duplicate=${r.duplicate}` : ""}`);
  } catch (e) {
    mismatches++;
    console.log(`${name.padEnd(18)} ${String(expected).padEnd(9)} ERR   ${e.name}`);
  }
}
console.log(`\n${mismatches === 0 ? "all cases matched" : `${mismatches} mismatch(es)`}`);
process.exit(mismatches === 0 ? 0 : 1);
