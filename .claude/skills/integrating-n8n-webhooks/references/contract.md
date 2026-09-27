# Contract: Next.js → n8n

## Env

All variables are server-only. Next.js inlines only `NEXT_PUBLIC_*` into the client bundle, so no
`N8N_*` variable ever gets that prefix.

| Variable | Meaning | Local value in `.env.example` |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | Base of **production** webhook URLs, ends with `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Value of the `x-n8n-token` header = the Header Auth credential in n8n | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | HMAC secret for callbacks = Hmac Secret of the Crypto credential in n8n | `change-me-callback-secret` |
| `APP_BASE_URL` | Where n8n reaches our callback endpoints | `http://127.0.0.1:3000` |

- Real values live only in `.env.local` (git-ignored) and in the hosting settings.
- Generate secrets: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- A secret never goes into a query string, a Client Component or a log.
- Missing variable at runtime → the trigger returns a config error and logs `n8n config missing`
  (the variable **name**, never a value); it does not fall back to anything.

## Where the code lives

`lib/n8n/client.ts`, first line `import "server-only"` — importing it from a Client Component is
then a build error. No direct `fetch` to n8n outside this module. Callers use one exported
function per concern (e.g. `triggerWorkflow`).

## Request

`POST ${N8N_WEBHOOK_BASE_URL}/<event>`; `<event>` is the event name in kebab-case
(`lead-created`, `quote-request`). One event — one path: n8n allows a single webhook per
path + method.

| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID generated **once** per business operation, stored with the record, reused on every retry |
| `x-correlation-id` | UUID of the chain of actions; the same id goes into both systems' logs |

Envelope:

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — adding an optional field keeps the version; renaming a field or changing its meaning
  is a new version, and the workflow accepts both for a while.
- `data` — the minimum the workflow uses. Not the DB row: no IP, user agent, internal notes or raw
  form payload.
- `callbackUrl` — only for asynchronous workflows: `${APP_BASE_URL}/api/n8n/<event>`.

## Timeout

Every attempt: `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`; on expiry fetch rejects with
`TimeoutError`. 10 s is our choice: in async mode n8n answers right after receiving the request, so
a slow answer means a failure, not a "slow workflow".

## Retries

At most **2 retries (3 attempts)**, pauses 1 s then 3 s, and only for: network error, timeout,
5xx, 524. Always the same `idempotency-key`. Never retry 4xx — 403 is a wrong token, 404 is an
unpublished workflow or a test URL: these need fixing, not repeating.

Judge the answer by the **status code only**. Do not parse the message text: the docs say
"Workflow got started", n8n's code returns `{"message":"Workflow was started"}`.

## Who calls

- UI action → Server Action. It is a public POST endpoint: authentication, permissions and
  validation inside it (`server-auth-actions` from `vercel-react-best-practices`).
- The user does not wait for n8n: the action saves the record (status `queued`), returns only
  `{ status, id }`, and the trigger with retries runs in `after()` (`server-after-nonblocking`).
  Next.js also runs Server Actions **one at a time per client**, so a long wait would block the
  user's next action too.
- Non-React caller (another service, cron) → Route Handler.
- Never `export const runtime = "edge"` — deprecated in Next 16 and we need `node:crypto`.

## Test vs production URL

| | Test URL | Production URL |
|---|---|---|
| Path | `/webhook-test/<path>` | `/webhook/<path>` |
| Works | 120 s after "Listen for test event" (or a manual run) | while the workflow is **published** |
| Data visible in the editor | yes | no |

- Code and `.env.example` — **only** `/webhook`. A test URL may go into your own `.env.local`
  temporarily while you watch data in the editor.
- n8n 2.x: publishing pins a workflow version; production calls use it, not the latest edits —
  publish again after changes.
- Self-hosted n8n may rename the paths (`N8N_ENDPOINT_WEBHOOK`, `N8N_ENDPOINT_WEBHOOK_TEST`); if a
  client did, record it in the project's `docs/n8n-integrations.md`.

## Idempotency on both sides

- Next.js → n8n: same `idempotency-key` on every attempt; in n8n, right after the Webhook node,
  Remove Duplicates keyed by it (see `n8n-setup.md`).
- n8n → Next.js: n8n's Retry On Fail repeats callbacks; the route drops repeats by
  `idempotency-key` and accepts only a key that matches the signed body (see `callback.md`).
- Our retries plus n8n's retries make duplicates inevitable — idempotency is not optional.

## Integration registry

Every integration is a row in the project's `docs/n8n-integrations.md`:

| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → callback | `/webhook/quote-request` | Respond to Webhook 202 + callback | <name> |
