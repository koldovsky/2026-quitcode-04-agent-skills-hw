# Інтеграції з n8n

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + підписаний колбек | уточнити |
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately | уточнити |

`lead-created` переведено на `lib/n8n/client.ts` (коміт `bb4a91d`): production URL, `x-n8n-token`,
`idempotency-key`, `x-correlation-id`, виклик в `after()`. У `data`: `leadId`, `fullName`, `email`, `phone`,
`company`, `website`, `budget`, `message`, `consentMarketing`, `source` — без IP, user agent, сирих
даних форми й внутрішніх нотаток (склад узгоджено з власником проєкту).

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
