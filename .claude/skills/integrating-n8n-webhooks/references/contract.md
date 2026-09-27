# Контракт Next.js ↔ n8n — повністю

Читати, коли пишеш або перевіряєш код виклику вебхука чи колбек-роут. Стисла версія — у `SKILL.md`.

## 1. Змінні середовища (лише серверні)

| Змінна | Що це | Локально (`.env.example`) |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | база **production**-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | значення заголовка `x-n8n-token` (= Value credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | секрет HMAC колбеків (= Hmac Secret у Crypto credential в n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | адреса застосунку, за якою n8n бачить колбек-ендпоінти | `http://127.0.0.1:3000` |

- Жодна `N8N_*` не має префікса `NEXT_PUBLIC_`: Next.js вбудовує такі змінні в клієнтський бандл.
- Справжні значення — лише `.env.local` (у `.gitignore`) і налаштування хостингу. У git — тільки
  `.env.example` з `change-me-…` і локальними адресами.
- Секрет генерують: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, Client Component, журнал чи відповідь.

## 2. Next.js → n8n

- **Один модуль** `lib/n8n/client.ts`, перший рядок — `import "server-only";` (у Next.js 16 пакет
  ставити не треба — фреймворк підставляє його сам). Прямих `fetch` до n8n поза ним немає.
- `POST ${N8N_WEBHOOK_BASE_URL}/<event>`; `<event>` — kebab-case (`quote-request`). Одна подія — один
  шлях (n8n: один вебхук на пару «шлях + метод»).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію і збережений разом із записом; у повторах — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали |

Тіло — конверт:

```json
{ "version": 1, "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request" }
```

- `version` — версія конверта. Нове необов'язкове поле — та сама версія; перейменування чи зміна сенсу —
  нова версія, і воркфлоу якийсь час приймає обидві.
- `data` — **мінімум**, який потрібен воркфлоу. Не весь рядок з бази: IP, user agent, внутрішні нотатки,
  сирі дані форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу: `${APP_BASE_URL}/api/n8n/<event>`.

**Таймаут** кожної спроби — `signal: AbortSignal.timeout(10_000)`. В асинхронному режимі n8n відповідає
одразу, тож довга відповідь — це збій, а не «повільний воркфлоу».

**Повтори:** не більше двох (3 спроби разом), пауза 1 с, потім 3 с, **лише** для мережевої помилки,
`TimeoutError`, 5xx і 524. Завжди той самий `idempotency-key`. 4xx не повторюємо: 403 — неправильний
токен, 404 — воркфлоу не опубліковано або це тестовий URL.

**Відповідь n8n** — дивимось лише на **код статусу**, текст не парсимо (документація пише «Workflow got
started», код повертає `{"message":"Workflow was started"}`).

**Хто викликає.** Дія з UI — Server Action; автентифікація, права й валідація — всередині неї (правило
`server-auth-actions` скіла `vercel-react-best-practices`). Користувач не чекає на n8n: дія зберігає запис
(`status: "queued"`, ключ ідемпотентності, `correlationId`), повертає `{ status, id }` або робить
`redirect`, а виклик n8n з повторами — в `after()` (правило `server-after-nonblocking`). Next.js виконує
Server Actions по одній на клієнта: довге очікування блокує наступну дію того ж користувача.
Не-React клієнт (cron, інший сервіс) — Route Handler. Ніколи `export const runtime = "edge"`: потрібен
`node:crypto`, а `edge` у Next.js 16 застарілий.

## 3. n8n → Next.js: колбек

Ендпоінт `POST /api/n8n/<event>` — Route Handler `app/api/n8n/[event]/route.ts`. Публічний, тож довіряємо
лише підпису.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<body.event>` — ті самі значення, що в підписаному тілі |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

```json
{ "version": 1, "event": "quote-request.completed",
  "data": { "jobId": "5f0c…", "status": "completed", "correlationId": "9b1e…",
            "requestIdempotencyKey": "c3d4…",
            "result": { "documentUrl": "https://files.example.test/n8n/5f0c….pdf" },
            "completedAt": "2026-09-21T12:00:00.000Z" } }
```

`data.status` — `completed` або `failed` (тоді замість `result` — `error: { code }`). Запис знаходимо за
`data.requestIdempotencyKey` — тим ключем, який ми самі надіслали й зберегли.

**Порядок обробки — саме такий:**

| # | Крок | Відповідь |
|---|---|---|
| 1 | подія зі шляху `[event]` невідома; `content-type` не `application/json` — **до** читання тіла | 404 / 415 |
| 2 | тіло — сирим текстом: `const raw = await request.text()`. Ні `request.json()`, ні `JSON.parse` до кроку 5 | — |
| 3 | тіло > 64 КБ | 413 |
| 4 | `x-n8n-timestamp` відрізняється від «зараз» більш ніж на 300 с у будь-який бік | 401 |
| 5 | HMAC від `` `${timestamp}.${raw}` ``; порівняння: спершу довжини, потім `crypto.timingSafeEqual` (кидає на різних довжинах). Не `===` | 401 без подробиць |
| 6 | «застовпити» `idempotency-key` (унікальний запис). Вже був | 200 `{"duplicate": true}` |
| 7 | тепер `JSON.parse(raw)` і перевірка форми; `body.event` відповідає шляху **і** `data.status`: `<event>.completed` лише з `completed`, `<event>.failed` лише з `failed`; ключ **дорівнює** `` `${data.jobId}:${body.event}` `` | 400, ключ **звільнити** |
| 8 | запис за `data.requestIdempotencyKey` не знайдено | 404, ключ звільнити |
| 9 | зберегти мінімальний стан (`status: "ready"`, посилання на документ) **до** відповіді; збій | 500, ключ звільнити |
| 10 | відповісти | **202** `{"ok": true}` |
| 11 | повільне (листи, сповіщення) — в `after()` | — |

- Чому запис до відповіді: отримавши 2xx, n8n колбек не повторить. Якби запис жив лише в `after()` і впав,
  результат загубився б.
- Чому ключ звіряємо з тілом: заголовок `idempotency-key` підписом не захищений. Хто перехопив підписаний
  колбек, міг би в межах 300 с надіслати ті самі байти з новим ключем. Ключ = поля підписаного тіла →
  повтор із тим самим ключем — дублікат, з іншим — 400.
- Чому звільняти ключ: інакше повтор n8n (Retry On Fail — на 5xx і мережеві збої) отримає
  `{"duplicate": true}`, і результат загубиться.
- Сховище ключів — база чи KV з унікальним обмеженням. Пам'ять процесу — лише для демо: на serverless
  обробники не ділять стан.

## 4. Ідемпотентність з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі; у n8n одразу за Webhook — Remove Duplicates
  за цим ключем — це налаштування на боці n8n, його передаємо клієнту текстом.
- n8n → Next.js: Retry On Fail повторює колбек; Next.js відсікає повтори за ключем (крок 6) і приймає лише
  ключ, що збігається з підписаним тілом (крок 7).

## 5. Журнали

| Пишемо | Не пишемо ніколи |
|---|---|
| подію, напрям, `x-correlation-id`, id запису | тіло запиту чи відповіді, `formData` |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP, компанію клієнта |
| довжину тіла й його sha256 | токен, підпис, секрет, повний URL із query string |

Відповіді з помилкою не містять внутрішніх подробиць (стек, SQL, URL n8n).

## 6. Ліміти

| Ліміт | Значення |
|---|---|
| тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX`) |
| тіло Server Action | 1 МБ за замовчуванням (`serverActions.bodySizeLimit`) |
| відповідь вебхука на n8n Cloud | 100 с, далі 524 |
| тестовий URL | 120 с після «Listen for test event» |
| колбек у Next.js | 64 КБ, вікно 300 с (наше рішення) |

Файли не передаємо — лише посилання.
