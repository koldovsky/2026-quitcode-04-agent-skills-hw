#!/usr/bin/env node
// Sends a matrix of signed (and deliberately broken) n8n callbacks to a callback route and
// compares each response code with the contract (skill integrating-n8n-webhooks).
// Node built-ins only. Reads N8N_CALLBACK_SECRET from the environment and never prints it,
// nor any signature or body.

import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against a Next.js n8n callback route

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [options]
  node send-signed-callback.mjs --help

Options:
  --url <url>          Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request (required).
                       The last path segment is the event.
  --job-id <id>        data.jobId for the "valid" case (default: random UUID). Use a job your app
                       knows if the route answers 404 for unknown jobs.
  --request-key <key>  data.requestIdempotencyKey (the key your app sent to n8n), if the route
                       looks the record up by it. Without it "valid" and "duplicate" use a random
                       key, so such a route answers 404 for them - create a request first and pass
                       its key here.
  --only <cases>       Comma-separated case names to run (default: all).
  -h, --help           Show this help.

Environment:
  N8N_CALLBACK_SECRET  HMAC secret shared with n8n (required; pass it with --env-file).

Cases (expected status):
  valid              correctly signed callback                             202
  duplicate          the same callback again (same idempotency-key)        200 {"duplicate":true}
  wrong-signature    signature made with another secret                    401
  stale-timestamp    signed 10 minutes ago                                 401
  future-timestamp   signed 10 minutes in the future                       401
  reformatted-body   body re-serialized after signing (spaces added)       401
  key-mismatch       idempotency-key does not match data.jobId:event       400
  wrong-event        event in the signed body is for another path          400
  content-type       text/plain instead of application/json                415
  unknown-event      callback to /api/n8n/<unknown>                         404
  too-large          body over 64 KB                                       413

Exit code: 0 if every case got its expected status, 1 otherwise, 2 on a usage error.
`;

function usage(message) {
  process.stderr.write(`send-signed-callback: ${message}\nRun with --help for usage.\n`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  }
  const m = /^--(url|job-id|request-key|only)$/.exec(a);
  if (!m) usage(`unknown argument "${a}"`);
  if (!argv[i + 1] || argv[i + 1].startsWith("--")) usage(`${a} needs a value`);
  opts[m[1]] = argv[++i];
}
if (!opts.url) usage("--url is required");
let url;
try {
  url = new URL(opts.url);
} catch {
  usage("--url must be an absolute http(s) URL");
}
const secret = process.env.N8N_CALLBACK_SECRET;
if (!secret) usage("N8N_CALLBACK_SECRET is not set (run with --env-file=.env.local)");

const path = url.pathname.replace(/\/+$/, "");
const event = path.split("/").pop();
const jobId = opts["job-id"] ?? randomUUID();
const correlationId = randomUUID();
const now = () => Math.floor(Date.now() / 1000);

function makeBody({ bodyEvent = `${event}.completed`, id = jobId, pad = 0 } = {}) {
  return JSON.stringify({
    version: 1,
    event: bodyEvent,
    data: {
      jobId: id,
      status: "completed",
      correlationId,
      requestIdempotencyKey: opts["request-key"] ?? randomUUID(),
      result: { documentUrl: `https://files.example.test/n8n/${id}.pdf` },
      completedAt: new Date().toISOString(),
      ...(pad ? { padding: "x".repeat(pad) } : {}),
    },
  });
}
const sign = (ts, body, key = secret) => `sha256=${createHmac("sha256", key).update(`${ts}.${body}`).digest("hex")}`;

async function send({ target = url.href, body, ts = now(), signature, key, contentType = "application/json" }) {
  const headers = {
    "content-type": contentType,
    "x-n8n-timestamp": String(ts),
    "x-n8n-signature": signature ?? sign(ts, body),
    "idempotency-key": key ?? `${JSON.parse(body).data.jobId}:${JSON.parse(body).event}`,
    "x-correlation-id": correlationId,
  };
  const res = await fetch(target, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
  let duplicate = false;
  try {
    duplicate = (await res.json())?.duplicate === true;
  } catch {
    // body is not JSON - only the status matters then
  }
  return { status: res.status, duplicate };
}

const validBody = makeBody();
const cases = [
  ["valid", 202, () => send({ body: validBody })],
  ["duplicate", 200, () => send({ body: validBody }), (r) => r.duplicate],
  ["wrong-signature", 401, () => { const b = makeBody({ id: randomUUID() }); return send({ body: b, signature: sign(now(), b, `${secret}-wrong`) }); }],
  ["stale-timestamp", 401, () => { const b = makeBody({ id: randomUUID() }); const ts = now() - 600; return send({ body: b, ts, signature: sign(ts, b) }); }],
  ["future-timestamp", 401, () => { const b = makeBody({ id: randomUUID() }); const ts = now() + 600; return send({ body: b, ts, signature: sign(ts, b) }); }],
  ["reformatted-body", 401, () => {
    const b = makeBody({ id: randomUUID() }); const ts = now();
    return send({ body: JSON.stringify(JSON.parse(b), null, 2), ts, signature: sign(ts, b), key: `${JSON.parse(b).data.jobId}:${JSON.parse(b).event}` });
  }],
  ["key-mismatch", 400, () => { const b = makeBody({ id: randomUUID() }); return send({ body: b, key: `${randomUUID()}:${event}.completed` }); }],
  ["wrong-event", 400, () => { const b = makeBody({ id: randomUUID(), bodyEvent: "other-event.completed" }); return send({ body: b }); }],
  ["content-type", 415, () => { const b = makeBody({ id: randomUUID() }); return send({ body: b, contentType: "text/plain" }); }],
  ["unknown-event", 404, () => {
    const target = new URL(url.href); target.pathname = path.replace(/[^/]+$/, "no-such-event-x");
    const b = makeBody({ id: randomUUID(), bodyEvent: "no-such-event-x.completed" }); return send({ target: target.href, body: b });
  }],
  ["too-large", 413, () => { const b = makeBody({ id: randomUUID(), pad: 70 * 1024 }); return send({ body: b }); }],
];

const only = opts.only ? new Set(opts.only.split(",").map((s) => s.trim())) : null;
if (only) for (const name of only) if (!cases.some(([n]) => n === name)) usage(`unknown case "${name}"`);

console.log(`callback matrix -> ${url.origin}${path} (event ${event})\n`);
console.log("case               expected  got   result");
let failures = 0;
const got404 = new Set();
for (const [name, expected, run, extra] of cases) {
  if (only && !only.has(name)) continue;
  let got = "ERR";
  let ok = false;
  try {
    const r = await run();
    got = String(r.status);
    if (r.status === 404) got404.add(name);
    ok = r.status === expected && (!extra || extra(r));
  } catch (error) {
    got = error.cause?.code ?? error.name;
  }
  if (!ok) failures++;
  console.log(`${name.padEnd(18)} ${String(expected).padEnd(9)} ${got.padEnd(5)} ${ok ? "PASS" : "FAIL"}`);
}
console.log(`\n${failures ? `${failures} case(s) FAIL` : "all cases PASS"}`);
if (got404.has("valid") && !opts["request-key"] && !opts["job-id"]) {
  console.log(
    'hint: "valid" got 404 - the route probably looks the record up by data.requestIdempotencyKey (or jobId)\n' +
      "and this run used a random one. Create a request in the app first, then pass its key:\n" +
      "  --request-key <the idempotency-key your app sent to n8n>   (and/or --job-id <jobId>)",
  );
}
process.exit(failures ? 1 : 0);
