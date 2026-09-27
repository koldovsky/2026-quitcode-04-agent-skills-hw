# The callback route, step by step

`app/api/n8n/[event]/route.ts` receives the results of async workflows. A Route Handler is a
public HTTP endpoint: anyone who knows the URL can POST to it. So the route trusts **only the
signature**. Without it, anyone could "complete" someone else's quote.

## Contents

1. The order of checks
2. Why the raw body
3. Why a length check and `timingSafeEqual`
4. Why a ±300 s window
5. Why the key must match the signed body
6. Why save before answering, and release on failure
7. Where to keep the keys and the state
8. Things around the route
9. Sources

## 1. The order of checks

The order is part of the contract: each step relies on the ones before it.

| # | Check | Answer if it fails | Why here |
|---|---|---|---|
| 1 | `[event]` is a known path; `content-type` is `application/json` | 404; 415 | Cheap, before touching the body |
| 2 | `const raw = await request.text()` | — | The body can be read only once, and the signature covers these exact bytes |
| 3 | `raw` ≤ 64 KB | 413 | A callback carries links, not files. The `content-length` header may be checked earlier too |
| 4 | `x-n8n-timestamp` within ±300 s of now | 401 | Replay protection; also cheaper than HMAC |
| 5 | `x-n8n-signature` = `sha256=` + hex HMAC-SHA256(secret, `${timestamp}.${raw}`), length check + `timingSafeEqual` | 401, no details | Authentication. Nothing unsigned is trusted before this |
| 6 | Claim `idempotency-key` in a unique store | 200 `{"duplicate": true}` if already claimed | n8n stops retrying, the data doesn't change twice |
| 7 | `JSON.parse(raw)`, shape, `event` belongs to the path, key == `${data.jobId}:${event}` | 400 (release the key) | Parsing only after authentication; the key header is unsigned |
| 8 | Save the minimal state (`ready`, document link) | 404 unknown job / 500 (release the key) | Must happen **before** the 2xx |
| 9 | Answer 202 `{"ok": true}` | — | |
| 10 | Slow follow-ups (emails, notifications) in `after()` | — | n8n doesn't wait for them |

Error bodies are short codes (`{"error": "unauthorized"}`): no reason for a 401, no stack, no SQL.

## 2. Why the raw body

HMAC is computed over bytes. `await request.json()` followed by `JSON.stringify(body)` gives
different bytes (key order, spacing, unicode escapes), so a valid signature stops matching. Worse,
some code then "fixes" it by comparing loosely. Also, a request body can be read only once: after
`request.json()` there is no raw text left to verify. So: `request.text()` first, verify, and only
then `JSON.parse(raw)`.

## 3. Why a length check and `timingSafeEqual`

- `===` on strings stops at the first differing character. Its timing leaks how much of a forged
  signature was right. `crypto.timingSafeEqual` takes the same time regardless of where the
  difference is.
- `timingSafeEqual` **throws** when the buffers differ in length, so compare lengths first and treat
  a mismatch as "invalid".
- Compare the whole header value `sha256=<hex>` as UTF-8 bytes against the expected string. Don't
  decode with `Buffer.from(hex, "hex")`: it silently stops at the first non-hex character, so
  different header values can decode to the same bytes.

## 4. Why a ±300 s window

The timestamp is inside the signed string, so an attacker can't change it without breaking the
signature. The window limits how long an intercepted callback stays usable. It works both ways
(`Math.abs(now - ts) > 300`), which also rejects timestamps from the future. 300 s is our decision
to allow clock drift and n8n retries. The n8n docs don't define a window.

## 5. Why the key must match the signed body

HMAC covers `${timestamp}.${raw}`, not the `idempotency-key` header. Someone who intercepted one
signed callback could, within the 300 s window, send the same bytes with a **new** key. Step 6
would see a new key, and the app would process the result a second time. Requiring
`key === ${data.jobId}:${event}` (values from the signed body) closes this: a repeat with the same
key is a duplicate (200), and the same bytes under any other key are a 400.

## 6. Why save before answering, and release on failure

- After a 2xx, n8n never sends that callback again. If the only write of the result lived in
  `after()` and failed, the result would be lost for good. So the minimal state is written before
  the 202, and only slow extras go to `after()`.
- The key is claimed at step 6, before parsing. If step 7 or 8 then fails (bad shape, unknown job,
  a database error), the key must be **released**. Otherwise n8n's Retry On Fail gets 200
  `{"duplicate": true}` for a callback that was never processed, and the result is lost.

## 7. Where to keep the keys and the state

- Callback keys: a database table or KV entry with a **unique** constraint on the key (the insert
  is the claim). Process memory is for demos only: serverless instances don't share memory.
- A demo store in memory must live on `globalThis`. In a Next.js 16 build (tested: 16.3.5, the
  default Turbopack `next build` + `next start`), the callback Route Handler and the page that shows
  the status get separate copies of module-level variables. The route saves `ready`, and the page
  never sees it.
- Find the record by `data.requestIdempotencyKey` (the key the app generated and stored), not only
  by `jobId`: the 202 carrying `job_id` may have been lost, the callback still arrives.

## 8. Things around the route

- **Session checks.** `proxy.ts` (formerly middleware) or a layout that requires a session must not
  cover `/api/n8n/*`: n8n has no cookie. The signature is the authentication.
- **`data.status: "failed"`** is a normal, signed outcome: save `failed` (+ `error.code`), answer
  202. Don't turn it into a 4xx, or n8n will retry it.
- **Logs**: path, `x-correlation-id`, status, duration, body length and sha256. Never the body, the
  signature, the secret or personal data from `data`.
- **No `export const runtime`**: the default Node.js runtime has `node:crypto`; `edge` is deprecated.

## 9. Sources

- Next.js 16: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) ·
  [route.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) ·
  [backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (a body can be
  read only once) · [after](https://nextjs.org/docs/app/api-reference/functions/after)
- Node.js: [crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- n8n: [HTTP Request (Retry On Fail)](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) ·
  [Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/)
