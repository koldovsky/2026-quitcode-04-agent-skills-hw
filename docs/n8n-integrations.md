# Інтеграції з n8n (реєстр проєкту LeadDesk)

Контракт — скіл `integrating-n8n-webhooks` (`.claude/skills/integrating-n8n-webhooks/`).
Кожна інтеграція — рядок нижче; зміни — через PR разом із кодом.

| event | напрям | шлях n8n | режим | конверт | власник |
|---|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (результат не потрібен) | v1 | команда LeadDesk |
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + підписаний колбек (воркфлоу 40–90 с) | v1 | команда LeadDesk |

`quote-request`: `idempotency-key` = id запиту (UUID), колбек повертає його в `data.requestIdempotencyKey`;
подія колбека `quote-request.completed` (`data.status`: `completed` | `failed`). Налаштування n8n —
`.claude/skills/integrating-n8n-webhooks/references/n8n-side-setup.md`.

Змінні середовища: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`
(див. `.env.example`). Шляхи `webhook`/`webhook-test` у n8n клієнта не змінені.
