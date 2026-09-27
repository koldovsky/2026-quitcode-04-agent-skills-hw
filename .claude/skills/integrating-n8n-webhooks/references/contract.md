# Контракт Next.js → n8n: деталі

## Змінні середовища

Next.js вбудовує в клієнтський бандл лише змінні з `NEXT_PUBLIC_`, тож без префікса змінна
лишається на сервері. Усі змінні інтеграції — серверні.

| Змінна | Призначення | `.env.example` (локально) |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | база production-вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | значення `x-n8n-token`; те саме, що в credential Header Auth в n8n | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | ключ HMAC колбеків; те саме, що Hmac Secret у Crypto credential в n8n | `change-me-callback-secret` |
| `APP_BASE_URL` | адреса застосунку, яку бачить n8n (для `callbackUrl`) | `http://127.0.0.1:3000` |

- Справжні значення — лише `.env.local` (у `.gitignore`) і налаштування хостингу.
- Секрет генерує людина: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет не йде в query string, Client Component, журнал чи відповідь.
- Змінні читаються на старті: після зміни `.env.local` — перезапуск `npm start`.

## Запит до n8n

- Один модуль `lib/n8n/client.ts`, першим рядком `import "server-only"` — імпорт у Client
  Component стає помилкою збірки. Прямих `fetch` до n8n поза ним немає.
- `POST ${N8N_WEBHOOK_BASE_URL}/<event>`; `<event>` — kebab-case (`lead-created`,
  `quote-request`). Один шлях — одна подія: n8n реєструє один вебхук на пару «шлях + метод».
- Заголовки: `content-type: application/json`, `x-n8n-token`, `idempotency-key`,
  `x-correlation-id`.
  - `idempotency-key` — UUID, створений один раз на бізнес-операцію (наприклад, при створенні
    запису кошторису) і збережений з записом. Повтор — той самий ключ; n8n відсікає дублі вузлом
    Remove Duplicates.
  - `x-correlation-id` — UUID ланцюжка; пишеться в журнали обох систем і повертається в колбеку.
- Конверт:
  ```json
  { "version": 1, "event": "quote-request",
    "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
    "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request" }
  ```
  - `version` міняється лише при перейменуванні чи зміні сенсу поля; нове необов'язкове поле —
    та сама версія. На час переходу воркфлоу приймає обидві.
  - `data` — те, що потрібне воркфлоу. Не весь рядок з бази: IP, user agent, внутрішні нотатки,
    сирі дані форми n8n не потрібні.
  - `callbackUrl` — лише для асинхронних воркфлоу.

## Таймаут і повтори

- Кожна спроба: `signal: AbortSignal.timeout(10_000)`. Після 10 с `fetch` падає з `TimeoutError`.
  В асинхронному режимі n8n відповідає одразу, тож 10 с без відповіді — це збій.
- До 2 повторів (разом 3 спроби), паузи 1 с і 3 с; повторюємо лише мережеву помилку, таймаут, 5xx
  і 524. 4xx — не повторюємо: 403 — неправильний токен, 404 — воркфлоу не опубліковано або
  тестовий URL. Це виправляють, а не повторюють.
- У відповіді дивимось лише на **код статусу**. Текст не парсимо (документація й код n8n пишуть
  різне). Для 202 з тіла можна взяти `job_id`.

## Хто викликає

- З UI — Server Action. Це публічний POST-ендпоінт: сесія, права, валідація — всередині
  (`server-auth-actions`). Дія зберігає запис (`status: "queued"`, `idempotencyKey`,
  `correlationId`) і повертає `{ status, id }`; виклик n8n — в `after()` (`server-after-nonblocking`).
- Чому не чекати в дії: крім швидкості, Next.js виконує Server Actions клієнта по одній — довге
  очікування блокує наступну дію того ж користувача.
- Не-React клієнти (інший сервіс, cron) — Route Handler.
- Runtime — Node.js. `export const runtime = "edge"` у Next.js 16 застарів, а нам потрібен `node:crypto`.

## Режими відповіді вебхука

| Режим | Що отримує Next.js | Для чого |
|---|---|---|
| Immediately | 200 одразу | подія «до відома» (`lead-created`, аналітика) |
| When Last Node Finishes | вихід останнього вузла | коротка довідка за секунди, результат потрібен у відповіді |
| Using Respond to Webhook | що задасть вузол Respond to Webhook | **стандарт для довгих задач:** 202 `{ job_id }`, результат — колбеком |
| Streaming | потік | не використовуємо |

- Усе, що може наблизитись до 100 с, — лише асинхронно. На n8n Cloud вебхук, що не відповів за
  100 с, закінчується **524**, воркфлоу працює далі, а Next.js результату не дізнається.
  Тривалість невідома — вважаємо асинхронним.
- Respond to Webhook спрацьовує один раз. Воркфлоу закінчився, не дійшовши до нього, → 200 зі
  стандартним повідомленням; помилка до нього → 500.

## Тестовий і production URL

| | `/webhook-test/<event>` | `/webhook/<event>` |
|---|---|---|
| Працює | 120 с після «Listen for test event» | поки воркфлоу опублікований |
| Дані видно в редакторі | так | ні |

- У коді й `.env.example` — лише `/webhook`. Тестовий — тимчасово, лише в особистому
  `.env.local`, коли людина дивиться дані в редакторі.
- n8n 2.x: production-виклики йдуть в опубліковану версію; після правок — опублікувати знову.
- Self-hosted може перейменувати шляхи (`N8N_ENDPOINT_WEBHOOK`, `N8N_ENDPOINT_WEBHOOK_TEST`) —
  тоді записати в `docs/n8n-integrations.md`.

## Журнали

| Пишемо | Не пишемо |
|---|---|
| подія, напрям (`out`/`in`), `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP |
| довжина тіла, sha256 тіла | токен, підпис, секрет, URL з query string |

Відповіді з помилкою — без стеку, SQL і URL n8n.

## Ліміти

| Що | Значення |
|---|---|
| тіло вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX` на self-hosted) |
| тіло Server Action | 1 МБ (`serverActions.bodySizeLimit`) |
| відповідь вебхука на n8n Cloud | 100 с, далі 524 |
| тестовий URL | 120 с |
| колбек у Next.js | 64 КБ, вікно часу ±300 с (наше рішення) |

Файли не передаємо — лише посилання.

## Мок для локальної розробки

`scripts/mock-n8n.mjs` поводиться як Webhook + Respond to Webhook + HTTP Request з підписом.

```bash
node scripts/mock-n8n.mjs --help
node scripts/mock-n8n.mjs --mode last-node                                   # синхронно, 2 с
node scripts/mock-n8n.mjs --mode slow --cloud-timeout 5000                   # 524, як на Cloud
node --env-file=.env.local scripts/mock-n8n.mjs --mode respond-202 --delay 5000
```

З `N8N_WEBHOOK_TOKEN` мок вимагає `x-n8n-token` (інакше 403), з `N8N_CALLBACK_SECRET` — через
`--delay` надсилає підписаний колбек на `callbackUrl` із запиту (або `--callback-url`). Тестові
URL — лише з `--listen` і 120 с. У журналі — метод, шлях, статус, час, **імена** заголовків,
розмір і sha256 тіла, `auth=`, `idempotency=new|repeat|absent`; значень і тіл немає.

Ознака старого, «неконтрактного» виклику в журналі мока: `POST /webhook-test/… -> 404` (тестовий
URL без `--listen`) або заголовки без `x-n8n-token` / `idempotency-key` — при цьому форма може
показувати «успіх», бо код не дивиться на статус відповіді.
