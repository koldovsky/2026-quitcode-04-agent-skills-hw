# Змінні середовища й виклик n8n (Next.js → n8n)

## Змінні середовища

Усі — **лише серверні**. Next.js вбудовує в клієнтський бандл тільки змінні з префіксом
`NEXT_PUBLIC_`, тож жодна змінна `N8N_*` цього префікса мати не може
([environment variables](https://nextjs.org/docs/app/guides/environment-variables)).

| Змінна | Що це | Приклад для локальної розробки |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База production-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення заголовка `x-n8n-token` (те саме, що в credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | Секрет HMAC для колбеків (те саме, що Hmac Secret у Crypto credential в n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, за якою n8n бачить ендпоінти колбеків | `http://127.0.0.1:3000` |

- Справжні значення — лише в `.env.local` (у `.gitignore`) і в налаштуваннях хостингу.
  У репозиторії — лише `.env.example`: секрети — зі значеннями `change-me-…`, адреси —
  локальні, як у таблиці вище (`/webhook`, ніколи `/webhook-test/`).
- Секрет генеруємо, а не вигадуємо:
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, у Client Component чи в журнал.

## Де живе код виклику

Один модуль `lib/n8n/client.ts`, перший рядок — `import 'server-only'`: тоді імпорт цього
модуля з Client Component — помилка збірки
([server-only](https://nextjs.org/docs/app/getting-started/server-and-client-components)).
Прямих `fetch` до n8n поза цим модулем немає.

## Запит

`POST ${N8N_WEBHOOK_BASE_URL}/<path>`, де `<path>` — ім'я події в kebab-case
(`lead-created`, `quote-request`). Одна подія — один шлях: n8n дозволяє лише один
вебхук на пару «шлях + метод»
([common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/)).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію й збережений разом із записом; при повторі — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали обох систем |

Тіло — конверт:

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — версія конверта. Нове необов'язкове поле — та сама версія; перейменування
  чи зміна сенсу поля — нова версія.
- `data` — **мінімум**, потрібний воркфлоу. Не відправляємо весь рядок з бази: IP, user
  agent, внутрішні нотатки й сирі дані форми n8n не потрібні (те саме, що
  `server-serialization` зі скіла `vercel-react-best-practices`, лише в бік зовнішнього
  виклику, а не клієнта).
- `callbackUrl` — лише для асинхронних воркфлоу (див. `response-modes.md`).

## Таймаут і повтори

- Кожна спроба — `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`; по закінченні
  `fetch` падає з `TimeoutError`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)).
  10 секунд — наше рішення: в асинхронному режимі n8n відповідає одразу після отримання
  запиту, тож довга відповідь означає збій, а не «повільний воркфлоу».
- Не більше двох повторів (разом три спроби), пауза 1 с, потім 3 с, і **лише** для:
  мережевої помилки, таймауту, 5xx і 524. Завжди з тим самим `idempotency-key`.
- 4xx не повторюємо: 403 — неправильний токен, 404 — воркфлоу не опубліковано або це
  тестовий URL. Такі помилки треба виправляти, а не повторювати.
- Відповідь n8n дивимось лише за **кодом статусу**. Текст повідомлення не парсимо: для
  режиму Immediately документація пише «Workflow got started», а код n8n повертає
  `{"message":"Workflow was started"}` — розбіжність задокументована, парсити текст не
  можна покладатись.

## Хто викликає

- Дія з UI — Server Action. Server Action — публічний POST-ендпоінт: автентифікація,
  перевірка прав і валідація — всередині неї (правило `server-auth-actions` зі скіла
  `vercel-react-best-practices`, не повторюємо його тут).
- Користувач не чекає на n8n. Server Action зберігає запис (наприклад, статус `queued`),
  повертає лише `{ status, id }`, а виклик n8n із повторами виконується в `after()`
  (правило `server-after-nonblocking`; [after](https://nextjs.org/docs/app/api-reference/functions/after)).
  Причина не лише в швидкості: Next.js виконує Server Actions **по одній на клієнта**,
  тож довге очікування блокує наступну дію того ж користувача
  ([server actions](https://nextjs.org/docs/app/guides/server-actions)).
- Не-React клієнт (інший сервіс, cron) — Route Handler.
- Ніколи `export const runtime = 'edge'`: у Next.js 16 `edge` застарілий, а нам потрібен
  `node:crypto`
  ([runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)).
