# Контракт Next.js ↔ n8n — повністю

Короткий контракт — у `SKILL.md`. Тут — усі значення й «чому». Відхилення — лише свідомо й
письмово (у PR з поясненням).

```
Next.js                                             n8n
  lib/n8n/client.ts ── POST /webhook/<event> ─────▶ Webhook (Header Auth)
     x-n8n-token, idempotency-key, x-correlation-id    └─ Respond to Webhook: 202 {"job_id"}
                                                            … воркфлоу працює …
  app/api/n8n/[event]/route.ts ◀── POST, підписаний ── HTTP Request (підпис — вузол Crypto)
     x-n8n-timestamp, x-n8n-signature, idempotency-key, x-correlation-id
```

## 1. Змінні середовища — лише серверні

| Змінна | Що це | Локально |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | база **production**-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | значення заголовка `x-n8n-token` = credential Header Auth в n8n | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | HMAC-секрет колбеків = Hmac Secret у Crypto credential n8n | `change-me-callback-secret` |
| `APP_BASE_URL` | адреса застосунку, за якою n8n бачить наші колбек-роути | `http://127.0.0.1:3000` |

- Жодна не має префікса `NEXT_PUBLIC_`: Next.js вбудовує в клієнтський бандл лише змінні з цим
  префіксом (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`).
- У git — тільки `.env.example`: секрети — `change-me-…`, адреси — локальні, **ніколи** `/webhook-test/`.
  Справжні значення — у `.env.local` (git-ignored) і в налаштуваннях хостингу.
- Секрет генеруємо: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет не йде в query string, у Client Component, у журнал.

## 2. Виклик вебхука (Next.js → n8n)

**Де.** Лише `lib/n8n/client.ts`, перший рядок `import "server-only"` (імпорт з Client Component —
помилка збірки; у Next 16 пакет встановлювати не обов'язково). Прямих `fetch` до n8n поза ним немає.

**Запит.** `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` — kebab-case (`lead-created`,
`quote-request`). Одна подія — один шлях: n8n дозволяє один вебхук на «шлях + метод».

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію й збережений із записом; у кожній спробі — той самий |
| `x-correlation-id` | UUID ланцюжка; пишемо в журнали обох систем |

**Тіло — конверт:**

```json
{ "version": 1, "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request" }
```

- `version` — версія конверта: нове необов'язкове поле — та сама версія; перейменування чи зміна
  сенсу — нова версія (n8n якийсь час приймає обидві).
- `data` — **мінімум** для воркфлоу. Не весь рядок з БД: IP, user agent, внутрішні нотатки, сирі дані
  форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу; будуємо з `APP_BASE_URL`.

**Таймаут:** кожна спроба — `signal: AbortSignal.timeout(10_000)` (по закінченні `fetch` падає з
`TimeoutError`). В асинхронному режимі n8n відповідає одразу — довга відповідь означає збій.

**Повтори:** максимум 2 (разом 3 спроби), паузи 1 с і 3 с, **лише** для мережевої помилки, таймауту,
5xx і 524; завжди з тим самим `idempotency-key`. 4xx не повторюємо: 403 — неправильний токен,
404 — воркфлоу не опубліковано або це тестовий URL. Це треба виправляти, а не повторювати.

**Відповідь:** дивимось лише на **код статусу** (і `job_id` у 202). Текст не парсимо: документація
пише «Workflow got started», а n8n повертає `{"message":"Workflow was started"}`.

**Хто викликає:**
- дія з UI — Server Action; автентифікація, права, валідація — всередині (правило Vercel
  `server-auth-actions`);
- користувач не чекає на n8n: дія зберігає запис (`status: "queued"`, `idempotencyKey`,
  `correlationId`), повертає `{ status, id }`, а `triggerWorkflow` з повторами — в `after()` (правило
  Vercel `server-after-nonblocking`). Ще одна причина: Next.js виконує Server Actions **по одній на
  клієнта** — довге очікування блокує наступну дію того ж користувача;
- не-React клієнт (cron, інший сервіс) — Route Handler;
- ніколи `export const runtime = "edge"`: у Next 16 застарілий, а нам потрібен `node:crypto`.

## 3. Колбек (n8n → Next.js)

**Ендпоінт:** `POST /api/n8n/<event>` → Route Handler `app/api/n8n/[event]/route.ts`. Це публічний
HTTP-ендпоінт — довіряємо лише підпису.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час (секунди), коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

**Тіло:**

```json
{ "version": 1, "event": "quote-request.completed",
  "data": { "jobId": "5f0c…", "status": "completed", "correlationId": "9b1e…",
            "requestIdempotencyKey": "c3d4…",
            "result": { "documentUrl": "https://files.example.test/n8n/5f0c….pdf" },
            "completedAt": "2026-09-21T12:00:00.000Z" } }
```

`data.status` — `completed` або `failed` (тоді замість `result` — `error: { code }`). Запис
знаходимо за `data.requestIdempotencyKey` (ключ, який ми зберегли при запуску) — він є в тілі ще до
того, як ми встигли зберегти `job_id` з відповіді 202.

**Порядок обробки — саме такий:**

1. Подія зі шляху невідома → **404**; `content-type` не `application/json` → **415**. До читання тіла.
2. Тіло — **сирим текстом**: `const raw = await req.text()` (читається один раз). Ні `req.json()`, ні
   `JSON.parse` до перевірки підпису: повторна серіалізація змінює байти.
3. Тіло > 64 КБ → **413** (колбек несе посилання, не файли).
4. `x-n8n-timestamp` відрізняється від «зараз» більш ніж на **300 с** у будь-який бік → **401**
   (наш захист від replay; n8n вікна не задає).
5. HMAC від `` `${timestamp}.${raw}` ``; порівняння — спершу довжини, потім `crypto.timingSafeEqual`
   (він кидає помилку на різних довжинах). Не `===`. Не збігається → **401** без подробиць.
6. «Застовпити» `idempotency-key` (унікальний запис). Уже був → **200** `{"duplicate": true}` — n8n не
   повторюватиме, дані не зміняться вдруге.
7. `JSON.parse(raw)` + перевірка форми. Не та форма, подія в тілі не відповідає шляху, або ключ ≠
   `` `${data.jobId}:${event}` `` з тіла → **400**.
8. Зберегти мінімальний стан (`status = ready`, посилання на документ) **до** відповіді. Якщо після
   кроку 6 обробка впала (кроки 7–8) — **звільнити** ключ, інакше повтор n8n отримає `duplicate`, і
   результат загубиться.
9. Відповісти **202** `{"ok": true}`.
10. Повільне (листи, сповіщення) — в `after()`.

Чому запис до відповіді: отримавши 2xx, n8n не повторить; якщо запис жив би лише в `after()` і впав —
результат загублено назавжди.

Чому ключ звіряємо з тілом: заголовок `idempotency-key` підписом не захищений (HMAC — лише від
`timestamp.raw`). Інакше перехоплений колбек можна було б у межах 300 с надіслати з новим ключем і
обробити вдруге. Коли ключ мусить дорівнювати полям підписаного тіла, той самий ключ — дублікат,
інший — 400.

Сховище ключів — БД/KV з унікальним обмеженням. Пам'ять процесу — лише для демо (serverless-інстанси
не ділять стан).

## 4. Ідемпотентність з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі; в n8n одразу за Webhook — Remove
  Duplicates за цим ключем (`references/n8n-setup.md`).
- n8n → Next.js: Retry On Fail повторює колбек; відсікаємо за ключем (крок 6) і приймаємо лише ключ,
  що збігається з підписаним тілом (крок 7).
- Дублікати неминучі з обох боків — це не «бонус».

## 5. Журнали

| Пишемо | Не пишемо ніколи |
|---|---|
| подію, напрям, `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP клієнта |
| довжину тіла, його sha256 | токен, підпис, секрет, повний URL з query string |

Відповіді з помилкою — без внутрішніх подробиць (стек, SQL, URL n8n).

## 6. Ліміти

| Ліміт | Значення |
|---|---|
| Тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX` на self-hosted) |
| Тіло Server Action | 1 МБ за замовчуванням (`serverActions.bodySizeLimit`) |
| Відповідь вебхука на n8n Cloud | 100 с, далі **524** |
| Тестовий URL | 120 с після «Listen for test event» |
| Колбек у Next.js | 64 КБ, вікно 300 с (наше рішення) |

Файли не передаємо — лише посилання.
