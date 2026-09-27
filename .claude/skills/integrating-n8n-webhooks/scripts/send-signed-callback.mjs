#!/usr/bin/env node
// Sends a matrix of n8n callbacks (valid, forged, stale, reformatted, repeated…) to a running
// callback route and checks each answer against the contract (skill integrating-n8n-webhooks).
// Zero dependencies. Never prints the secret, signatures or bodies.

import { createHmac, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const USAGE = `send-signed-callback: check a callback route against the n8n callback contract

Usage:
  node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs [options]

Options:
  --url <url>           Callback endpoint (default http://127.0.0.1:3000/api/n8n/quote-request).
  --event <name>        "event" in the body (default "<last path segment>.completed").
  --request-key <key>   The idempotency-key the app sent to n8n for a REAL record. With it the
                        script also sends a valid callback (expects 202; this changes that
                        record's state), repeats it (expects 200 {"duplicate":true}) and replays
                        the same bytes under a new key (expects 400). Without it: SKIP.
  --job-id <id>         data.jobId for the valid callback (default: a new UUID). Pass the job_id
                        the app stored from n8n's 202 if the route cross-checks it.
  -h, --help            Show this help.

Environment (never pass secrets as flags):
  N8N_CALLBACK_SECRET   The HMAC secret the route verifies with (required).

Cases (always):
  R1  unknown event path                       404
  R2  content-type text/plain                  415
  R3  body over 64 KB, correctly signed        413
  R4  no x-n8n-signature                       401
  R5  signed with another secret               401
  R6  timestamp 301 s in the past, signed      401
  R7  timestamp 301 s in the future, signed    401
  R8  body re-serialized after signing         401
  R9  idempotency-key != <jobId>:<event>       400
  R10 body event of another path               400
  R11 unknown job, sent twice with one key     4xx both times, never 200 "duplicate"
                                               (the route released the key after the failure)
With --request-key:
  V1  valid callback                           202
  V2  the same request again                   200 {"duplicate": true}
  V3  the same bytes under a new key           400

Exit code: 0 all PASS (SKIP allowed) · 1 at least one FAIL · 2 usage error or app unreachable.
`;

function usageError(message) {
  console.error(`send-signed-callback: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

let args;
try {
  args = parseArgs({
    options: {
      url: { type: "string", default: "http://127.0.0.1:3000/api/n8n/quote-request" },
      event: { type: "string" },
      "request-key": { type: "string" },
      "job-id": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
    allowPositionals: false,
  }).values;
} catch (error) {
  usageError(error.message);
}
if (args.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const secret = process.env.N8N_CALLBACK_SECRET || "";
if (!secret) usageError("N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local …)");

let target;
try {
  target = new URL(args.url);
} catch {
  usageError("--url must be an http(s) URL");
}
const segments = target.pathname.split("/").filter(Boolean);
const pathEvent = segments.at(-1);
if (!pathEvent) usageError("--url must end with the event path segment, e.g. /api/n8n/quote-request");
const event = args.event ?? `${pathEvent}.completed`;
const unknownUrl = new URL(target);
unknownUrl.pathname = [...segments.slice(0, -1), "unknown-event-for-contract-check"].map((s) => `/${s}`).join("");

const now = () => Math.floor(Date.now() / 1000);
const sign = (key, timestamp, body) => `sha256=${createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex")}`;

function envelope({ jobId = randomUUID(), bodyEvent = event, requestKey = randomUUID(), padding } = {}) {
  const data = {
    jobId,
    status: "completed",
    correlationId: randomUUID(),
    requestIdempotencyKey: requestKey,
    result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
    completedAt: new Date().toISOString(),
  };
  if (padding) data.padding = padding;
  return { jobId, bodyEvent, body: JSON.stringify({ version: 1, event: bodyEvent, data }) };
}

// A correctly signed request unless a case overrides a part of it.
function request(parts, overrides = {}) {
  const timestamp = String(overrides.timestamp ?? now());
  const body = parts.body;
  const headers = {
    "content-type": "application/json",
    "x-n8n-timestamp": timestamp,
    "x-n8n-signature": sign(overrides.secret ?? secret, timestamp, overrides.signedBody ?? body),
    "idempotency-key": overrides.key ?? `${parts.jobId}:${parts.bodyEvent}`,
    "x-correlation-id": randomUUID(),
    ...overrides.headers,
  };
  for (const [name, value] of Object.entries(headers)) if (value === null) delete headers[name];
  return { url: overrides.url ?? target, headers, body };
}

async function send({ url, headers, body }) {
  try {
    const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
    let json = null;
    try {
      json = await response.json();
    } catch {
      // not JSON
    }
    return { status: response.status, json };
  } catch (error) {
    const reason = error.cause?.code ?? error.name;
    console.error(`send-signed-callback: cannot reach ${url.origin}${url.pathname} (${reason}). Is the app running?`);
    process.exit(2);
  }
}

const results = [];
function record(id, name, expected, got, ok) {
  results.push({ id, name, expected, got, status: ok ? "PASS" : "FAIL" });
}
async function expectStatus(id, name, req, expected) {
  const { status } = await send(req);
  record(id, name, String(expected), String(status), status === expected);
}

const rawOf = (parts) => parts.body;
const reformat = (parts) => JSON.stringify(JSON.parse(parts.body), null, 2);

console.log(`send-signed-callback → ${target.origin}${target.pathname} (event ${event})`);
console.log("");

{
  const parts = envelope();
  await expectStatus("R1", "unknown event path", request(parts, { url: unknownUrl }), 404);
}
{
  const parts = envelope();
  await expectStatus("R2", "content-type text/plain", request(parts, { headers: { "content-type": "text/plain" } }), 415);
}
{
  const parts = envelope({ padding: "x".repeat(70 * 1024) });
  await expectStatus("R3", "body over 64 KB, correctly signed", request(parts), 413);
}
{
  const parts = envelope();
  await expectStatus("R4", "no x-n8n-signature", request(parts, { headers: { "x-n8n-signature": null } }), 401);
}
{
  const parts = envelope();
  await expectStatus("R5", "signed with another secret", request(parts, { secret: `${secret}-not-it` }), 401);
}
{
  const parts = envelope();
  await expectStatus("R6", "timestamp 301 s in the past, signed", request(parts, { timestamp: now() - 301 }), 401);
}
{
  const parts = envelope();
  await expectStatus("R7", "timestamp 301 s in the future, signed", request(parts, { timestamp: now() + 301 }), 401);
}
{
  const parts = envelope();
  const req = request(parts, { signedBody: rawOf(parts) });
  req.body = reformat(parts);
  await expectStatus("R8", "body re-serialized after signing", req, 401);
}
{
  const parts = envelope();
  await expectStatus("R9", "idempotency-key != <jobId>:<event>", request(parts, { key: `${randomUUID()}:${event}` }), 400);
}
{
  const parts = envelope({ bodyEvent: "some-other-event.completed" });
  await expectStatus("R10", "body event of another path", request(parts), 400);
}
{
  const parts = envelope();
  const req = request(parts);
  const first = await send(req);
  const second = await send(request(parts, { key: req.headers["idempotency-key"] }));
  const ok =
    first.status >= 400 && first.status < 500 && second.status === first.status && second.json?.duplicate !== true;
  record("R11", "unknown job, twice with one key", "4xx, same again (key released)", `${first.status}, then ${second.status}`, ok);
}

const requestKey = args["request-key"];
if (!requestKey) {
  for (const [id, name] of [["V1", "valid callback"], ["V2", "the same request again"], ["V3", "the same bytes under a new key"]]) {
    results.push({ id, name, expected: "-", got: "-", status: "SKIP", note: "pass --request-key <key of a real record>" });
  }
} else {
  const parts = envelope({ jobId: args["job-id"] ?? randomUUID(), requestKey });
  const req = request(parts);
  const valid = await send(req);
  record("V1", "valid callback", "202", String(valid.status), valid.status === 202);
  const repeat = await send(req);
  record("V2", "the same request again", '200 {"duplicate":true}', `${repeat.status}${repeat.json?.duplicate === true ? " duplicate" : ""}`, repeat.status === 200 && repeat.json?.duplicate === true);
  // An intercepted callback resent within the window: same bytes, timestamp and signature, new key.
  const replay = await send({ ...req, headers: { ...req.headers, "idempotency-key": `${randomUUID()}:${event}` } });
  record("V3", "the same bytes under a new key", "400", String(replay.status), replay.status === 400);
}

for (const r of results) {
  const detail = r.status === "SKIP" ? r.note : `expected ${r.expected}, got ${r.got}`;
  console.log(`${r.status}  ${r.id.padEnd(4)}${r.name.padEnd(40)}${detail}`);
}
const count = (s) => results.filter((r) => r.status === s).length;
console.log("");
console.log(`${results.length} cases: ${count("PASS")} PASS · ${count("FAIL")} FAIL · ${count("SKIP")} SKIP`);
process.exit(count("FAIL") ? 1 : 0);
