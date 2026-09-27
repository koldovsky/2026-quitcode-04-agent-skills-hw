# Callback: n8n → Next.js

Endpoint `POST /api/n8n/<event>` — Route Handler `app/api/n8n/[event]/route.ts`. A Route Handler is a
public HTTP endpoint: we trust only the signature.

## Headers n8n sends

| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix time in **seconds** when n8n signed the request |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<body event>`, e.g. `5f0c…:quote-request.completed` |
| `x-correlation-id` | copied from the request that started the workflow |

## Body

```json
{
  "version": 1,
  "event": "quote-request.completed",
  "data": {
    "jobId": "5f0c…",
    "status": "completed",
    "correlationId": "9b1e…",
    "requestIdempotencyKey": "c3d4…",
    "result": { "documentUrl": "https://files.example.test/n8n/5f0c….pdf" },
    "completedAt": "2026-09-21T12:00:00.000Z"
  }
}
```

`data.status` is `completed` or `failed` (then `error: { code }` instead of `result`). Match the
callback to our record by `data.requestIdempotencyKey` — the key we generated and stored when we
triggered the workflow (or by `correlationId`). The body `event` is `<path event>.completed` or
`<path event>.failed`.

## Processing order — exactly this

1. Event from the path is unknown → **404**. `content-type` is not `application/json` → **415**.
   Both before reading the body.
2. Read the body as **raw text**: `const raw = await req.text()`. The body can be read once. No
   `req.json()` and no `JSON.parse` before the signature check — re-serialising changes bytes and
   the signature will not match.
3. Body larger than 64 KB (`Buffer.byteLength(raw)`) → **413** (callbacks carry links, not files).
4. `x-n8n-timestamp` missing, not an integer, or more than **300 s** away from now (either way)
   → **401**. Our replay window; n8n's docs do not set one.
5. Compute HMAC over `` `${timestamp}.${raw}` `` and compare with the signature: first the lengths,
   then `crypto.timingSafeEqual` (it throws on different lengths). Never `===`. Mismatch →
   **401** with no details in the body.
6. Claim the `idempotency-key` (unique insert). Already claimed → **200** `{"duplicate": true}` —
   n8n will not retry, data does not change twice.
7. Only now `JSON.parse(raw)` and validate the shape. Wrong shape, body `event` not matching the
   path, or `idempotency-key` ≠ `` `${data.jobId}:${event}` `` from the body → **400**.
8. Save the minimal state (e.g. `status = ready`, document link) **before** responding. If anything
   in steps 7–8 fails after step 6 — **release** the key, otherwise n8n's retry gets
   `{"duplicate": true}` and the result is lost.
9. Respond **202** `{"ok": true}`.
10. Slow work (emails, notifications, other integrations) — in `after()`.

## Why

- **Save before responding:** after a 2xx n8n will not retry. If the critical write lived only in
  `after()` and failed, the result would be lost forever.
- **Key must match the signed body (step 7):** the `idempotency-key` header is not covered by the
  HMAC (we sign only `timestamp.raw`). Someone who captured one signed callback could resend the
  same bytes with a new key inside the 300 s window. When the key must equal fields of the signed
  body, a repeat with the same key is a duplicate and one with a different key is 400.
- **Idempotency store:** a DB or KV with a unique constraint. Process memory is fine only for a
  demo: serverless handlers do not share state between requests.

## Status codes at a glance

| Case | Code |
|---|---|
| Unknown event in path | 404 |
| Not `application/json` | 415 |
| Body > 64 KB | 413 |
| Missing / stale / future timestamp (> 300 s) | 401 |
| Bad or missing signature | 401 |
| Repeat of an accepted key | 200 `{"duplicate":true}` |
| Bad JSON / shape / event / key ≠ body | 400 (key released) |
| Accepted and stored | 202 `{"ok":true}` |
| Our own storage failed | 500 generic, key released |
