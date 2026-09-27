# Налаштування на боці n8n (словами, без експорту JSON)

Воркфлоу клієнта — його власність; ми не експортуємо й не імпортуємо JSON воркфлоу.
Налаштування передаємо текстом клієнту чи колезі — ось так.

1. **Webhook**: HTTP Method `POST`, Path — ім'я події (`quote-request`). Authentication —
   **Header Auth**, credential з Name `x-n8n-token` і Value = `N8N_WEBHOOK_TOKEN`.
   Неправильний чи відсутній заголовок n8n відхиляє з **403** «Authorization data is
   wrong!» ([credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/)) —
   не 401, див. `known-pitfalls.md`. Respond — `Using 'Respond to Webhook' Node` (для
   швидких подій — `Immediately`). Якщо хостинг застосунку має фіксовані IP —
   Options → IP(s) Allowlist (за reverse proxy — `N8N_PROXY_HOPS`). Вхідні дані в
   наступних вузлах — `$json.body`, заголовки — `$json.headers` (імена в нижньому
   регістрі).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення —
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло
   `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу (генерація PDF тощо) …
5. **Edit Fields**: поле `ts` = `{{ Math.floor($now.toSeconds()) }}`, поле `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, … } }) }}`.
   Тіло підписуємо й відправляємо **одним і тим самим рядком**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення
   `{{ $json.ts + '.' + $json.body }}`, credential **Crypto** з Hmac Secret =
   `N8N_CALLBACK_SECRET` ([crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/),
   [crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/)).
7. **HTTP Request**: `POST` на `callbackUrl` із запиту
   (`{{ $('Webhook').item.json.body.callbackUrl }}`). Заголовки `x-n8n-timestamp`,
   `x-n8n-signature` (`sha256=` + результат Crypto), `idempotency-key`
   (`{{ $execution.id }}:quote-request.completed` — ті самі `jobId` і `event`, що в
   тілі), `x-correlation-id` (з вхідних заголовків). Body Content Type — **Raw**,
   Content Type `application/json`, Body — поле `body`. Options → Timeout `10000`.
   Settings → Retry On Fail, Max Tries `3`, Wait Between Tries `1000`
   ([HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)).
   Якщо n8n у Docker, а застосунок на хості — `host.docker.internal`, не `localhost`.
8. **Save** і **Publish**. Після кожної зміни — Publish знову.

**Чому Raw, а не «JSON → Using Fields Below»:** документація n8n не гарантує, що
серіалізація полів дасть точно ті самі байти, що ми підписали.