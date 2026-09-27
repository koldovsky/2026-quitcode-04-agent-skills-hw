# Pitfalls: where sources disagree, and what agents get wrong

When documentation, another skill, a blog post or your own memory says something different from
this skill, this file says which one is right and why.

## Contents

1. Contradictions in docs and other skills
2. Mistakes that look right
3. Sources

## 1. Contradictions in docs and other skills

| Source says | Reality | What we do |
|---|---|---|
| n8n docs: the "Immediately" answer is "Workflow got started" | n8n's code returns `{"message":"Workflow was started"}` | Read the status code only, never the message |
| n8n's official skill pack: Header Auth rejects with **401** | n8n's code answers **403** `Authorization data is wrong!` for Header Auth; 401 is for Basic Auth and JWT | Treat 403 as "wrong token", don't retry |
| The same pack: the Crypto node's secret isn't tied to a credential | Crypto **v2** takes the Hmac Secret from a Crypto credential (docs and code) | Put `N8N_CALLBACK_SECRET` in a Crypto credential |
| Next.js docs, webhook example: token in `?token=` of a GET, compared with `!==` | The same guide warns that GET requests may be cached and logged | Token in a header, HMAC signature over the raw body, `timingSafeEqual` |
| Old examples: `export const runtime = "edge"` for webhooks | Edge is deprecated in Next.js 16 and lacks `node:crypto` | No `runtime` export |
| "Use the test URL while developing" | It lives 120 s after "Listen for test event"; afterwards 404 | Only `/webhook/` in code; a test URL only briefly in your own `.env.local` |

## 2. Mistakes that look right

| Looks fine | Why it breaks | Instead |
|---|---|---|
| `await request.json()`, then `JSON.stringify(body)` to verify | Re-serialisation changes bytes, and the body can't be read twice | `request.text()` → verify → `JSON.parse` |
| `signature === expected` | Timing leak | length check, then `crypto.timingSafeEqual` |
| `Buffer.from(sigHex, "hex")` before comparing | Stops silently at the first non-hex character | Compare the full `sha256=<hex>` string as UTF-8 bytes |
| HMAC over the body only | A captured callback can be replayed forever | HMAC over `${timestamp}.${raw}`, ±300 s |
| Trusting the `idempotency-key` header as is | It isn't signed; same bytes under a new key get processed twice | Require `key === ${data.jobId}:${event}` from the body |
| Claiming the key, then failing without releasing it | n8n's retry gets "duplicate", the result is lost | Release on any 4xx/5xx after the claim |
| `randomUUID()` for `idempotency-key` inside the retry loop | Every retry looks new to Remove Duplicates, so the workflow runs several times | Create it once, store it with the record |
| `fetch` without a signal | Waits for the platform limit (or forever locally) | `AbortSignal.timeout(10_000)` |
| Retrying every error | 403/404 won't fix themselves, and retries hide the bug | Retry only network, timeout, 5xx, 524 |
| `void triggerWorkflow()` in a Server Action | On serverless the function can freeze after the response, and the trigger is lost | `after()` |
| `await triggerWorkflow()` in the action "because it's fast" | The user waits for n8n; actions run one at a time per client | Save, answer, trigger in `after()` |
| Raising timeouts for a 40–90 s workflow | n8n Cloud cuts synchronous answers at 100 s (524) | Respond to Webhook 202 + callback |
| `console.error("n8n failed", error)` | The error can carry a URL or a response body | `error.name`, `error.cause?.code` |
| An in-memory demo store as a module-level `Map` | In a Next.js 16 build the callback Route Handler and the page get separate copies: the page never sees the result | Put demo stores on `globalThis`; use a real DB/KV beyond demos |
| A session check in `proxy.ts` covering `/api/*` | n8n has no cookie: every callback is redirected or rejected | Leave `/api/n8n/*` out; the signature is the auth |
| `callbackUrl` from the request's `Host` header | A forged Host header redirects results | Build it from `APP_BASE_URL` |
| `localhost` in `APP_BASE_URL` with n8n in Docker | `localhost` is the container itself | `host.docker.internal` |
| n8n HTTP Request with "JSON → Using Fields Below" | Serialisation may differ from the signed string | Raw body = the same string that was signed |
| Editing the workflow and testing the production URL | n8n 2.x serves the published version | Publish after every change |

## 3. Sources

- n8n code: [Webhook/utils.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/nodes-base/nodes/Webhook/utils.ts)
  (403 for Header Auth) ·
  [webhook-on-received-response-extractor.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/cli/src/webhooks/webhook-on-received-response-extractor.ts)
  ("Workflow was started")
- n8n docs: [Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/) ·
  [Crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/) ·
  [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) ·
  [workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) ·
  [handle rate limits](https://docs.n8n.io/integrations/builtin/handle-rate-limits)
- Next.js 16: [route.js: webhooks](https://nextjs.org/docs/app/api-reference/file-conventions/route) ·
  [backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) ·
  [runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) ·
  [after](https://nextjs.org/docs/app/api-reference/functions/after) ·
  [Server Actions](https://nextjs.org/docs/app/guides/server-actions)
- Node.js: [crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
