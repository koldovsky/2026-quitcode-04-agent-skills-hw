# Налаштування з боку n8n — текст для клієнта

Воркфлоу — власність клієнта: ми не експортуємо й не імпортуємо його JSON, налаштування передаємо
словами. Приклад для події `quote-request`.

1. **Webhook**: HTTP Method `POST`, Path `quote-request`. Authentication — **Header Auth**, credential:
   Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN` застосунку (неправильний/відсутній → **403**
   «Authorization data is wrong!»). Respond — `Using 'Respond to Webhook' Node` (для подій «до
   відома» — `Immediately`). Фіксовані IP хостингу — Options → IP(s) Allowlist (за проксі —
   `N8N_PROXY_HOPS`). Дані далі — `$json.body`, заголовки — `$json.headers` (у нижньому регістрі).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу (PDF тощо) …
5. **Edit Fields**: `ts` = `{{ Math.floor($now.toSeconds()) }}`; `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}`.
   Підписуємо й відправляємо **один і той самий рядок**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення `{{ $json.ts + '.' + $json.body }}`,
   credential **Crypto** з Hmac Secret = `N8N_CALLBACK_SECRET` застосунку.
7. **HTTP Request**: `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`. Заголовки:
   `x-n8n-timestamp` = `ts`, `x-n8n-signature` = `sha256=` + результат Crypto, `idempotency-key` =
   `{{ $execution.id }}:quote-request.completed`, `x-correlation-id` — з вхідних заголовків.
   Body Content Type **Raw**, Content Type `application/json`, Body = поле `body` (не «JSON → Using
   Fields Below»: серіалізація полів може змінити байти). Options → Timeout `10000`. Settings → Retry On
   Fail, Max Tries `3`, Wait Between Tries `1000`. n8n у Docker, застосунок на хості —
   `host.docker.internal`, не `localhost`.
8. **Save** і **Publish**; після кожної зміни — Publish знову.

Рядок у `docs/n8n-integrations.md` проєкту:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | <ім'я> |
