# Known traps in docs and third-party skills

- **"Workflow got started" vs `Workflow was started`.** The n8n docs quote the first for the
  Immediately mode, n8n's code returns `{"message":"Workflow was started"}`. That is why we never
  parse the message — only the status code.
- **Header Auth rejects with 403, not 401.** The official n8n skills package says 401; n8n's code
  (`Webhook/utils.ts`) returns 403 "Authorization data is wrong!". 401 is for Basic Auth and JWT.
  Do not branch on 401 for a wrong token.
- **Crypto node secret.** The same package says the Crypto node's secret cannot come from a
  credential. For Crypto v2 that is outdated: docs and code use Hmac Secret from the Crypto credential.
- **Next.js webhook example.** The Next.js guide passes a token in `?token=` of a GET request and
  compares with `!==`. The same guide warns that GET requests may be cached and logged. We use a
  header token, an HMAC signature and `timingSafeEqual`.
- **Test URL that "works".** A `/webhook-test/…` URL answers only for 120 s after "Listen for test
  event"; afterwards it is 404. Code that ignores the status code looks fine locally and silently
  loses every request in production.
- **Re-serialised callback body.** `await req.json()` followed by `JSON.stringify` does not give
  the bytes n8n signed (key order, spacing, unicode escapes) — the signature check fails randomly
  or, worse, someone "fixes" it by signing the parsed object.
- **`AbortSignal.timeout` error name.** It rejects with a `DOMException` named `TimeoutError`
  (not `AbortError`); treat both as retryable.
