# Контракт Next.js ↔ n8n — деталі

```
Next.js (Server Action / Route Handler)              n8n
  lib/n8n/client.ts ── POST /webhook/<event> ───────▶ Webhook (Header Auth)
                       x-n8n-token, idempotency-key,    └─ Respond to Webhook: 202 {job_id}
                       x-correlation-id                      … робота воркфлоу …
  app/api/n8n/[event]/route.ts ◀── POST, підписаний ── HTTP Request (Crypto рахує HMAC)
                       x-n8n-timestamp, x-n8n-signature,
                       idempotency-key, x-correlation-id
```

## Змінні

| Змінна | Що це | `.env.example` |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | база production-URL, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | значення `x-n8n-token` (= credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | секрет HMAC колбеків (= Hmac Secret у Crypto credential) | `change-me-callback-secret` |
| `APP_BASE_URL` | адреса застосунку, за якою n8n бачить колбек-роути | `http://127.0.0.1:3000` |

- Усі серверні: Next.js вбудовує в клієнтський бандл лише `NEXT_PUBLIC_*`, тому цього префікса в
  `N8N_*` немає ніколи.
- Справжні значення — лише `.env.local` (git-ignored) і налаштування хостингу.
- Секрет генеруємо: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет і токен не йдуть у query string, Client Component, журнал чи відповідь API.

## Запит Next.js → n8n

- Один модуль `lib/n8n/client.ts`, перший рядок `import "server-only"` (імпорт із Client Component
  стане помилкою збірки; пакет у Next.js 16 ставити не обов'язково). Прямих `fetch` до n8n поза
  модулем немає.
- `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` — kebab-case (`quote-request`). Одна подія — один
  шлях: n8n дозволяє один вебхук на пару «шлях + метод».

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію й збережений із записом; у повторах — той самий |
| `x-correlation-id` | UUID ланцюжка дій; той самий пишемо в журнали |

Тіло — конверт:

```json
{ "version": 1, "event": "quote-request",
  "data": { "quoteId": "q_…", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request" }
```

- `version`: нове необов'язкове поле — та сама версія; перейменування чи зміна сенсу — нова.
- `data` — мінімум, потрібний воркфлоу; не весь рядок з бази (без IP, user agent, нотаток, сирих даних форми).
- `callbackUrl` — лише для асинхронних воркфлоу, будується з `APP_BASE_URL`.
- **Таймаут:** кожна спроба `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`. В асинхронному
  режимі n8n відповідає одразу, тож довга відповідь — це збій.
- **Повтори:** ≤ 2 (разом 3 спроби), паузи 1 с і 3 с, лише мережева помилка, таймаут, 5xx і 524,
  завжди з тим самим `idempotency-key`. 4xx не повторюємо: 403 — неправильний токен, 404 — воркфлоу
  не опубліковано або це тестовий URL.
- **Відповідь:** дивимось лише на код статусу; текст не парсимо (документація пише «Workflow got
  started», код n8n повертає `Workflow was started`).
- **Хто викликає:** Server Action (UI) або Route Handler (інший сервіс, cron). Дія — публічний POST:
  сесія, права й валідація всередині (`server-auth-actions`). Користувач не чекає n8n: запис зі статусом
  `queued` → відповідь `{ status, id }` → виклик з повторами в `after()` (`server-after-nonblocking`;
  Server Actions одного клієнта виконуються по одній, довге очікування блокує наступну дію).
- Ніколи `export const runtime = "edge"`: потрібен `node:crypto`, а `edge` у Next.js 16 застарілий.

## Колбек

`POST /api/n8n/<event>` — `app/api/n8n/[event]/route.ts`. Route Handler — публічний ендпоінт,
довіряємо лише підпису.

| Заголовок | Значення |
|---|---|
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event з тіла>`, напр. `5f0c…:quote-request.completed` |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

Тіло: `{ "version": 1, "event": "quote-request.completed", "data": { "jobId", "status":
"completed" | "failed", "correlationId", "requestIdempotencyKey", "result": { "documentUrl" } |
"error": { "code" }, "completedAt" } }`. `data.requestIdempotencyKey` — наш ключ із запиту: за ним
знаходимо запис.

**Порядок обробки:**

1. Подія зі шляху невідома → **404**; `content-type` не `application/json` → **415**. До читання тіла.
2. `const raw = await req.text()` — тіло читається один раз; `req.json()`/`JSON.parse` до підпису
   змінюють байти, і підпис не зійдеться.
3. Тіло > 64 КБ → **413** (колбек несе посилання, а не файли).
4. `|now − x-n8n-timestamp| > 300 с` → **401** (захист від повторного відтворення).
5. HMAC від `` `${timestamp}.${raw}` ``; порівняння: спершу довжини, потім `crypto.timingSafeEqual`
   (кидає на різних довжинах). Не `===`. Не збігається → **401** без подробиць.
6. «Застовпити» `idempotency-key` (унікальний запис). Вже був → **200** `{ "duplicate": true }`.
7. `JSON.parse(raw)` + перевірка форми; подія в тілі ≠ `<event зі шляху>.completed`/`.failed` або
   ключ ≠ `` `${data.jobId}:${event}` `` → **400** (заголовок ключа не підписаний — звіряємо з тілом).
8. Зберегти мінімальний стан (статус, посилання на документ) **до** відповіді. Обробка впала на
   кроках 7–8 → **звільнити** ключ, інакше повтор n8n (Retry On Fail) отримає `duplicate` і результат
   загубиться.
9. **202** `{ "ok": true }`.
10. Повільне (листи, сповіщення) — в `after()`.

Сховище ключів — база чи KV з унікальним обмеженням; пам'ять процесу — лише для демо (serverless не
ділить стан між запитами).

## Ідемпотентність з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі; в n8n одразу за Webhook —
  Remove Duplicates за цим ключем.
- n8n → Next.js: Retry On Fail повторює колбек; Next.js відсікає повтори (крок 6) і приймає лише ключ,
  що збігається з підписаним тілом (крок 7).

## Журнали

| Пишемо | Ніколи |
|---|---|
| подію, напрям, `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP |
| довжину тіла, його sha256 | токен, підпис, секрет, URL з query string |

Помилки у відповідях — без стеку, SQL і URL n8n.

## Ліміти

| Ліміт | Значення |
|---|---|
| Тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX`) |
| Тіло Server Action | 1 МБ (`serverActions.bodySizeLimit`) |
| Відповідь вебхука на n8n Cloud | 100 с, далі 524 |
| Тестовий URL | 120 с після «Listen for test event» |
| Колбек у Next.js | 64 КБ, вікно 300 с (наше рішення) |

## Відомі пастки

- Текст відповіді Immediately у документації й коді n8n різний — тому дивимось на код статусу.
- Чужі скіли пишуть, що Header Auth відхиляє з **401**; насправді n8n повертає **403** «Authorization
  data is wrong!» (401 — для Basic Auth і JWT).
- Твердження «секрет Crypto не прив'язується до credential» застаріле: Crypto v2 бере Hmac Secret із
  Crypto credential.
- Приклад вебхука в документації Next.js передає токен у `?token=` у GET і порівнює `!==` — ми робимо
  суворіше: заголовок, підпис, `timingSafeEqual`.
