# Контракт Next.js ↔ n8n (повністю)

```
Next.js (Server Action / Route Handler)            n8n
  lib/n8n/client.ts ── POST /webhook/<event> ──────▶ Webhook node (Header Auth)
                       x-n8n-token, idempotency-key,  └─ Respond to Webhook: 202 {job_id}
                       x-correlation-id                    … робота воркфлоу …
  app/api/n8n/[event]/route.ts ◀── POST (підписаний) ── HTTP Request node
                       x-n8n-timestamp, x-n8n-signature,  (Crypto node рахує HMAC)
                       idempotency-key
```

## Змінні середовища

Усі — лише серверні. Next.js вбудовує в клієнтський бандл тільки змінні з префіксом
`NEXT_PUBLIC_`, тож у жодної `N8N_*` цього префікса немає.

| Змінна | Що це | Локально |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База production-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення заголовка `x-n8n-token` (= credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | Секрет HMAC колбеків (= Hmac Secret у Crypto credential n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, за якою n8n бачить колбеки | `http://127.0.0.1:3000` |

- Справжні значення — лише в `.env.local` (git-ignored) і в налаштуваннях хостингу. У репозиторії —
  тільки `.env.example` зі значеннями вище.
- Секрет генеруємо: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, Client Component, відповідь дії чи журнал.
- Якщо змінної немає під час виклику — помилка конфігурації (без значень у повідомленні), а не
  «тихий» пропуск виклику.

## Запит Next.js → n8n

**Модуль.** Один файл `lib/n8n/client.ts`, перший рядок `import "server-only";` — імпорт із Client
Component стає помилкою збірки. Прямих `fetch` до n8n поза ним немає.

**URL.** `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` — kebab-case (`lead-created`,
`quote-request`). Одна подія — один шлях (n8n дозволяє один вебхук на пару «шлях + метод»).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію й збережений разом із записом; при повторі — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали обох систем |

**Тіло — конверт:**

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — версія конверта. Нове необов'язкове поле — та сама версія; перейменування чи зміна
  сенсу поля — нова версія (воркфлоу якийсь час приймає обидві).
- `data` — мінімум, потрібний воркфлоу. Не весь рядок з бази: IP, user agent, внутрішні нотатки й
  сирі дані форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу: `${APP_BASE_URL}/api/n8n/<event>`.

**Таймаут.** Кожна спроба — `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`; по закінченні
`fetch` кидає `TimeoutError`. В асинхронному режимі n8n відповідає одразу, тож довга відповідь —
збій, а не «повільний воркфлоу».

**Повтори.** Не більше двох (разом три спроби), пауза 1 с, потім 3 с, і **лише** для: мережевої
помилки, таймауту, 5xx і 524. Завжди з тим самим `idempotency-key`. 4xx не повторюємо: 403 —
неправильний токен, 404 — воркфлоу не опубліковано або це тестовий URL.

**Відповідь.** Дивимось лише на код статусу (і на `job_id` у 202). Текст не парсимо: документація
пише «Workflow got started», а n8n повертає `{"message":"Workflow was started"}`.

**Хто викликає.**

- Дія з UI — Server Action: автентифікація, права й валідація — всередині (правило
  `server-auth-actions` скіла `vercel-react-best-practices`).
- Користувач не чекає на n8n: дія зберігає запис (`status: "queued"` + `idempotencyKey` +
  `correlationId`), повертає лише `{ status, id }`, а виклик із повторами — в `after()` (правило
  `server-after-nonblocking`). Next.js виконує Server Actions **по одній на клієнта**, тож довге
  очікування блокує й наступну дію того ж користувача.
- Результат виклику в `after()` теж зберігаємо: 202 → `status: "processing"` (+ `jobId`), вичерпані
  повтори чи 4xx → `status: "failed"`. Інакше запис назавжди лишиться `queued`.
- Не-React клієнт (інший сервіс, cron) — Route Handler.
- Ніколи `export const runtime = "edge"` — потрібен `node:crypto`, а `edge` у Next.js 16 застарілий.

## Колбек

**Ендпоінт.** `POST /api/n8n/<event>` — `app/api/n8n/[event]/route.ts`. Route Handler — публічний
HTTP-ендпоінт, довіряємо лише підпису.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

**Тіло:**

```json
{
  "version": 1,
  "event": "quote-request.completed",
  "data": {
    "jobId": "5f0c…",
    "status": "completed",
    "correlationId": "9b1e…",
    "requestIdempotencyKey": "c3d4…",
    "result": { "documentUrl": "https://files.example.test/n8n/5f0c….pdf" },
    "completedAt": "2026-09-21T12:00:00.000Z"
  }
}
```

- `data.status` — `completed` або `failed` (тоді замість `result` — `error: { code }`).
- `data.requestIdempotencyKey` — `idempotency-key` нашого запиту: за ним колбек знаходить запис
  (він відомий від створення запису, тож немає гонки з `jobId`, який ми дізнаємось із 202).
- `event` у тілі — `<шлях>.completed` / `<шлях>.failed`, де `<шлях>` — `[event]` з URL.

**Порядок обробки — саме такий:**

1. Подія зі шляху невідома → **404**; `content-type` не `application/json` → **415**. До читання тіла.
2. `const raw = await request.text()`. Тіло читається лише раз; ні `request.json()`, ні
   `JSON.parse` до перевірки підпису — повторна серіалізація змінює байти, і підпис не зійдеться.
3. `raw` більше 64 КБ → **413** (колбек несе посилання, а не файли).
4. `x-n8n-timestamp` не число або відрізняється від поточного часу більш ніж на **300 с** у будь-який
   бік → **401**.
5. `expected = "sha256=" + hmacSha256Hex(N8N_CALLBACK_SECRET, `${timestamp}.${raw}`)`. Порівняти з
   `x-n8n-signature`: спершу довжини буферів (`timingSafeEqual` кидає помилку на різних довжинах),
   потім `crypto.timingSafeEqual`. Не `===`. Не збігається → **401** з тілом без подробиць.
6. «Застовпити» `idempotency-key` (унікальний запис). Уже був → **200** `{ "duplicate": true }`:
   n8n не повторюватиме, а дані не зміняться вдруге.
7. `JSON.parse(raw)` у `try`; перевірити форму. Не та форма, подія в тілі ≠ `<шлях>.completed|failed`
   або `idempotency-key` ≠ `` `${data.jobId}:${body.event}` `` → **400** і **звільнити** ключ.
8. Знайти запис за `data.requestIdempotencyKey`; зберегти мінімальний стан (`ready` + посилання на
   документ, або `failed` + код) **до** відповіді. Не знайдено чи запис упав → звільнити ключ і
   відповісти 4xx/5xx — інакше повтор n8n (Retry On Fail) отримає `duplicate`, і результат загубиться.
9. Відповісти **202** `{ "ok": true }`.
10. Повільне (листи, сповіщення) — в `after()`.

Чому запис до відповіді: отримавши 2xx, n8n колбек не повторить; якби критичний запис жив лише в
`after()` і впав — результат загублено назавжди.

Чому ключ звіряємо з тілом: заголовок `idempotency-key` підписом не захищений. Хто перехопив один
підписаний колбек, міг би в межах 300 с надіслати ті самі байти з новим ключем. Коли ключ мусить
дорівнювати полям підписаного тіла, повтор із тим самим ключем — дублікат, з іншим — 400.

Сховище ключів — база чи KV з унікальним обмеженням. Пам'ять процесу (`Map` на `globalThis`, як
`lib/db.ts`) — лише для демо: на serverless обробники не ділять стан.

## Ідемпотентність з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі; в n8n одразу за Webhook — Remove
  Duplicates за цим ключем.
- n8n → Next.js: Retry On Fail повторює колбек; Next.js відсікає повтори за ключем (крок 6) і приймає
  лише ключ, що збігається з підписаним тілом (крок 7).
- Дублікати неминучі (наші повтори + Retry On Fail) — це не «приємний бонус».

## Журнали

| Пишемо | Не пишемо ніколи |
|---|---|
| подію, напрям, `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP клієнта |
| довжину тіла і його sha256 | токен, підпис, секрет, повний URL з query string |

Помилки у відповідях — без внутрішніх подробиць (стек, SQL, URL n8n).

## Ліміти

| Ліміт | Значення |
|---|---|
| Тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX` на self-hosted) |
| Тіло Server Action | 1 МБ (`serverActions.bodySizeLimit`) |
| Відповідь вебхука на n8n Cloud | 100 с, далі **524** |
| Тестовий URL | 120 с після «Listen for test event» |
| Колбек у Next.js | 64 КБ, вікно часу 300 с (наше рішення) |

Файли не передаємо — лише посилання.

## Реєстр інтеграцій

Кожна інтеграція — рядок у `docs/n8n-integrations.md` проєкту:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я відповідального |
