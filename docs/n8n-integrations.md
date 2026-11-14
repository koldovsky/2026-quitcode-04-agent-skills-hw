# n8n integrations

Contract: `.claude/skills/integrating-n8n-webhooks`. One row per event.

| event | напрям | шлях n8n | режим | код у застосунку | власник |
|---|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + підписаний колбек на `/api/n8n/quote-request` | `app/quotes/actions.ts`, `app/api/n8n/[event]/route.ts` | Мар'ян Андрущак |
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (подія «до відома», без колбека) | `app/actions.ts` (`submitLead`) → `lib/n8n/client.ts` | Мар'ян Андрущак |

## `lead-created`

Переведено на контракт під час перенесення прогону B (раніше: тестовий URL `/webhook-test/` у
`.env.example`, весь лід з IP, user agent і `rawPayload` у тілі, `fetch` без токена, таймауту й
повторів, форма чекала відповіді n8n).

- **Запит** (`data`): `leadId`, `firstName`, `lastName`, `email`, `phone`, `company`, `website`,
  `budget`, `message`, `consentMarketing`, `source`, `createdAt` — дані заявки, які потрібні воркфлоу
  менеджерів; **без** IP, user agent, `rawPayload` і внутрішніх полів. Конверт `{ version: 1, event,
  data }` — це **зміна тіла** для воркфлоу клієнта: перед деплоєм узгодити з ним (у n8n поля тепер у
  `$json.body.data`, а не в корені).
- Виклик — в `after()`: відвідувач не чекає n8n; `idempotency-key` створюється один раз на заявку.
- Налаштування n8n — `.claude/skills/integrating-n8n-webhooks/references/n8n-setup.md`, але з
  Respond `Immediately`, без Respond to Webhook і колбека.

## `quote-request`

- **Запит** (`data`): `quoteId`, `company`, `description`, `budget` (USD, ціле). Email клієнта в n8n не
  передається.
- **Колбек** (`event`: `quote-request.completed` | `quote-request.failed`): `data.jobId`,
  `data.status`, `data.requestIdempotencyKey`, `data.result.documentUrl` (http/https, для `completed`),
  `data.error.code` (для `failed`).
- Статуси запису: `queued` → `processing` (n8n відповів 2xx) → `completed` / `failed`; `failed` також,
  якщо n8n не прийняв запит після 3 спроб.
