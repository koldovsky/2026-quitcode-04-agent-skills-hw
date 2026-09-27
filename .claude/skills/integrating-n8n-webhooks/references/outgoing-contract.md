# Вихідний контракт: Next.js → n8n

## Змінні середовища

Усі — лише серверні (server-only), жодна без префікса `NEXT_PUBLIC_`
([environment variables](https://nextjs.org/docs/app/guides/environment-variables)).

| Змінна | Що це | Приклад для локальної розробки |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База production-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення заголовка `x-n8n-token` | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | Секрет HMAC для колбеків | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, за якою n8n бачить колбеки | `http://127.0.0.1:3000` |

- Справжні значення — лише в `.env.local` (у `.gitignore`). У репозиторії — лише
  `.env.example` зі значеннями `change-me-…` для секретів і локальними адресами
  (`/webhook`, ніколи `/webhook-test/`).
- Секрет генерується, не вигадується:
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, у Client Component чи в журнал.

## Де живе код виклику

Один модуль `lib/n8n/client.ts`, перший рядок — `import 'server-only'`: імпорт цього
модуля з Client Component стає помилкою збірки
([server-only](https://nextjs.org/docs/app/getting-started/server-and-client-components)).
Прямих `fetch` до n8n поза цим модулем немає.

## Запит

`POST ${N8N_WEBHOOK_BASE_URL}/<path>`, `<path>` — ім'я події в kebab-case
(`lead-created`, `quote-request`). Одна подія — один шлях: n8n дозволяє лише один
вебхук на пару «шлях + метод»
([common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/)).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений один раз на бізнес-операцію й збережений разом із записом; при повторі — той самий |
| `x-correlation-id` | UUID ланцюжка дій; той самий пишемо в журнали обох систем |

## Тіло — конверт

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — версія конверта. Перейменування чи зміна сенсу поля — нова версія;
  воркфлоу якийсь час приймає обидві.
- `data` — мінімум, потрібний воркфлоу. Не весь рядок з бази: IP, user agent,
  внутрішні нотатки й сирі дані форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу (див. `response-modes.md`).

## Таймаут і повтори

- `fetch(url, { …, signal: AbortSignal.timeout(10_000) })` — падає з `TimeoutError`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)).
  10с — рішення команди: в асинхронному режимі n8n відповідає одразу після отримання
  запиту, довга відповідь означає збій, не «повільний воркфлоу».
- Не більше двох повторів (разом три спроби), пауза 1с, потім 3с, і лише для: мережевої
  помилки, таймауту, 5xx і 524. Завжди з тим самим `idempotency-key`.
- 4xx не повторюємо: 403 — неправильний токен, 404 — воркфлоу не опубліковано або це
  тестовий URL. Виправляти, не повторювати.

## Хто викликає

- Дія з UI — Server Action (публічний POST-ендпоінт: auth, права, валідація всередині —
  правило `server-auth-actions`).
- Користувач не чекає на n8n: Server Action зберігає запис (напр. статус `queued`),
  повертає лише `{ status, id }`; виклик n8n із повторами — у `after()` (правило
  `server-after-nonblocking`; [after](https://nextjs.org/docs/app/api-reference/functions/after)).
  Next.js виконує Server Actions по одній на клієнта — довге очікування блокує наступну
  дію того ж користувача ([server actions](https://nextjs.org/docs/app/guides/server-actions)).
- Не-React клієнт (інший сервіс, cron) — Route Handler.
- Ніколи `export const runtime = 'edge'`: у Next.js 16 застарілий, а потрібен
  `node:crypto` ([runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)).

## Відповідь n8n

Дивимось лише на код статусу. Текст не парсимо: для Immediately документація каже
«Workflow got started», код n8n повертає `{"message":"Workflow was started"}` — див.
`known-pitfalls.md`.