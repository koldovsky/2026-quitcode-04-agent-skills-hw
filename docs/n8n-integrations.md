# Інтеграції з n8n

Контракт — скіл `.claude/skills/integrating-n8n-webhooks`. Рядок на кожну подію.

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек `POST /api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{ job_id }` + підписаний колбек (воркфлоу 40–90 с) | _уточнити_ |
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (подія «до відома», результат не потрібен) | _уточнити_ |

## `lead-created`

- Запуск: Server Action `submitLead` (`app/actions.ts`) з публічної форми `/`, виклик n8n — в
  `after()`, форма на n8n не чекає.
- `data`: `{ leadId, company, budget, source }` — без імені, email, телефону, IP, user agent і сирої
  форми. Якщо воркфлоу потрібні контакти — це рішення людини (правило зупинки скіла), не коду.
- `idempotency-key` — новий UUID на кожен лід, однаковий у повторах клієнта (`lib/n8n/client.ts`);
  окремо не зберігається, бо повторюється лише в межах одного `after()`.

## `quote-request`

- Запуск: Server Action `requestQuote` (`app/quotes/actions.ts`) з форми `/quotes/new`, виклик n8n —
  в `after()`. Статус — `/quotes/[id]`.
- `data`: `{ quoteId, company, description, budget }` (`budget` — число або `null`). Email у n8n
  не передається.
- Колбек: `event: "quote-request.completed"`, `data.status` — `completed` з
  `result.documentUrl` (http/https) або `failed` з `error.code`. Запис шукається за
  `data.requestIdempotencyKey`, інакше за `data.jobId`.
- Сховище ключів колбеків — пам'ять процесу (демо); для продакшну — таблиця з унікальним ключем.
