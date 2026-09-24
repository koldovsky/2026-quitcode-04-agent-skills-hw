# Налаштування на боці n8n — словами

Воркфлоу належить клієнту: ми не експортуємо й не імпортуємо його JSON і не редагуємо самі. Те, що має
бути налаштовано, передаємо людині текстом — цим списком. Приклад для асинхронної події `quote-request`.

| # | Вузол | Налаштування |
|---|---|---|
| 1 | **Webhook** | Method `POST`; Path = ім'я події (`quote-request`); Authentication **Header Auth** з credential: Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN`; Respond: `Using 'Respond to Webhook' Node` (для подій «до відома» — `Immediately`). Фіксовані IP хостингу — Options → IP(s) Allowlist (за reverse proxy — `N8N_PROXY_HOPS`). Далі тіло — `$json.body`, заголовки — `$json.headers` (імена в нижньому регістрі) |
| 2 | **Remove Duplicates** | Режим «Remove Items Processed in Previous Executions», значення `{{ $json.headers['idempotency-key'] }}` |
| 3 | **Respond to Webhook** | Respond With JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}` |
| 4 | … робота воркфлоу … | напр. генерація PDF (40–90 с — тому асинхронно) |
| 5 | **Edit Fields** | `ts` = `{{ Math.floor($now.toSeconds()) }}`; `body` = `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}` — тіло підписуємо й відправляємо **одним і тим самим рядком** |
| 6 | **Crypto** (v2) | Action `Hmac`, Type `SHA256`, Encoding `HEX`, Value `{{ $json.ts + '.' + $json.body }}`, credential **Crypto** з Hmac Secret = `N8N_CALLBACK_SECRET` |
| 7 | **HTTP Request** | `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`; заголовки `x-n8n-timestamp` = `ts`, `x-n8n-signature` = `sha256=` + результат Crypto, `idempotency-key` = `{{ $execution.id }}:quote-request.completed` (ті самі `jobId` і `event`, що в тілі), `x-correlation-id` — з вхідних заголовків; Body Content Type **Raw**, Content Type `application/json`, Body = поле `body`; Options → Timeout `10000`; Settings → Retry On Fail, Max Tries `3`, Wait Between Tries `1000` |
| 8 | **Save → Publish** | Після кожної зміни — Publish знову (production-URL обслуговує опубліковану версію) |

## Нюанси

- Чому **Raw**, а не «JSON → Using Fields Below»: n8n не гарантує, що серіалізація полів дасть ті самі
  байти, які підписав Crypto, — і підпис не зійдеться.
- Неправильний або відсутній `x-n8n-token` n8n відхиляє з **403** «Authorization data is wrong!»
  (не 401: 401 — для Basic Auth і JWT).
- Crypto v2 бере ключ із Crypto credential (Hmac Secret) — у старих матеріалах пишуть інакше.
- n8n у Docker, застосунок на хості → у `APP_BASE_URL` для колбеків `host.docker.internal`, не `localhost`.
- Respond to Webhook спрацьовує один раз; наступні такі вузли ігноруються. Воркфлоу завершився, не
  дійшовши до нього, — n8n відповідає 200 зі стандартним повідомленням; помилка до нього — 500.
