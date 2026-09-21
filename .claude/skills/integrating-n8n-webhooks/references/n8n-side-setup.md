# Налаштування на боці n8n — словами, без експорту JSON

Воркфлоу клієнта — його власність: ми не експортуємо й не імпортуємо JSON воркфлоу. Цей текст
агент адаптує під подію (`<event>`) і віддає людині, яка має доступ до n8n. Приклад — для
асинхронної події `quote-request` (202 + колбек).

## 1. Webhook

- HTTP Method: `POST`. Path: `<event>` (наприклад, `quote-request`).
- Authentication: **Header Auth**. Credential: Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN`
  (генерується, довгий випадковий рядок). Неправильний чи відсутній заголовок n8n відхиляє з **403**
  ([credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/)).
- Respond: `Using 'Respond to Webhook' Node` (для подій «до відома» — `Immediately`).
- Options → IP(s) Allowlist, якщо хостинг застосунку має фіксовані вихідні IP (за reverse proxy —
  `N8N_PROXY_HOPS`).
- Вхідні дані в наступних вузлах — `$json.body`, заголовки — `$json.headers` (імена в нижньому регістрі).

## 2. Remove Duplicates (одразу після Webhook)

- Operation: **Remove Items Processed in Previous Executions**.
- Value to dedupe on: `{{ $json.headers['idempotency-key'] }}`.
- Наш клієнт повторює запит із тим самим ключем — повтор не запустить роботу вдруге
  ([remove duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/)).

## 3. Respond to Webhook

- Respond With: JSON. Response Code: `202`.
- Response Body: `{"job_id": "{{ $execution.id }}"}`.

## 4. Робота воркфлоу

Генерація PDF, листи, CRM — що завгодно. Файл зберігається в сховищі, у колбек іде лише посилання
(`https://…`).

## 5. Edit Fields (підготувати тіло колбека)

- `ts` = `{{ Math.floor($now.toSeconds()) }}`
- `body` = `{{ JSON.stringify({ version: 1, event: '<event>.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: <посилання на файл> }, completedAt: $now.toISO() } }) }}`

Тіло підписуємо й відправляємо **одним і тим самим рядком**.

## 6. Crypto (v2)

- Action: `Hmac`. Type: `SHA256`. Encoding: `HEX`.
- Value: `{{ $json.ts + '.' + $json.body }}`.
- Credential: **Crypto**, Hmac Secret = `N8N_CALLBACK_SECRET`
  ([crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/),
  [crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/)).
- Увага: офіційний пакет скілів n8n пише, що секрет Crypto node не прив'язується до credential. Для
  Crypto v2 це застаріло — документація й код використовують Hmac Secret із Crypto credential.

## 7. HTTP Request (колбек)

- Method `POST`, URL: `{{ $('Webhook').item.json.body.callbackUrl }}`.
- Send Headers: `x-n8n-timestamp` = `{{ $json.ts }}`, `x-n8n-signature` = `sha256={{ <вихід Crypto> }}`,
  `idempotency-key` = `{{ $execution.id }}:<event>.completed`, `x-correlation-id` = з вхідних заголовків.
- Body Content Type: **Raw**, Content Type `application/json`, Body = `{{ $json.body }}`.
  Чому Raw, а не «JSON → Using Fields Below»: документація n8n не гарантує, що серіалізація полів
  дасть рівно ті байти, які ми підписали.
- Options → Timeout `10000`. Settings → **Retry On Fail**, Max Tries `3`, Wait Between Tries `1000`
  ([HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)).
- n8n у Docker, застосунок на хості → `host.docker.internal`, не `localhost`.

## 8. Save і Publish

- Після **кожної** зміни — Publish знову: n8n 2.x виконує опубліковану версію, а не останні правки
  ([save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows)).
- У застосунку — лише production URL `/webhook/<event>`. Тестовий `/webhook-test/<event>` — тільки у
  власному `.env.local`, поки дивишся дані в редакторі (120 с після «Listen for test event»).

## Помилки воркфлоу

Якщо робота впала — той самий колбек із `data.status: "failed"` і `data.error: { "code": "<код>" }`
замість `result` (Error Trigger або гілка on error). Текст помилки й стеки не надсилаємо.
