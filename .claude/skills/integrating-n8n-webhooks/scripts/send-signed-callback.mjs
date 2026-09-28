#!/usr/bin/env node
// Sends a matrix of n8n-style callbacks to a callback route and compares the HTTP status with the
// contract. Node built-ins only. The secret comes from the environment and is never printed.
import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against a Next.js callback route (skill integrating-n8n-webhooks)

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event>
  node send-signed-callback.mjs --help

Options:
  --url <url>      Callback route to test (required). The last path segment is the event.
  --event <name>   "event" in the body (default: "<last path segment>.completed").
  -h, --help       Show this help.

Environment:
  N8N_CALLBACK_SECRET   HMAC secret shared with n8n (required; never printed).

Cases (expected status):
  valid                          202  signed like n8n: sha256=HMAC(secret, "<ts>.<raw>")
  duplicate (same key again)     200  {"duplicate": true}, nothing changes twice
  wrong signature                401
  missing signature              401
  timestamp 301 s in the past    401
  timestamp 301 s in the future  401
  body reformatted after signing 401  (the route must verify the raw bytes)
  key not matching signed body   400  (idempotency-key must equal "<data.jobId>:<event>")
  signed invalid JSON            400
  body over 64 KB                413
  content-type text/plain        415
  unknown event in the path      404

Exit code: 0 if every case matches, 1 otherwise, 2 on usage errors.
Note: "valid" and "duplicate" create one callback record in the app under test.
`;

const argv = process.argv.slice(2);
let url = null;
let eventName = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(HELP);
    process.exit(0);
  } else if (a === "--url" && argv[i + 1]) url = argv[++i];
  else if (a === "--event" && argv[i + 1]) eventName = argv[++i];
  else usage(`unknown or incomplete argument: ${a}`);
}
if (!url) usage("--url is required");
const secret = process.env.N8N_CALLBACK_SECRET;
if (!secret) usage("N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local ...)");

function usage(msg) {
  process.stderr.write(`send-signed-callback: ${msg}\nRun with --help for usage.\n`);
  process.exit(2);
}

const target = new URL(url);
const pathEvent = target.pathname.split("/").filter(Boolean).pop();
const event = eventName ?? `${pathEvent}.completed`;
const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw) => `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;

function envelope(jobId, extra = {}) {
  return {
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId: randomUUID(),
      requestIdempotencyKey: randomUUID(),
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...extra,
    },
  };
}

async function send({ to = target, raw, ts = now(), signature, key, contentType = "application/json" }) {
  const headers = { "content-type": contentType, "x-correlation-id": randomUUID() };
  if (ts !== null) headers["x-n8n-timestamp"] = String(ts);
  if (signature !== null) headers["x-n8n-signature"] = signature ?? sign(ts, raw);
  if (key) headers["idempotency-key"] = key;
  const res = await fetch(to, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(10_000) });
  await res.arrayBuffer();
  return res.status;
}

const cases = [];
const add = (name, expected, run) => cases.push({ name, expected, run });

const validJob = randomUUID();
const validRaw = JSON.stringify(envelope(validJob));
add("valid", 202, () => send({ raw: validRaw, key: `${validJob}:${event}` }));
add("duplicate (same key again)", 200, () => send({ raw: validRaw, key: `${validJob}:${event}` }));
add("wrong signature", 401, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${job}:${event}`, signature: sign(now(), "{}") });
});
add("missing signature", 401, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${job}:${event}`, signature: null });
});
add("timestamp 301 s in the past", 401, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${job}:${event}`, ts: now() - 301 });
});
add("timestamp 301 s in the future", 401, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${job}:${event}`, ts: now() + 301 });
});
add("body reformatted after signing", 401, () => {
  const job = randomUUID();
  const body = envelope(job);
  const ts = now();
  return send({ raw: JSON.stringify(body, null, 2), ts, signature: sign(ts, JSON.stringify(body)), key: `${job}:${event}` });
});
add("key not matching signed body", 400, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${randomUUID()}:${event}` });
});
add("signed invalid JSON", 400, () => send({ raw: "{not json", key: `${randomUUID()}:${event}` }));
add("body over 64 KB", 413, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job, { padding: "x".repeat(65 * 1024) })), key: `${job}:${event}` });
});
add("content-type text/plain", 415, () => {
  const job = randomUUID();
  return send({ raw: JSON.stringify(envelope(job)), key: `${job}:${event}`, contentType: "text/plain" });
});
add("unknown event in the path", 404, () => {
  const other = new URL(target);
  other.pathname = other.pathname.replace(/[^/]+\/?$/, "no-such-event-xyz");
  const job = randomUUID();
  return send({ to: other, raw: JSON.stringify(envelope(job)), key: `${job}:no-such-event-xyz.completed` });
});

console.log(`send-signed-callback: ${target.origin}${target.pathname} | event in body: ${event}`);
let failed = 0;
for (const c of cases) {
  let got;
  try {
    got = await c.run();
  } catch (error) {
    got = error instanceof Error ? error.name : "error";
  }
  const ok = got === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(32)} expected ${c.expected}  got ${got}`);
}
console.log(`\nSummary: ${cases.length - failed} PASS, ${failed} FAIL`);
// exitCode instead of process.exit(): on Windows, exiting while fetch sockets close aborts Node (exit 127).
process.exitCode = failed > 0 ? 1 : 0;
