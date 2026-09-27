# The Next.js ↔ n8n contract in detail

What `SKILL.md` states in one line, with the values, the reasons and the sources.

## Contents

1. Environment variables
2. Next.js → n8n: the request
3. Timeout, retries and reading the answer
4. Who calls n8n
5. n8n → Next.js: the callback request
6. Idempotency on both sides
7. Record status lifecycle
8. Logs and error replies
9. Limits
10. The integrations registry
11. Sources

## 1. Environment variables

| Variable | Holds | Value in `.env.example` |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | Production base of the webhooks, ends with `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Value of the `x-n8n-token` header = the Header Auth credential in n8n | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | HMAC secret of callbacks = the Hmac Secret of the Crypto credential in n8n | `change-me-callback-secret` |
| `APP_BASE_URL` | Address where n8n reaches this app's callback endpoints | `http://127.0.0.1:3000` |

- **Server-only.** Next.js inlines every `NEXT_PUBLIC_` variable into the browser bundle at build
  time. An `N8N_*` variable with that prefix would hand the token to every visitor. No other
  `N8N_*` names either (`N8N_WEBHOOK_URL` with a full path breaks "one event, one path").
- **Where values live.** Real ones: `.env.local` (git-ignored) and the hosting settings. The
  repository has `.env.example` only: secrets `change-me-…`, addresses local, the base URL on
  `/webhook` and never `/webhook-test/`.
- **Generate, don't invent.** The human runs
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and puts the
  value into `.env.local` and into the n8n credential. The agent never sees or prints it.
- **Never** in a query string, a Client Component, a log line, an error message, a commit or the
  chat.
- Scripts that need the secrets run as `node --env-file=.env.local <script>`: they read the values
  and don't print them.

## 2. Next.js → n8n: the request

**Where.** One module, `lib/n8n/client.ts`, whose first line is `import "server-only"`. Importing
it from a Client Component is then a build error. Next.js ships that package, so there is nothing to
install. No `fetch` to n8n anywhere else.

**URL.** `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, where `<event>` is the kebab-case event name
(`lead-created`, `quote-request`). One event, one path: n8n allows a single webhook per
path + method pair.

**Headers.**

| Header | Value | Why |
|---|---|---|
| `content-type` | `application/json` | n8n parses the body into `$json.body` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` | Header Auth of the Webhook node; wrong or missing → 403 |
| `idempotency-key` | UUID created **once** per business operation, stored with the record | the same value on every retry, so n8n's Remove Duplicates drops repeats |
| `x-correlation-id` | UUID of the whole chain, stored with the record | the same id in the logs of both systems; n8n copies it into the callback |

**Body: the envelope.**

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version`: a new optional field keeps the version. Renaming a field or changing its meaning is a
  new version, and the n8n workflow accepts both for a while. This is why changing an existing
  event's payload needs the human: the client's live workflow reads those fields.
- `data`: the minimum the workflow needs. Never the database row: IP, user agent, internal notes,
  raw form payloads and personal data stay in the app unless the workflow really uses them.
- `callbackUrl`: async workflows only. Build it on the server from `APP_BASE_URL`
  (`${APP_BASE_URL}/api/n8n/<event>`), never from the request's `Host` header.

## 3. Timeout, retries and reading the answer

**Timeout.** Every attempt: `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`. When it
fires, `fetch` rejects with a `TimeoutError`. 10 s is our decision: in async mode n8n answers as
soon as it has the request, so a slow answer means a failure, not a slow workflow.

**Retries.** At most two (three attempts in total), 1 s then 3 s apart, with the same
`idempotency-key`, and only when a retry can help:

| Outcome | Retry? | Meaning |
|---|---|---|
| network error, `TimeoutError` | yes | n8n unreachable or stuck |
| 5xx, 524 | yes | n8n error; 524 = n8n Cloud gave up on a synchronous answer after 100 s |
| 403 | no | `x-n8n-token` doesn't match the Header Auth credential |
| 404 | no | workflow not published, wrong path, or a test URL whose 120 s ran out |
| other 4xx | no | our request is wrong |

4xx is a bug to fix, not to repeat: mark the record `failed`, log the status, tell the human.

**Reading the answer.** Only the status code. Never the message text: the n8n docs describe the
"Immediately" answer as "Workflow got started", while the code returns
`{"message":"Workflow was started"}`. The one exception is the `job_id` in the body of a 202
from Respond to Webhook.

## 4. Who calls n8n

- **From the UI: a Server Action.** It is a public POST endpoint, so authentication, the
  permission check and validation happen inside it (Vercel rule `server-auth-actions`). It saves
  the record (`status: "queued"` + both keys), returns only `{ status, id }`, and calls
  `triggerWorkflow` inside `after()` from `next/server`, in its own `try/catch` (Vercel rule
  `server-after-nonblocking`).
- **Why not `await` n8n in the action.** It's more than speed: Next.js dispatches Server Actions
  one at a time per client, so a long wait also blocks the same user's next action. And
  `void triggerWorkflow()` is not a fix: after the response a serverless function may be frozen,
  while `after()` keeps it alive until the work is done.
- **Non-React callers** (another service, a cron job): a Route Handler, which may wait for the
  trigger.
- **Never `export const runtime = "edge"`.** Edge is deprecated in Next.js 16, and the contract
  needs `node:crypto`.

## 5. n8n → Next.js: the callback request

`POST ${APP_BASE_URL}/api/n8n/<event>`, handled by `app/api/n8n/[event]/route.ts`.

| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix time in seconds when n8n signed the request |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>`, the same values as in the signed body (`5f0c…:quote-request.completed`) |
| `x-correlation-id` | copied from the request that started the workflow |

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

