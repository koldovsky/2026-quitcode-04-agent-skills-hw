# n8n integrations

Every Next.js ↔ n8n integration of this project. Contract: `.claude/skills/integrating-n8n-webhooks`.

| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → callback | `/webhook/quote-request` | Respond to Webhook 202 + callback | _TBD_ |

## `quote-request`

- Started by the Server Action `submitQuoteRequest` (`app/quotes/actions.ts`) from `/quotes/new`,
  inside `after()`. The workflow builds a PDF quote in 40–90 s.
- Request `data` (envelope `version: 1`): `quoteId`, `company`, `description`, `budget` (USD for
  the whole project, or `null`). The client's email is stored in the app and not sent.
- Callback: `POST /api/n8n/quote-request`, events `quote-request.completed` (with
  `result.documentUrl`, an `https:` link to the PDF) and `quote-request.failed` (with `error.code`).
- Status page: `/quotes/[id]` (`queued` → `processing` → `ready` | `failed`).

## Not yet on the contract

- `lead-created`: `submitLead` in `app/actions.ts` posts the whole lead record straight to
  `N8N_WEBHOOK_URL` (no token, idempotency key or timeout). Migrating it changes what the live
  workflow receives, so it needs the client's agreement first.
