# Налаштування на боці n8n — текстом для клієнта

Воркфлоу клієнта — його власність: JSON воркфлоу не експортуємо й не імпортуємо, код для вузла Code
не пишемо. Налаштування передаємо текстом — цим списком (підстав `<event>`, напр. `quote-request`).

1. **Webhook**: HTTP Method `POST`, Path `<event>`. Authentication — **Header Auth**, credential з
   Name `x-n8n-token` і Value = `N8N_WEBHOOK_TOKEN`. Неправильний/відсутній заголовок → **403**
   «Authorization data is wrong!». Respond — `Using 'Respond to Webhook' Node` (для подій «до
   відома» — `Immediately`). Якщо в хостингу застосунку фіксовані IP — Options → IP(s) Allowlist
   (за reverse proxy — `N8N_PROXY_HOPS`). Далі у вузлах: тіло — `$json.body`, заголовки —
   `$json.headers` (нижній регістр).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення
   `{{ $json.headers['idempotency-key'] }}` — наші повтори не запускають воркфлоу вдруге.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу …
5. **Edit Fields**: `ts` = `{{ Math.floor($now.toSeconds()) }}`, `body` =
   `{{ JSON.stringify({ version: 1, event: '<event>.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}`.
   Тіло підписуємо й відправляємо **одним і тим самим рядком**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення `{{ $json.ts + '.' + $json.body }}`,
   credential **Crypto** з Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request**: `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`. Заголовки:
   `x-n8n-timestamp` = `ts`, `x-n8n-signature` = `sha256=` + результат Crypto,
   `idempotency-key` = `{{ $execution.id }}:<event>.completed`, `x-correlation-id` — з вхідних заголовків.
   Body Content Type — **Raw**, Content Type `application/json`, Body — поле `body` (не «JSON → Using
   Fields Below»: n8n не гарантує ті самі байти, що підписані). Options → Timeout `10000`.
   Settings → Retry On Fail, Max Tries `3`, Wait Between Tries `1000`.
   n8n у Docker, застосунок на хості → `host.docker.internal`, не `localhost`.
8. **Save** і **Publish**. Після кожної зміни — Publish знову.

## Локально — мок замість n8n

`scripts/mock-n8n.mjs` (копія `tools/mock-n8n.mjs`, без залежностей) поводиться як Webhook +
Respond to Webhook + HTTP Request з підписом. Значень він не друкує: у журналі — метод, шлях, статус,
тривалість, імена заголовків, розмір і sha256 тіла, `auth=` і `idempotency=new|repeat|absent`.

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --help
# асинхронний сценарій як у клієнта: Header Auth + 202 + підписаний колбек через 5 с
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
```

- З `N8N_WEBHOOK_TOKEN` у середовищі мок вимагає `x-n8n-token` (інакше 403); з `N8N_CALLBACK_SECRET` —
  надсилає підписаний колбек на `callbackUrl` із запиту.
- `/webhook-test/<path>` мок приймає лише з `--listen` і лише 120 с — як n8n.
- `--mode slow --cloud-timeout 5000` — побачити 524, як на Cloud.

## Реєстр інтеграцій проєкту

Кожна інтеграція — рядок у `docs/n8n-integrations.md`:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я відповідального |
