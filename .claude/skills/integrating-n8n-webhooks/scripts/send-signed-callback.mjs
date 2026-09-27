#!/usr/bin/env node
// Sends a matrix of signed n8n callbacks to a callback route and checks each response code.
// Node >= 20, no dependencies. The secret comes only from the environment, never from a flag.

import { createHmac, randomUUID } from "node:crypto";

const HELP = `send-signed-callback.mjs — callback matrix against app/api/n8n/<event> (skill integrating-n8n-webhooks)

Usage:
  node --env-file=.env.local send-signed-callback.mjs --url <callback url> [--event <name>]

Options:
  --url <url>      Callback endpoint, e.g. http://127.0.0.1:3000/api/n8n/quote-request
  --event <name>   Event in the body (default: "<last path segment>.completed").
  -h, --help       Show this help.

Environment:
  N8N_CALLBACK_SECRET   HMAC secret (the same the app uses). Required. Never printed.

Cases and expected codes: valid 202 · same callback again 200 {"duplicate":true} ·
unknown event in the path 404 · "constructor" as the event 404 · wrong content-type 415 ·
wrong signature 401 · timestamp 10 min old 401 · body reformatted after signing 401 ·
new idempotency-key for the same body 400 · signed body of the wrong shape 400 · body > 64 KB 413 ·
body > 64 KB sent chunked without content-length 413 (the cap must work while reading).
Note: the "valid" case really saves a result for a random jobId in your app.

Exit code: 0 — every case as expected, 1 — at least one mismatch, 2 — usage error.`;

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(HELP);
  process.exit(0);
}
// null only when the option is absent; present without a value (or followed by another option)
// is a usage error, not a silent fallback to the default.
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  if (!value || value.startsWith("-")) fail(`${name} needs a value`);
  return value;
};
// Only --url <v> and --event <v>: a typo such as --evnt is an error, not the default event.
for (let i = 0; i < args.length; i += 2) {
  if (args[i] !== "--url" && args[i] !== "--event") fail(`unknown argument: ${args[i]}`);
  opt(args[i]);
}
const url = opt("--url");
const secret = process.env.N8N_CALLBACK_SECRET;
if (!url || !/^https?:\/\//.test(url)) fail("--url <callback url> is required");
if (!secret) fail("N8N_CALLBACK_SECRET is not set (run with node --env-file=.env.local …)");
const event = opt("--event") ?? `${new URL(url).pathname.split("/").filter(Boolean).pop()}.completed`;

function fail(message) {
  console.error(`send-signed-callback: ${message}\nRun with --help for usage.`);
  process.exit(2);
}

const jobId = randomUUID();
const body = JSON.stringify({
  version: 1,
  event,
  data: { jobId, status: "completed", correlationId: randomUUID(), result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` }, completedAt: new Date().toISOString() },
});
const now = () => Math.floor(Date.now() / 1000);
const sign = (ts, raw, key = secret) => `sha256=${createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex")}`;

// The same endpoint with another last path segment (an event the app does not know).
const sibling = (segment) => {
  const u = new URL(url);
  u.pathname = u.pathname.replace(/[^/]+\/?$/, segment);
  return u.toString();
};

let mismatches = 0;
async function send(name, expected, { to = url, raw = body, ts = now(), signature, key = `${jobId}:${event}`, contentType = "application/json", chunked = false } = {}) {
  const res = await fetch(to, {
    method: "POST",
    // chunked: a stream body goes without content-length, so only a cap while reading can stop it
    ...(chunked ? { body: new Blob([raw]).stream(), duplex: "half" } : { body: raw }),
    headers: {
      "content-type": contentType,
      "x-n8n-timestamp": String(ts),
      "x-n8n-signature": signature ?? sign(ts, raw),
      "idempotency-key": key,
      "x-correlation-id": randomUUID(),
    },
  });
  const text = (await res.text()).slice(0, 60);
  const ok = res.status === expected;
  if (!ok) mismatches++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(36)} expected ${expected}, got ${res.status}${text ? ` ${text}` : ""}`);
}

console.log(`callbacks → ${url} · event ${event}`);
await send("valid callback", 202);
await send("same callback again (duplicate)", 200);
await send("unknown event in the path", 404, { to: sibling("no-such-event") });
await send('"constructor" as the event', 404, { to: sibling("constructor") });
await send("wrong content-type", 415, { contentType: "text/plain" });
await send("wrong signature", 401, { signature: sign(now(), body, "not-the-secret") });
await send("timestamp 10 min old", 401, { ts: now() - 600 });
await send("body reformatted after signing", 401, { raw: JSON.stringify(JSON.parse(body), null, 2), signature: sign(now(), body) });
await send("new key for the same signed body", 400, { key: `${randomUUID()}:${event}` });
{
  // Correctly signed and keyed, but data.status is neither "completed" nor "failed".
  const otherJob = randomUUID();
  const wrongShape = JSON.stringify({ version: 1, event, data: { jobId: otherJob, status: "done" } });
  await send("signed body of the wrong shape", 400, { raw: wrongShape, key: `${otherJob}:${event}` });
}
await send("body > 64 KB", 413, { raw: body + " ".repeat(70_000) });
await send("body > 64 KB, chunked (no length)", 413, { raw: body + " ".repeat(70_000), chunked: true });
console.log(mismatches ? `\n${mismatches} case(s) differ` : "\nall cases as expected");
// exitCode, not process.exit(): exiting while fetch keep-alive sockets are open can abort Node on
// Windows (libuv "Assertion failed … async.c") and turn the result into exit code 127.
process.exitCode = mismatches ? 1 : 0;
