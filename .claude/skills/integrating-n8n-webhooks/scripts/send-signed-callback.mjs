#!/usr/bin/env node
// Sends a matrix of signed and deliberately broken n8n callbacks to a running callback route and
// compares the status codes with the contract. Node built-ins only.
// The secret is read from N8N_CALLBACK_SECRET (run with: node --env-file=.env.local …); it is never printed.

import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against a running route

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [--request-key <key>] [--event <event>]

Options:
  --url <url>            Callback route, e.g. http://127.0.0.1:3000/api/n8n/quote-request (required).
  --request-key <key>    idempotency-key your app stored when it triggered the workflow. With it the
                         "valid" and "replay" cases target a real record; without them they are skipped.
  --event <event>        Body event (default: "<last path segment>.completed").
  -h, --help             Show this help.

Environment:
  N8N_CALLBACK_SECRET    HMAC secret shared with n8n (required; never printed).

Cases → expected status:
  valid                  202  (needs --request-key)
  replay                 200 {"duplicate":true}  (same key again; needs --request-key)
  bad-signature          401
  missing-signature      401
  expired-timestamp      401  (signed 600 s ago)
  future-timestamp       401  (signed 600 s ahead)
  reformatted-body       401  (body pretty-printed after signing)
  wrong-content-type     415
  unknown-event          404  (last path segment replaced)
  key-not-matching-body  400
  malformed-json         400  (signed, but not JSON)
  too-large              413  (signed, > 64 KB)
Exit code: 0 if every case got its expected status, 1 otherwise, 2 on usage errors.`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (["--url", "--request-key", "--event"].includes(a)) out[a.slice(2)] = argv[++i];
    else fail(`unknown argument: ${a}`);
  }
  return out;
}

function fail(message) {
  console.error(`send-signed-callback: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}
if (!args.url) fail("--url is required");
let url;
try {
  url = new URL(args.url);
} catch {
  fail("--url is not a valid URL");
}
const secret = process.env.N8N_CALLBACK_SECRET;
if (!secret) fail("N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local …)");

const pathEvent = url.pathname.split("/").filter(Boolean).pop();
const event = args.event ?? `${pathEvent}.completed`;
const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw) => `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;

function makeBody({ jobId = randomUUID(), requestKey = args["request-key"] ?? randomUUID(), pad = 0 } = {}) {
  const body = {
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId: randomUUID(),
      requestIdempotencyKey: requestKey,
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...(pad ? { padding: "x".repeat(pad) } : {}),
    },
  };
  return { jobId, raw: JSON.stringify(body) };
}

async function send({ target = url, raw, ts = String(now()), signature, key, contentType = "application/json" }) {
  const headers = { "content-type": contentType, "x-n8n-timestamp": ts, "idempotency-key": key };
  if (signature !== null) headers["x-n8n-signature"] = signature ?? sign(ts, raw);
  const response = await fetch(target, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  return { status: response.status, duplicate: /"duplicate"\s*:\s*true/.test(text) };
}

const cases = [];
const add = (name, expected, run, skip = false) => cases.push({ name, expected, run, skip });

const valid = makeBody();
const validKey = `${valid.jobId}:${event}`;
const hasRecord = Boolean(args["request-key"]);

add("valid", 202, () => send({ raw: valid.raw, key: validKey }), !hasRecord);
add("replay", 200, async () => {
  const r = await send({ raw: valid.raw, key: validKey });
  return { ...r, note: r.duplicate ? "duplicate:true" : "no duplicate flag" };
}, !hasRecord);
add("bad-signature", 401, () => {
  const b = makeBody();
  return send({ raw: b.raw, key: `${b.jobId}:${event}`, signature: `sha256=${"0".repeat(64)}` });
});
add("missing-signature", 401, () => {
  const b = makeBody();
  return send({ raw: b.raw, key: `${b.jobId}:${event}`, signature: null });
});
add("expired-timestamp", 401, () => {
  const b = makeBody();
  const ts = String(now() - 600);
  return send({ raw: b.raw, ts, signature: sign(ts, b.raw), key: `${b.jobId}:${event}` });
});
add("future-timestamp", 401, () => {
  const b = makeBody();
  const ts = String(now() + 600);
  return send({ raw: b.raw, ts, signature: sign(ts, b.raw), key: `${b.jobId}:${event}` });
});
add("reformatted-body", 401, () => {
  const b = makeBody();
  const ts = String(now());
  const signature = sign(ts, b.raw);
  return send({ raw: JSON.stringify(JSON.parse(b.raw), null, 2), ts, signature, key: `${b.jobId}:${event}` });
});
add("wrong-content-type", 415, () => {
  const b = makeBody();
  return send({ raw: b.raw, key: `${b.jobId}:${event}`, contentType: "text/plain" });
});
add("unknown-event", 404, () => {
  const b = makeBody();
  const target = new URL(url);
  target.pathname = target.pathname.replace(/[^/]+\/?$/, "no-such-event");
  return send({ target, raw: b.raw, key: `${b.jobId}:${event}` });
});
add("key-not-matching-body", 400, () => {
  const b = makeBody();
  return send({ raw: b.raw, key: `${randomUUID()}:${event}` });
});
add("malformed-json", 400, () => send({ raw: "{not json", key: `${randomUUID()}:${event}` }));
add("too-large", 413, () => {
  const b = makeBody({ pad: 70 * 1024 });
  return send({ raw: b.raw, key: `${b.jobId}:${event}` });
});

let mismatches = 0;
console.log(`callback matrix → ${url.href}  event=${event}${hasRecord ? "" : "  (no --request-key: valid/replay skipped)"}`);
console.log("case                    expected  got   result");
for (const c of cases) {
  if (c.skip) {
    console.log(`${c.name.padEnd(24)}${String(c.expected).padEnd(10)}-     SKIP`);
    continue;
  }
  let got;
  try {
    got = await c.run();
  } catch (error) {
    got = { status: `ERR ${error instanceof Error ? error.name : "Error"}` };
  }
  const ok = got.status === c.expected && (c.name !== "replay" || got.duplicate);
  if (!ok) mismatches++;
  console.log(`${c.name.padEnd(24)}${String(c.expected).padEnd(10)}${String(got.status).padEnd(6)} ${ok ? "OK" : "MISMATCH"}${got.note ? `  (${got.note})` : ""}`);
}
console.log(`\n${mismatches === 0 ? "all cases as expected" : `${mismatches} mismatch(es)`}`);
process.exit(mismatches ? 1 : 0);