- `data.status` is `completed` or `failed`; a failed one carries `error: { code }` instead of
  `result`. The offline mock sends only `completed`.
- `data.requestIdempotencyKey` is the `idempotency-key` the app sent. That is how the app finds its
  record, even if the 202 with `job_id` never arrived.
- The route's order of checks and the reason for each step are part of the contract, summarised in
  `SKILL.md` step 5.

## 6. Idempotency on both sides

Duplicates are guaranteed, not hypothetical: our retries and n8n's Retry On Fail both produce them.

- **Next.js → n8n:** the same `idempotency-key` on every attempt. Right after the Webhook node, n8n
  has **Remove Duplicates** in "Remove Items Processed in Previous Executions" mode, keyed on the
  `idempotency-key` header.
- **n8n → Next.js:** the HTTP Request node retries the callback (Retry On Fail). The route claims
  the `idempotency-key` in a store with a unique constraint and answers a repeat with 200
  `{"duplicate": true}`. It accepts the key only when it equals `${data.jobId}:${event}` of the
  signed body, because the header itself isn't signed.

## 7. Record status lifecycle

A suggestion that fits the contract:

```
queued ──202──▶ processing ──callback completed──▶ ready
   │                 └───────callback failed────▶ failed
   └──4xx / retries exhausted──────────────────▶ failed
```

- `queued`: saved by the Server Action before anything is sent.
- `processing`: n8n answered 202 (store `job_id`). Only a `queued` record moves here: a fast
  callback may already have set the final state.
- `ready` / `failed`: set by the callback route **before** it answers 202.

## 8. Logs and error replies

| Log | Never log |
|---|---|
| event, direction, `x-correlation-id` | request or response bodies |
| status code, duration, attempt number | name, email, phone, IP of the client |
| body length and its sha256 | token, signature, secret, a full URL with a query string |
| `error.name`, `error.cause?.code` | the whole error object, `error.message`, `process.env` |

Error replies carry a short code (`{"error": "unauthorized"}`), no stack trace, SQL or n8n URL.

## 9. Limits

| Limit | Value | Source |
|---|---|---|
| Body of a request to an n8n webhook | 16 MB (`N8N_PAYLOAD_SIZE_MAX`, adjustable on self-hosted) | n8n Webhook node |
| Body of a Server Action | 1 MB by default (`serverActions.bodySizeLimit`) | Next.js Server Actions |
| Synchronous webhook answer on n8n Cloud | 100 s, then 524 | n8n Webhook common issues |
| Test URL | 120 s after "Listen for test event" | n8n workflow development |
| Callback into Next.js | 64 KB, time window ±300 s | our decision |

Files are never sent in either direction, only links to them.

## 10. The integrations registry

Every integration is a row in the project's `docs/n8n-integrations.md`:

| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → callback | `/webhook/quote-request` | Respond to Webhook 202 + callback | responsible person |

If the client renamed the `webhook` / `webhook-test` path segments on a self-hosted n8n
(`N8N_ENDPOINT_WEBHOOK`, `N8N_ENDPOINT_WEBHOOK_TEST`), write that down here too.

## 11. Sources

- Next.js 16 (local copy: `node_modules/next/dist/docs/`):
  [environment variables](https://nextjs.org/docs/app/guides/environment-variables) ·
  [server and client components / server-only](https://nextjs.org/docs/app/getting-started/server-and-client-components) ·
  [Server Actions](https://nextjs.org/docs/app/guides/server-actions) ·
  [after](https://nextjs.org/docs/app/api-reference/functions/after) ·
  [runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime) ·
  [backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- n8n: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) ·
  [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) ·
  [Webhook credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/) ·
  [Remove Duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/) ·
  [endpoints env](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints)
- Web / Node.js: [AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- Vercel rules referenced by id: [server-auth-actions](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-auth-actions.md) ·
  [server-after-nonblocking](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-after-nonblocking.md)
