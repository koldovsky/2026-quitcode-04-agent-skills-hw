# Контракт: заголовки, конверт, коди відповідей

## Змінні середовища (лише серверні)

| Змінна | Значення | Локально |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База production-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення `x-n8n-token` = Value у credential Header Auth в n8n | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | Секрет HMAC колбеків = Hmac Secret у Crypto credential в n8n | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, яку бачить n8n (для `callbackUrl`) | `http://127.0.0.1:3000` |

Next.js вбудовує в клієнтський бандл лише `NEXT_PUBLIC_*`, тож жодна `N8N_*` цього префікса не має.
Секрет генеруй: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

## Next.js → n8n

`POST ${N8N_WEBHOOK_BASE_URL}/<event>` — одна подія, один шлях (n8n дозволяє один вебхук на пару
«шлях + метод»).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію, збережений разом із записом; у повторах — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали обох систем |

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "5b0c…", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `data` — мінімум, потрібний воркфлоу. Не весь рядок БД: IP, user agent, внутрішні нотатки й сирі
  дані форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу.

**Що робити з відповіддю n8n**

| Код | Значення | Дія |
|---|---|---|
| 200 | Immediately / When Last Node Finishes | успіх; текст не парсимо |
| 202 `{"job_id": "…"}` | Respond to Webhook (async) | успіх; зберегти `job_id`, чекати колбек |
| 403 | Header Auth: неправильний/відсутній токен | не повторювати; виправити конфіг |
| 404 | воркфлоу не опубліковано або це тестовий URL | не повторювати; виправити URL / опублікувати |
| 413 | тіло > 16 МБ | не повторювати; слати посилання, не файли |
| 5xx, 524, мережа, таймаут | збій або синхронний запит довше 100 с на Cloud | повтор (≤ 2, пауза 1 с, 3 с), той самий ключ |

## n8n → Next.js (колбек)

`POST ${APP_BASE_URL}/api/n8n/<event>` — Route Handler `app/api/n8n/[event]/route.ts`.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі (у n8n: `{{ $execution.id }}:quote-request.completed`) |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

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

- `data.status` — `completed` або `failed` (тоді замість `result` — `error: { "code": "…" }`).
- `data.requestIdempotencyKey` — ключ запиту, що запустив задачу: за ним застосунок знаходить свій
  запис (для кошторисів ключ = id запиту).
- Заголовок `idempotency-key` підписом не захищений (HMAC рахуємо лише від `` `${ts}.${rawBody}` ``),
  тому роут приймає лише ключ, що дорівнює `` `${data.jobId}:${event}` `` із підписаного тіла. Інакше
  один перехоплений колбек можна відтворювати з новими ключами, доки не мине вікно 300 с.

**Коди відповідей колбек-роуту** (перевіряє `scripts/send-signed-callback.mjs`)

| Ситуація | Код |
|---|---|
| невідома подія в шляху | 404 |
| `content-type` не `application/json` | 415 |
| тіло > 64 КБ | 413 |
| немає `N8N_CALLBACK_SECRET` на сервері | 500 (відхиляємо все, у журнал — причина без значень) |
| час поза вікном ±300 с, нечисловий час, немає або неправильний підпис | 401, порожнє тіло |
| немає `idempotency-key` | 400 |
| ключ уже оброблено | 200 `{"duplicate": true}` |
| не JSON / не та форма / подія в тілі не збігається зі шляхом | 400 |
| `idempotency-key` ≠ `<data.jobId>:<event>` з підписаного тіла | 400 (ключ звільняємо) |
| запис за `requestIdempotencyKey` не знайдено | 404 |
| запис уже прив'язаний до іншого `jobId` (того, що n8n повернув у 202) | 409 (ключ звільняємо) |
| запис уже має фінальний результат (`ready`) | 200 `{"duplicate": true}`, нічого не змінюємо |
| прийнято й збережено | 202 `{"ok": true}` |

Після 4xx/5xx, що сталися **після** «застовпленого» ключа, ключ звільняємо — щоб повтор n8n
(Retry On Fail) міг пройти, коли причину усунуть.

## Версіонування конверта

- Нове **необов'язкове** поле → та сама `version`.
- Перейменування, видалення чи зміна сенсу поля → `version + 1`; воркфлоу n8n якийсь час приймає обидві
  версії (гілка IF за `$json.body.version`), застосунок — теж.
- Номер версії — у рядку реєстру `docs/n8n-integrations.md`.

## Реєстр інтеграцій проєкту

Кожна інтеграція — рядок у `docs/n8n-integrations.md`:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я |
