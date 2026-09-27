# Налаштування на боці n8n і відомі пастки

Воркфлоу — власність клієнта: ми не експортуємо й не імпортуємо його JSON і не редагуємо його
самі. Людині, яка налаштовує n8n, передаємо текст нижче (підставивши event).

## Що налаштувати (приклад для `quote-request`)

1. **Webhook** — Method `POST`, Path `quote-request`; Authentication **Header Auth** з credential
   Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN` (неправильний чи відсутній → 403 «Authorization
   data is wrong!»). Respond — `Using 'Respond to Webhook' Node` (для подій «до відома» —
   `Immediately`). Фіксовані IP хостингу — Options → IP(s) Allowlist (за reverse proxy —
   `N8N_PROXY_HOPS`). Далі тіло — `$json.body`, заголовки — `$json.headers` (нижній регістр).
2. **Remove Duplicates** — «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook** — JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. …робота воркфлоу…
5. **Edit Fields** — `ts` = `{{ Math.floor($now.toSeconds()) }}`; `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, … } }) }}`.
6. **Crypto** (v2) — Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення
   `{{ $json.ts + '.' + $json.body }}`, credential Crypto з Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request** — `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`; заголовки
   `x-n8n-timestamp` (= `ts`), `x-n8n-signature` (`sha256=` + результат Crypto),
   `idempotency-key` (`{{ $execution.id }}:quote-request.completed` — ті самі значення, що в тілі),
   `x-correlation-id` (із вхідних заголовків). Body Content Type **Raw**, Content Type
   `application/json`, Body — поле `body` (**не** «JSON → Using Fields Below»: серіалізація полів
   не гарантує тих самих байтів, що підписані). Timeout `10000`; Retry On Fail, Max Tries `3`,
   Wait `1000`. n8n у Docker, застосунок на хості → `host.docker.internal`, не `localhost`.
8. **Save → Publish.** Після кожної зміни — Publish знову (production-виклики йдуть в
   опубліковану версію).

## Відомі пастки

| Джерело каже | Насправді | Що робимо |
|---|---|---|
| документація n8n: Immediately відповідає «Workflow got started» | код n8n: `{"message":"Workflow was started"}` | текст відповіді не парсимо, лише код статусу |
| офіційний пакет скілів n8n: Header Auth відхиляє з **401** | код n8n повертає **403**; 401 — для Basic Auth і JWT | очікуємо 403, не повторюємо |
| той самий пакет: секрет вузла Crypto не береться з credential | для Crypto v2 — береться (Hmac Secret у Crypto credential) | секрет — лише в credential, не в полі вузла |
| приклад вебхука в документації Next.js: токен у `?token=` у GET, порівняння `!==` | GET кешується й потрапляє в журнали разом з query | токен — у заголовку, колбек — підпис + `timingSafeEqual` |

## Поза межами скіла

- Побудова й зміна воркфлоу в редакторі n8n, експорт/імпорт JSON воркфлоу.
- Код для вузла Code в n8n.
- Черги й фонові воркери — для наших обсягів вистачає `after()` і колбеків.

## Реєстр інтеграцій проєкту

`docs/n8n-integrations.md` — рядок на подію:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я відповідального |
