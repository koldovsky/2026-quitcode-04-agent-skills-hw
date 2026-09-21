# Next.js ↔ n8n: домовленості команди

> Джерело знань для Task C. Записку писали для людей: тут є і «чому», і факти з
> документації з посиланнями. Ваше завдання — упакувати її у скіл (skill)
> `integrating-n8n-webhooks`: у `SKILL.md` — короткий контракт, чекліст, правила
> зупинки й перевірка; деталі — у `references/`; те, що має працювати однаково
> щоразу, — у `scripts/`. Переписувати записку в скіл дослівно не треба.
> Проєкт і дані синтетичні (домени `*.example.test`), значення секретів — `change-me-…`.

## Навіщо це в роботі

Перші кодові проєкти QuitCode — це Next.js-форми й портали поверх автоматизацій,
які вже працюють в n8n: форма запускає воркфлоу (workflow), n8n повідомляє, коли
результат готовий. Без спільних правил кожен проєкт наново вирішує ті самі
питання — і наступає на ті самі граблі:

- у `.env` потрапляє **тестовий** URL вебхука — заявки мовчки губляться, щойно
  хтось закриє редактор n8n;
- форма синхронно чекає довгий воркфлоу — користувач дивиться на спінер, а на n8n
  Cloud запит обривається з кодом **524** через 100 секунд;
- ендпоінт для колбеку (callback) нічим не захищений — будь-хто може «закрити»
  чужий кошторис;
- n8n повторює колбек після збою — і запис оновлюється двічі;
- у журнали (logs) потрапляють ім'я, телефон і email клієнта.

Ця записка — одна відповідь на всі ці питання. Відхилятися від неї можна лише
свідомо й письмово (у PR з поясненням), а не тому, що «агент так згенерував».

## Дві сторони інтеграції

```
Next.js (Server Action / Route Handler)            n8n
  lib/n8n/client.ts ── POST /webhook/<path> ──────▶ Webhook node (Header Auth)
                       x-n8n-token, idempotency-key,  └─ Respond to Webhook: 202 {job_id}
                       x-correlation-id                    … робота воркфлоу …
  app/api/n8n/[event]/route.ts ◀── POST (підписаний) ── HTTP Request node
                       x-n8n-timestamp, x-n8n-signature,  (Crypto node рахує HMAC)
                       idempotency-key
```

## 1. Змінні середовища

