# Інтеграції з n8n

Контракт — скіл `.claude/skills/integrating-n8n-webhooks`. Змінні — у `.env.example`.

| event | напрям | шлях n8n | режим | код | власник |
|---|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately | `app/actions.ts` (`submitLead`) | — |
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 + колбек | `app/quotes/actions.ts`, `lib/n8n/callbacks.ts` | — |

## `quote-request`

- `data` у запиті: `quoteId`, `company`, `description`, `budget` (число або `null`). Email клієнта в
  n8n не передається.
- Колбек: `quote-request.completed` з `result.documentUrl` (http/https) або `quote-request.failed` з
  `error.code`; `data.requestIdempotencyKey` = заголовок `idempotency-key` із запиту.
- Статуси на `/quotes/[id]`: `queued → processing → ready | failed`.
