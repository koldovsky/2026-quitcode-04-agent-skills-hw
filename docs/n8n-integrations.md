# Інтеграції з n8n

Контракт: `.claude/skills/integrating-n8n-webhooks/SKILL.md`. Увесь вихідний трафік — через
`lib/n8n/client.ts`, колбеки — `app/api/n8n/[event]/route.ts`.

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (подія «до відома») | Vitalii Semerenko (розробка Studio Nova) |
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек `/api/n8n/quote-request` | Vitalii Semerenko (розробка Studio Nova) |

## Що передаємо

- `lead-created`: `{ version: 1, event, data: { leadId, company, source, budget } }`.
  **Зміна проти попередньої версії**: раніше в n8n ішов увесь запис ліда (контакти, IP, user agent,
  сирі дані форми) на `/webhook-test/lead-created` без авторизації. Воркфлоу клієнта треба оновити:
  Header Auth, production-URL, дані — у `body.data`.
- `quote-request`: `{ version: 1, event, data: { quoteId, company, description, budget }, callbackUrl }`.
  Email клієнта в n8n не передаємо — посилання на PDF показуємо на `/quotes/<id>`.
- Колбек `quote-request.completed`: `data.result.documentUrl` — посилання `http(s)` на PDF.
  `quote-request.failed`: `data.status = "failed"`, `data.error.code`.
  Запис кошторису шукаємо за `data.requestIdempotencyKey` (= заголовок `idempotency-key` запиту).

## Налаштування воркфлоу `quote-request` (текст для клієнта)

1. **Webhook**: `POST`, Path `quote-request`, Authentication — Header Auth (Name `x-n8n-token`,
   Value = `N8N_WEBHOOK_TOKEN`), Respond — `Using 'Respond to Webhook' Node`.
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: JSON, код `202`, тіло `{"job_id": "{{ $execution.id }}"}` — одразу, до генерації PDF.
4. … генерація PDF (40–90 с) …
5. **Edit Fields**: `ts` = `{{ Math.floor($now.toSeconds()) }}`, `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: <посилання на PDF> }, completedAt: $now.toISO() } }) }}`.
6. **Crypto** (v2): Hmac, SHA256, HEX, значення `{{ $json.ts + '.' + $json.body }}`, credential Crypto з
   Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request**: `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`, заголовки
   `x-n8n-timestamp` = `ts`, `x-n8n-signature` = `sha256=` + результат Crypto,
   `idempotency-key` = `{{ $execution.id }}:quote-request.completed`, `x-correlation-id` — з вхідних
   заголовків. Body — **Raw**, `application/json`, поле `body` без змін. Timeout `10000`,
   Retry On Fail: 3 спроби, пауза 1000 мс.
8. Гілка помилки — те саме з `event: 'quote-request.failed'`, `status: 'failed'`, `error: { code }`
   замість `result`, і ключем `…:quote-request.failed`.
9. **Save** і **Publish** (після кожної зміни — Publish знову).
