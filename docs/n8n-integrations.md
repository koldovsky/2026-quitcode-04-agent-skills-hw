# Інтеграції з n8n (реєстр проєкту LeadDesk)

Контракт — скіл `integrating-n8n-webhooks` (`.claude/skills/integrating-n8n-webhooks/`).
Кожна інтеграція — рядок нижче; зміни — через PR разом із кодом.

| event | напрям | шлях n8n | режим | конверт | власник |
|---|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (результат не потрібен) | v1 | команда LeadDesk |

Змінні середовища: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`
(див. `.env.example`). Шляхи `webhook`/`webhook-test` у n8n клієнта не змінені.
