# n8n integrations

Every Next.js ↔ n8n integration of this project. Contract: `.claude/skills/integrating-n8n-webhooks`.

| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (200), no callback | _TBD_ |
| `quote-request` | Next.js → n8n → callback | `/webhook/quote-request` | Respond to Webhook 202 + callback | _TBD_ |

## `lead-created`

- Started by the Server Action `submitLead` (`app/actions.ts`) from the public form on `/`, inside
  `after()`: a "for information" event, nobody waits for its result.
- Request `data` (envelope `version: 1`): `leadId`, `name`, `email`, `phone`, `company`, `budget`
  (or `null`), `message`. IP, user agent and the raw form data stay in the app.
- Migrated to the contract from a direct `POST` of the whole lead record to `N8N_WEBHOOK_URL`
  (a `/webhook-test/` URL, no token, idempotency key or timeout). The live workflow has to follow:
  Header Auth `x-n8n-token`, the production path `/webhook/lead-created`, fields under
  `$json.body.data` instead of the top level, Remove Duplicates on `idempotency-key`, then Publish.

## `quote-request`

- Started by the Server Action `submitQuoteRequest` (`app/quotes/actions.ts`) from `/quotes/new`,
  inside `after()`. The workflow builds a PDF quote in 40–90 s.
- Request `data` (envelope `version: 1`): `quoteId`, `company`, `description`, `budget` (USD for
  the whole project, or `null`). The client's email is stored in the app and not sent.
- Callback: `POST /api/n8n/quote-request`, events `quote-request.completed` (with
  `result.documentUrl`, an `https:` link to the PDF) and `quote-request.failed` (with `error.code`).
- Status page: `/quotes/[id]` (`queued` → `processing` → `ready` | `failed`).
