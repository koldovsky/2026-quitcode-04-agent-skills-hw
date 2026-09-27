# Налаштування на боці n8n — текстом для клієнта

Читати, коли треба передати клієнту, як налаштувати воркфлоу під наш код. Воркфлоу клієнта — його
власність: JSON воркфлоу ми не експортуємо й не імпортуємо, будувати чи змінювати воркфлоу в редакторі —
поза межами цього скіла.

1. **Webhook**: HTTP Method `POST`, Path — ім'я події (`quote-request`). Authentication — **Header Auth**,
   credential з Name `x-n8n-token` і Value = `N8N_WEBHOOK_TOKEN`. Неправильний чи відсутній заголовок
   n8n відхиляє з **403** «Authorization data is wrong!». Respond — `Using 'Respond to Webhook' Node`
   (для подій «до відома» — `Immediately`). Фіксовані IP хостингу — Options → IP(s) Allowlist (за reverse
   proxy — `N8N_PROXY_HOPS`). Далі у вузлах: тіло — `$json.body`, заголовки — `$json.headers` (нижній регістр).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу …
5. **Edit Fields**: `ts` = `{{ Math.floor($now.toSeconds()) }}`; `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}`.
   Тіло підписуємо й відправляємо **одним і тим самим рядком**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення `{{ $json.ts + '.' + $json.body }}`,
   credential **Crypto** з Hmac Secret = `N8N_CALLBACK_SECRET` (у Crypto v2 секрет береться з credential).
7. **HTTP Request**: `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`. Заголовки `x-n8n-timestamp`,
   `x-n8n-signature` (`sha256=` + результат Crypto), `idempotency-key`
   (`{{ $execution.id }}:quote-request.completed`), `x-correlation-id` (з вхідних заголовків). Body Content
   Type — **Raw**, Content Type `application/json`, Body — поле `body` (не «JSON → Using Fields Below»:
   n8n не гарантує тих самих байтів, що підписали). Options → Timeout `10000`. Settings → Retry On Fail,
   Max Tries `3`, Wait Between Tries `1000`. n8n у Docker, застосунок на хості — `host.docker.internal`.
8. **Save** і **Publish**. Після кожної зміни — Publish знову.
