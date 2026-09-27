# Налаштування на боці n8n і відомі пастки

Воркфлоу клієнта — його власність: ми не експортуємо й не імпортуємо JSON воркфлоу. Налаштування
передаємо власнику текстом — ось так (приклад для `quote-request`).

1. **Webhook**: HTTP Method `POST`, Path — ім'я події (`quote-request`). Authentication — **Header
   Auth**, credential з Name `x-n8n-token` і Value = `N8N_WEBHOOK_TOKEN`. Неправильний чи відсутній
   заголовок → **403** «Authorization data is wrong!». Respond — `Using 'Respond to Webhook' Node`
   (для швидких подій — `Immediately`). Фіксовані IP хостингу — Options → IP(s) Allowlist (за reverse
   proxy — `N8N_PROXY_HOPS`). Далі тіло — `$json.body`, заголовки — `$json.headers` (у нижньому регістрі).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу (генерація PDF тощо) …
5. **Edit Fields**: `ts` = `{{ Math.floor($now.toSeconds()) }}`, `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}`.
   Тіло підписуємо й відправляємо **одним і тим самим рядком**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення `{{ $json.ts + '.' + $json.body }}`,
   credential **Crypto** з Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request**: `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`. Заголовки
   `x-n8n-timestamp` (`ts`), `x-n8n-signature` (`sha256=` + результат Crypto), `idempotency-key`
   (`{{ $execution.id }}:quote-request.completed` — ті самі `jobId` і `event`, що в тілі),
   `x-correlation-id` (з вхідних заголовків). Body Content Type — **Raw**, Content Type
   `application/json`, Body — поле `body`. Options → Timeout `10000`. Settings → Retry On Fail,
   Max Tries `3`, Wait Between Tries `1000`. n8n у Docker, застосунок на хості — `host.docker.internal`.
8. **Save** і **Publish**. Після кожної зміни — Publish знову.

Чому Raw, а не «JSON → Using Fields Below»: n8n не гарантує, що серіалізація полів дасть ті самі
байти, що ми підписали.

## Відомі пастки документації й чужих скілів

- Документація: «Workflow got started»; код n8n: `Workflow was started` — текст відповіді не парсимо.
- Офіційний пакет скілів n8n пише, що Header Auth відхиляє з **401**; код n8n повертає **403**
  («Authorization data is wrong!»). 401 — для Basic Auth і JWT.
- Той самий пакет пише, що секрет вузла Crypto не прив'язується до credential. Для Crypto v2 це вже
  не так: використовується Hmac Secret із Crypto credential.
- Приклад вебхука в документації Next.js передає токен у `?token=` у GET і порівнює через `!==`.
  GET-запити кешуються й потрапляють у журнали. Ми: токен у заголовку, підпис, `timingSafeEqual`.

## Поза межами

- Побудова й зміна воркфлоу в редакторі n8n, експорт чи імпорт JSON.
- Код для вузла Code.
- Черги й фонові воркери: для наших об'ємів вистачає `after()` і колбеків.
