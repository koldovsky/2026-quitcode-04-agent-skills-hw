# n8n integrations

Contract: `.claude/skills/integrating-n8n-webhooks`. One row per event.

| event | напрям | шлях n8n | режим | код у застосунку | власник |
|---|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + підписаний колбек на `/api/n8n/quote-request` | `app/quotes/actions.ts`, `app/api/n8n/[event]/route.ts` | — |
| `lead-created` | Next.js → n8n | ⚠️ `/webhook-test/lead-created` | Immediately | `app/actions.ts` (`submitLead`) | — |

## ⚠️ `lead-created` — ще не за контрактом

Інтеграція старша за контракт і потребує окремої задачі разом із клієнтом (зміна тіла зламає його
воркфлоу, а потрібні воркфлоу поля невідомі):

- `.env.example` вказує тестовий URL `/webhook-test/` — працює лише при відкритому редакторі n8n;
- у тілі — весь лід, включно з IP, user agent і `rawPayload`; без конверта `{ version, event, data }`;
- `fetch` поза `lib/n8n/client.ts`: без `x-n8n-token`, `idempotency-key`, таймауту й повторів;
- форма чекає відповіді n8n (виклик не в `after()`).

## `quote-request`

- **Запит** (`data`): `quoteId`, `company`, `description`, `budget` (USD, ціле). Email клієнта в n8n не
  передається.
- **Колбек** (`event`: `quote-request.completed` | `quote-request.failed`): `data.jobId`,
  `data.status`, `data.requestIdempotencyKey`, `data.result.documentUrl` (http/https, для `completed`),
  `data.error.code` (для `failed`).
- Статуси запису: `queued` → `processing` (n8n відповів 2xx) → `completed` / `failed`; `failed` також,
  якщо n8n не прийняв запит після 3 спроб.