Усі — **лише серверні** (server-only). Next.js вбудовує в клієнтський бандл тільки
змінні з префіксом `NEXT_PUBLIC_`, тож жодна змінна `N8N_*` цього префікса не має
([environment variables](https://nextjs.org/docs/app/guides/environment-variables)).

| Змінна | Що це | Приклад для локальної розробки |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База production-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення заголовка `x-n8n-token` (те саме, що в credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | Секрет HMAC для колбеків (те саме, що Hmac Secret у Crypto credential в n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, за якою n8n бачить ендпоінти колбеків | `http://127.0.0.1:3000` |

- Справжні значення — лише у `.env.local` (він у `.gitignore`) і в налаштуваннях
  хостингу. У репозиторії — тільки `.env.example`: секрети (`N8N_WEBHOOK_TOKEN`,
  `N8N_CALLBACK_SECRET`) — зі значеннями `change-me-…`, адреси — локальні, як у
  таблиці вище (`/webhook`, ніколи не `/webhook-test/`).
- Секрет генеруємо, а не вигадуємо:
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, у Client Component чи в журнал.

## 2. Next.js → n8n: виклик вебхука

**Де живе код.** Один модуль `lib/n8n/client.ts`, перший рядок — `import 'server-only'`:
тоді імпорт цього модуля з Client Component — помилка збірки
([server-only](https://nextjs.org/docs/app/getting-started/server-and-client-components)).
Прямих `fetch` до n8n поза цим модулем немає.

**Запит.** `POST ${N8N_WEBHOOK_BASE_URL}/<path>`, де `<path>` — ім'я події в
kebab-case (`lead-created`, `quote-request`). Одна подія — один шлях: n8n дозволяє
лише один вебхук на пару «шлях + метод»
([common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/)).

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію й збережений разом із записом; при повторі — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали обох систем |

**Тіло — конверт (envelope):**

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — версія конверта. Нове необов'язкове поле — та сама версія; перейменування
  чи зміна сенсу поля — нова версія, і n8n-воркфлоу якийсь час приймає обидві.
- `data` — **мінімум**, потрібний воркфлоу. Не відправляємо весь рядок з бази:
  IP, user agent, внутрішні нотатки й сирі дані форми n8n не потрібні.
- `callbackUrl` — лише для асинхронних воркфлоу (див. розділ 3).

**Таймаут.** Кожна спроба — `fetch(url, { …, signal: AbortSignal.timeout(10_000) })`;
по закінченні `fetch` падає з `TimeoutError`
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)).
10 секунд — наше рішення: в асинхронному режимі n8n відповідає одразу після
отримання запиту, тож довга відповідь означає збій, а не «повільний воркфлоу».

**Повтори.** Не більше двох (разом три спроби), пауза 1 с, потім 3 с, і **лише** для:
мережевої помилки, таймауту, 5xx і 524. Завжди з тим самим `idempotency-key`.
4xx не повторюємо: 403 — неправильний токен, 404 — воркфлоу не опубліковано або
це тестовий URL. Такі помилки треба виправляти, а не повторювати.

**Хто викликає.**

- Дія з UI — Server Action. Server Action — це публічний POST-ендпоінт: автентифікація,
  перевірка прав і валідація — всередині неї (правило `server-auth-actions` зі скіла
  Vercel React Best Practices, не повторюємо його тут).
- Користувач не чекає на n8n. Server Action зберігає запис (наприклад, статус
  `queued`), повертає лише `{ status, id }`, а виклик n8n із повторами виконується
  в `after()` (правило `server-after-nonblocking`;
  [after](https://nextjs.org/docs/app/api-reference/functions/after)).
  Причина не лише в швидкості: Next.js виконує Server Actions **по одній на клієнта**,
  тож довге очікування блокує наступну дію того ж користувача
  ([server actions](https://nextjs.org/docs/app/guides/server-actions)).
- Не-React клієнт (інший сервіс, cron) — Route Handler.
- Ніколи `export const runtime = 'edge'`: у Next.js 16 `edge` застарілий, а нам потрібен
  `node:crypto` ([runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)).

**Відповідь n8n.** Дивимось лише на **код статусу**. Текст повідомлення не
парсимо: для режиму Immediately документація пише «Workflow got started», а код n8n
повертає `{"message":"Workflow was started"}`.

## 3. Режим відповіді (Response mode)

Режими вузла Webhook ([webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/),
[Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)):

| Режим | Що отримує Next.js | Коли використовуємо |
|---|---|---|
| Immediately | 200 одразу після отримання запиту | Подія «до відома», результат не потрібен: `lead-created`, аналітика |
| When Last Node Finishes | Вихід останнього вузла після завершення воркфлоу | Швидкий запит довідки (секунди), коли результат потрібен у відповіді |
| Using Respond to Webhook | Те, що задає вузол Respond to Webhook (код, заголовки, тіло) | **Стандарт для довгих задач:** 202 `{"job_id": …}` одразу, результат — колбеком |
| Streaming | Потік відповіді | Не використовуємо |

**Правило:** усе, що може наблизитися до **100 секунд**, — лише асинхронно
(202 + колбек). На n8n Cloud запит, на який вебхук не відповів за 100 с,
завершується кодом **524**
([common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/)).
Воркфлоу при цьому працює далі, а Next.js про результат уже не дізнається.
Якщо ви не певні, скільки триває воркфлоу, — він асинхронний.

Respond to Webhook спрацьовує один раз; наступні такі вузли ігноруються. Якщо
воркфлоу завершився, не дійшовши до нього, n8n відповідає 200 зі стандартним
повідомленням; помилка до нього — 500.

## 4. Тестовий і production URL

| | Тестовий URL | Production URL |
|---|---|---|
| Шлях | `/webhook-test/<path>` | `/webhook/<path>` |
| Коли працює | Після «Listen for test event» у редакторі (або запуску воркфлоу), **120 секунд** | Поки воркфлоу **опублікований** (published) |
| Дані видно в редакторі | Так | Ні |

([workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/))

- У коді й у `.env.example` — **лише** `/webhook`. Тестовий URL можна тимчасово
  поставити тільки у власний `.env.local`, коли ви дивитесь дані в редакторі n8n.
- n8n 2.x: публікація фіксує конкретну версію воркфлоу, і production-виклики йдуть
  у неї, а не в останні правки. Після змін — опублікувати знову
  ([save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows)).
- Шляхи `webhook` і `webhook-test` на self-hosted n8n можна змінити змінними
  `N8N_ENDPOINT_WEBHOOK` / `N8N_ENDPOINT_WEBHOOK_TEST`
  ([endpoints](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints)).
  Якщо клієнт це зробив — записуємо в `docs/n8n-integrations.md` проєкту.

## 5. n8n → Next.js: колбек

**Ендпоінт.** `POST /api/n8n/<path>` — Route Handler `app/api/n8n/[event]/route.ts`.
Route Handler — публічний HTTP-ендпоінт
([backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)),
тож довіряємо лише підпису.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі (`5f0c…:quote-request.completed`) |
| `x-correlation-id` | Скопійований із запиту, що запустив воркфлоу |

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

`data.status` — `completed` або `failed` (тоді замість `result` — `error: { code }`).
Мок із `tools/` надсилає лише `completed`.

**Порядок обробки — саме такий:**

1. Подія зі шляху (`[event]`) нам невідома → **404**; `content-type` не
   `application/json` → **415**. Обидві перевірки — ще до читання тіла.
2. Прочитати тіло як **сирий текст**: `const raw = await req.text()`. Тіло можна
   прочитати лише раз. Ні `req.json()`, ні `JSON.parse` до перевірки підпису —
   повторна серіалізація змінює байти, і підпис не зійдеться.
3. Тіло більше 64 КБ → **413** (наше обмеження; колбек несе посилання, а не файли).
4. `x-n8n-timestamp` відрізняється від поточного часу більш ніж на **300 секунд**
   (у будь-який бік) → **401**. Вікно — наше рішення проти повторного
   відтворення (replay), документація n8n його не задає.
5. Порахувати HMAC від `` `${timestamp}.${raw}` ``, порівняти з підписом: спершу
   довжини, потім `crypto.timingSafeEqual` (він кидає помилку на різних довжинах;
   [Node.js](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)). Не `===`.
   Не збігається → **401** без подробиць у тілі.
6. «Застовпити» `idempotency-key` (унікальний запис у БД). Вже був → **200**
   `{"duplicate": true}`: n8n не повторюватиме, а дані не зміняться вдруге.
7. Тепер `JSON.parse(raw)` і перевірка форми. Не та форма, подія в тілі не
   відповідає шляху або `idempotency-key` не дорівнює `` `${data.jobId}:${event}` ``
   з тіла → **400**.
8. Зберегти мінімальний стан (наприклад, `status = ready`, посилання на документ)
   **до** відповіді. Якщо після кроку 6 обробка впала (4xx/5xx на кроках 7–8) —
   **звільнити** `idempotency-key`: інакше повтор n8n (Retry On Fail) отримає
   `{"duplicate": true}`, і результат загубиться.
9. Відповісти **202** `{"ok": true}`.
10. Повільне (листи, сповіщення, інтеграції) — в `after()`.

Чому запис до відповіді: отримавши 2xx, n8n колбек не повторить. Якщо критичний
запис жив би лише в `after()` і впав, результат загубився б назавжди.

Чому ключ звіряємо з тілом (крок 7): заголовок `idempotency-key` підписом не
захищений — HMAC рахуємо лише від `` `${timestamp}.${raw}` ``. Хто перехопив один
підписаний колбек, міг би в межах вікна 300 с надіслати ті самі байти з новим
ключем, і застосунок обробив би їх удруге. Коли ключ мусить дорівнювати полям
підписаного тіла, повтор із тим самим ключем — дублікат, з іншим — 400.

Сховище для `idempotency-key` — база чи KV з унікальним обмеженням. Пам'ять процесу
годиться лише для демо: на serverless-хостингах обробники не ділять стан між
запитами.

## 6. Ідемпотентність і повтори — з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі. В n8n одразу за Webhook
  стоїть **Remove Duplicates** в режимі «Remove Items Processed in Previous
  Executions» з ключем `idempotency-key`
  ([remove duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/)).
- n8n → Next.js: HTTP Request з Retry On Fail повторює колбек; Next.js відсікає повтори
  за `idempotency-key` (крок 6 вище) і приймає лише ключ, що збігається з підписаним
  тілом (крок 7).
- Ідемпотентність — не «приємний бонус»: і наші повтори, і Retry On Fail в n8n
  роблять дублікати неминучими.

## 7. Журнали

| Пишемо | Не пишемо ніколи |
|---|---|
| подію, напрям, `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP клієнта |
| довжину тіла і його sha256 | токен, підпис, секрет, повний URL з query string |

Відповіді з помилкою не містять внутрішніх подробиць (стек, SQL, URL n8n).

## 8. Налаштування на боці n8n (словами, без експорту JSON)

Воркфлоу клієнта — його власність; ми не експортуємо й не імпортуємо JSON воркфлоу.
Налаштування передаємо текстом — ось так.

1. **Webhook**: HTTP Method `POST`, Path — ім'я події (`quote-request`).
   Authentication — **Header Auth**, credential з Name `x-n8n-token` і Value =
   `N8N_WEBHOOK_TOKEN`. Неправильний чи відсутній заголовок n8n відхиляє з **403**
   «Authorization data is wrong!»
   ([credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/)).
   Respond — `Using 'Respond to Webhook' Node` (для швидких подій — `Immediately`).
   Якщо хостинг застосунку має фіксовані IP — Options → IP(s) Allowlist (за
   reverse proxy — `N8N_PROXY_HOPS`).
   Вхідні дані в наступних вузлах — `$json.body`, заголовки — `$json.headers`
   (імена в нижньому регістрі).
2. **Remove Duplicates**: «Remove Items Processed in Previous Executions», значення —
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With JSON, Response Code `202`, тіло
   `{"job_id": "{{ $execution.id }}"}`.
4. … робота воркфлоу (генерація PDF тощо) …
5. **Edit Fields**: поле `ts` = `{{ Math.floor($now.toSeconds()) }}`, поле `body` =
   `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, … } }) }}`.
   Тіло підписуємо й відправляємо **одним і тим самим рядком**.
6. **Crypto** (v2): Action `Hmac`, Type `SHA256`, Encoding `HEX`, значення
   `{{ $json.ts + '.' + $json.body }}`, credential **Crypto** з Hmac Secret =
   `N8N_CALLBACK_SECRET` ([crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/),
   [crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/)).
7. **HTTP Request**: `POST` на `callbackUrl` із запиту
   (`{{ $('Webhook').item.json.body.callbackUrl }}`). Заголовки `x-n8n-timestamp`,
   `x-n8n-signature` (`sha256=` + результат Crypto), `idempotency-key`
   (`{{ $execution.id }}:quote-request.completed` — ті самі `jobId` і `event`, що
   в тілі), `x-correlation-id` (з вхідних заголовків). Body Content Type — **Raw**,
   Content Type `application/json`, Body — поле `body`. Options → Timeout `10000`. Settings → Retry On Fail, Max Tries
   `3`, Wait Between Tries `1000`
   ([HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)).
   Якщо n8n у Docker, а застосунок на хості, — `host.docker.internal`, не `localhost`.
8. **Save** і **Publish**. Після кожної зміни — Publish знову.

Чому Raw, а не «JSON → Using Fields Below»: документація n8n не гарантує, що
серіалізація полів дасть точно ті самі байти, що ми підписали.

## 9. Ліміти

| Ліміт | Значення | Джерело |
|---|---|---|
| Тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX`, на self-hosted можна змінити) | [webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) |
| Тіло Server Action | 1 МБ за замовчуванням (`serverActions.bodySizeLimit`) | [server actions](https://nextjs.org/docs/app/guides/server-actions) |
| Відповідь вебхука на n8n Cloud | 100 с, далі 524 | [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) |
| Тестовий URL | 120 с після «Listen for test event» | [workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) |
| Колбек у Next.js | 64 КБ, вікно часу 300 с | наше рішення |

Файли не передаємо — лише посилання на них.

## 10. Локальна розробка: мок n8n

`tools/mock-n8n.mjs` — локальний «n8n» без залежностей. Він поводиться як вузли
Webhook, Respond to Webhook і HTTP Request з підписом, тож доступ до n8n клієнта
для розробки не потрібен.

```bash
node tools/mock-n8n.mjs --help                        # усі режими й прапорці
node tools/mock-n8n.mjs                               # :5678, режим Immediately
node tools/mock-n8n.mjs --mode last-node              # відповідь через 2 с
node tools/mock-n8n.mjs --mode slow --cloud-timeout 5000              # 524, як на Cloud
node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000
#   ↑ з N8N_WEBHOOK_TOKEN вмикається Header Auth, з N8N_CALLBACK_SECRET —
#     підписаний колбек на callbackUrl із запиту через 5 с
```

- `/webhook-test/<path>` мок приймає лише з `--listen` і лише 120 с — як n8n.
- У журналі мока — метод, шлях, статус, тривалість, **імена** заголовків, розмір
  і sha256 тіла, `auth=` і `idempotency=new|repeat|absent`. Тіл і значень він не пише.
- Команди однакові в Git Bash і PowerShell.

## 11. Відомі пастки в документації й чужих скілах

- «Workflow got started» (документація) проти `Workflow was started` (код n8n) —
  тому текст відповіді не парсимо.
- Офіційний пакет скілів n8n пише, що Header Auth відхиляє запит з **401**; код n8n
  повертає **403** («Authorization data is wrong!»). 401 — для Basic Auth і JWT.
- Той самий пакет пише, що секрет вузла Crypto не прив'язується до credential. Для
  Crypto v2 це вже не так: документація й код використовують Hmac Secret із Crypto
  credential.
- Приклад вебхука в документації Next.js передає токен у `?token=` у GET-запиті й
  порівнює через `!==`. Той самий гайд попереджає, що GET-запити можуть кешуватись і
  потрапляти в журнали. Ми робимо суворіше: токен у заголовку, підпис і `timingSafeEqual`.

## 12. Поза межами

- Побудова й зміна воркфлоу в редакторі n8n, експорт чи імпорт JSON воркфлоу.
- Код для вузла Code в n8n.
- Черги й фонові воркери: для наших об'ємів вистачає `after()` і колбеків.

## Реєстр інтеграцій проєкту

Кожна інтеграція — рядок у `docs/n8n-integrations.md` проєкту:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я відповідального |

## Джерела

- n8n: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) ·
  [Workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) ·
  [Common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) ·
  [Webhook credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/) ·
  [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/) ·
  [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) ·
  [Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/) ·
  [Crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/) ·
  [Remove Duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/) ·
  [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows) ·
  [Endpoints env](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints) ·
  [Handle rate limits](https://docs.n8n.io/integrations/builtin/handle-rate-limits)
- Код n8n: [Webhook/utils.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/nodes-base/nodes/Webhook/utils.ts) (403 для Header Auth) ·
  [webhook-on-received-response-extractor.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/cli/src/webhooks/webhook-on-received-response-extractor.ts) (текст Immediately)
- Next.js 16 (локальна копія — `node_modules/next/dist/docs/`):
  [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) ·
  [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) ·
  [Server Actions](https://nextjs.org/docs/app/guides/server-actions) ·
  [Data security](https://nextjs.org/docs/app/guides/data-security) ·
  [Environment variables](https://nextjs.org/docs/app/guides/environment-variables) ·
  [after](https://nextjs.org/docs/app/api-reference/functions/after) ·
  [runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)
- Node.js / Web: [crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) ·
  [AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- Правила Vercel, на які посилається скіл:
  [server-auth-actions](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-auth-actions.md) ·
  [server-after-nonblocking](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-after-nonblocking.md)
