# Інтеграції з n8n

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + підписаний колбек | уточнити |
| `lead-created` | Next.js → n8n | `/webhook-test/lead-created` (тестовий URL!) | Immediately | уточнити |

`lead-created` поки не відповідає контракту (тестовий URL, повний запис ліда в тілі, без токена й
ключів, `await` у Server Action) — потрібна окрема міграція.

## Що має налаштувати власник воркфлоу `quote-request`

- Webhook: `POST`, Path `quote-request`, Header Auth (`x-n8n-token`), Respond — «Using 'Respond to
  Webhook' Node»; одразу за ним Remove Duplicates за `idempotency-key`, далі Respond to Webhook 202
  `{"job_id": "{{ $execution.id }}"}`.
- Вхідні дані — `body.data`: `quoteId`, `company`, `budget` (число або `null`), `description`.
  Email клієнта не передаємо.
- Після генерації PDF — підписаний колбек на `body.callbackUrl` (Raw JSON, `x-n8n-timestamp`,
  `x-n8n-signature`, `idempotency-key` = `<jobId>:quote-request.completed`, `x-correlation-id`).
  У `data`: `jobId`, `status`, `requestIdempotencyKey` (= вхідний `idempotency-key`),
  `result.documentUrl` (http/https) або `error.code`.
- Retry On Fail на вузлі колбека: 3 спроби, 1000 мс.
