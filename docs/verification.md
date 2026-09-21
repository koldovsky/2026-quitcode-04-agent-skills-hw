# Перевірка (Task A–C)

> Еталонне виконання для гілки `ws04/sample`, 21.09.2026. Windows 11 + Git Bash, Node 24.18.0,
> Claude Code 2.1.276 (модель за замовчуванням у свіжій сесії — `claude-sonnet-5`), Next.js 16.3.5.
> Усі числа — з продакшн-збірки (`next build` + `next start` на 127.0.0.1).

## Скіли видно у свіжій сесії

`claude -p "/context"` у свіжому клоні `ws04/sample` (у Git Bash — з `MSYS_NO_PATHCONV=1`), розділ Skills:

| Skill | Source | Токенів в описі |
|---|---|---|
| `building-client-form` | Project | ~270 |
| `integrating-n8n-webhooks` | Project | ~280 |
| `vercel-react-best-practices` | Project | ~120 |

Решта — вбудовані скіли й два особисті (`course-prep`, `find-skills` з `~/.claude/skills/`); жоден
не стосується форм чи n8n, тож прогони нижче ними не «забруднені».

**Відповідність специфікації** (name = тека, `description` ≤ 1024 символи з «що» + «коли», `SKILL.md`
< 500 рядків, посилання на файли скіла існують): `building-client-form` — 794 символи, 99 рядків;
`integrating-n8n-webhooks` — 822 символи, 140 рядків; `vercel-react-best-practices` — 329 символів,
149 рядків. Усі три — PASS.

> `claude plugin validate .claude/skills` друкує «✔ Validation passed», але з `--json` видно
> `"contents": []`: для теки `.claude/skills` у 2.1.276 він не перевірив жодного скіла. Контрольна тека
> (name ≠ тека, опис на 1100 символів) теж «passed». Маніфест плагіна (`.claude-plugin/plugin.json`)
> він перевіряє, але й там у наших пробах `contents` лишався порожнім. Тому відповідність перевіряли
> власним скриптом за правилами [agentskills.io/specification](https://agentskills.io/specification).

## Task B — `building-client-form`

**Звичайний запит у свіжій сесії** (скіл не названо):

> На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове
> поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.

**Результат: ОЧІКУЄ ПРОГОНУ.** Під час збірки еталону CLI на цій машині не був авторизований:
`claude auth status` → `"loggedIn": false`, а `claude -p` завершувався за 0,1 с з
`Failed to authenticate: OAuth session expired and could not be refreshed` (`/context` працює, бо не
звертається до API). Повторна перевірка перед фіналізацією (21.09.2026) нічого не змінила:
`"loggedIn": false`, і всі 10 спроб калібрування `claude -p` зупинились на тій самій помилці.
Команда для прогону — в кінці розділу C; записати: чи був виклик інструмента `Skill` з
`building-client-form` (або читання його `SKILL.md`), які файли змінено, чи дія перевіряє сесію й
належність ліда (`server-auth-actions`), чи поле має `aria-invalid`/`aria-describedby`,
`npm run lint`/`build`.

**Де патерн уже застосовано й перевірено** — форма `/quotes/new` (`components/quote-form.tsx`,
`app/quotes/actions.ts`, `lib/quote-form.ts`):

- без JS: невалідна відправка → HTTP 200, `aria-invalid="true"` + `aria-describedby="email-error"`,
  текст помилки, підсумок у `role="alert"`, введена назва компанії лишилась;
- з JS (браузер, продакшн-збірка): після невалідної відправки текстові поля зберегли значення, але
  **`<select>` бюджету скинувся на першу опцію**. React 19 скидає форму після дії, а змонтований
  select тримає свій перший `defaultValue`. Виправлено `key={values.budget}` (коміт `833a760`),
  перевірено трьома відправками поспіль; сам скіл виправлено (коміт `947791c`) — порада «для select
  теж `defaultValue`» була хибною;
- валідна відправка → відповідь за 139 мс (попередні прогони — 141–154 мс), повільне (n8n) — в `after()`;
- у журналі сервера лише `quote request invalid: email,description` і `quote request <uuid> queued` —
  без значень полів.

## Task C — `integrating-n8n-webhooks`

**Звичайний запит у свіжій сесії** (скіл не названо; `materials/n8n-webhooks-brief.md` на час прогону
прибрано з клону, щоб контракт міг прийти лише зі скіла):

> Коли менеджер змінює статус ліда на «Угода» (won), треба запустити в n8n воркфлоу deal-won — він
> створює рахунок у бухгалтерії. Відповідь від n8n нам не потрібна.

**Результат: ОЧІКУЄ ПРОГОНУ** — та сама причина, що в Task B. Записати: виклик `Skill` /
читання `references/`, чи виклик іде через `lib/n8n/client.ts` в `after()` з режимом Immediately (без
`callbackUrl`), рядок у `docs/n8n-integrations.md`, вивід `check-contract.mjs`.

**Як запустити обидва прогони** (по одному, не паралельно — паралельні сесії можуть конфліктувати
під час оновлення OAuth-токена):

```bash
claude auth status                        # має бути "loggedIn": true
git clone --branch ws04/sample <repo> ../trigger-n8n && cd ../trigger-n8n && npm ci
rm materials/n8n-webhooks-brief.md        # лише для прогону Task C
claude -p --output-format stream-json --verbose --permission-mode acceptEdits \
  --allowedTools "Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint:*),Bash(npm run build:*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs:*)" \
  < prompt.txt > run.jsonl                # prompt.txt — запит вище, UTF-8
grep -o '"name":"Skill","input":{[^}]*}' run.jsonl   # чи викликано скіл
```

### Скрипти скіла: що вони показали

**`check-contract.mjs` на `main`** (файли з `git archive main`) — 5 FAIL, exit 1. Код
застосунку, `.env.example` і `tools/` на `main` не змінювались з виміряного `ea73649` (пізніші
коміти — лише документація, матеріали й налаштування перевірки):

```
C1  FAIL no /webhook-test/ URL in code or .env.example
      .env.example:6  N8N_WEBHOOK_URL points at a /webhook-test/ URL
C2  PASS no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
C3  FAIL n8n is called only from lib/n8n/*, which starts with import 'server-only'
      app/actions.ts:54  fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)
C4  N/A  callback route reads the raw body; parses only after the signature check  (no callback route found …)
C5  N/A  signature: length check + timingSafeEqual, never === / !==  (no callback route found)
C6  FAIL every fetch to n8n has signal: AbortSignal.timeout(...)
      app/actions.ts:54  fetch without signal: add AbortSignal.timeout(10_000)
C7  PASS no bodies, payloads or headers in console.* in n8n code
C8  PASS no runtime = 'edge'
C9  FAIL .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
      .env.example  key N8N_WEBHOOK_BASE_URL is missing   (+ N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
C10 FAIL every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL
      app/actions.ts:54  no idempotency-key header (UUID created once per operation, reused on retries)
      app/actions.ts:54  no x-n8n-token header (n8n Header Auth; a missing or wrong token is a 403)

5 failed, 3 passed, 2 n/a (10 checks)
```

**Чому N/A, а не PASS:** на `main` ще немає колбек-роуту, тож C4 і C5 нічого не перевіряли. Скрипт
каже це прямо — інакше «усе зелене» означало б «нікуди не дивились» (та сама пастка, що й «n8n
callers: none» у проєкті, який очевидно викликає n8n).

**На `ws04/sample`** — `0 failed, 10 passed, 0 n/a (10 checks)`, exit 0 (n8n callers:
`lib/n8n/client.ts`; callback routes: `app/api/n8n/[event]/route.ts`).

**Самоперевірка скрипта** — набір із 15 міні-проєктів (автор тримає його поза репозиторієм разом з
іншими тестами, прогін `run-fixtures.mjs`): еталонний проєкт за контрактом, обидві гілки репозиторію
й 13 випадків, зібраних з типових помилок агента. Останній прогін — **15 з 15**. Що він ловить:

- навмисно поганий код (`req.json()`, `signature !== expected`, `NEXT_PUBLIC_N8N_WEBHOOK_URL`,
  тестовий URL, лог тіла, `runtime = "edge"`, справжній токен у `.env.example`) — **10 з 10 FAIL**;
- парсинг до перевірки підпису — і `JSON.parse` у самому роуті, і виклик **імпортованої** функції,
  яка парсить (C4 FAIL на рядку виклику), і `POST` у формі `export const POST = async (r) => …`
  з `r.json()` та HMAC від `JSON.stringify(...)`;
- виклик n8n через модуль конфігурації чи типізованого env (`fetch(env.N8N_…)`, `fetch(config.…)`):
  C3, C6 і C10 FAIL, хоча ні URL, ні `process.env` немає поряд із `fetch`;
- токен у query string і відсутній `x-n8n-token` — C10 FAIL;
- **і навпаки**, коректний код, на якому перевірки не мають спрацьовувати: `typeof signature !==
  "string" || signature === ""` (не C5) і `const init: RequestInit = { …, signal }; fetch(url, init)`
  (не C6).

**Мок у режимі 202 + колбек на запущений застосунок:**

```bash
N8N_WEBHOOK_TOKEN=… N8N_CALLBACK_SECRET=… node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs \
  --port <port> --mode respond-202 --delay 3000 --callback-url http://127.0.0.1:<app>/api/n8n/quote-request
```

Відправка форми `/quotes/new` (без JS) → **HTTP 200 за 183 мс** (попередні прогони — 139–154 мс),
хоча «воркфлоу» триває 3 с; сторінка статусу пройшла «У черзі» → «Готуємо кошторис» → «Готово» з
посиланням на PDF одразу після колбека. Журнал мока (sha256 скорочено):

```
POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 366 B sha256=b6c904c2…
workflow 37ddbecb-… running for 3000 ms, then callback event=quote-request.completed
callback POST http://127.0.0.1:<app>/api/n8n/quote-request -> 202 in 176 ms (try 1/3) event=quote-request.completed body 382 B sha256=0908ec8a…
```

Журнал застосунку (фрагмент) — подія, статус, тривалість, correlation id, розмір і хеш тіла; ні email,
ні назви компанії, ні токена, ні підпису:

```
quote request 221a7e08-… queued
n8n -> quote-request 202 in 10 ms (try 1/3) corr=5599e34c-… 366 B sha256=b6c904c2b1db5e16
n8n <- quote-request completed accepted corr=5599e34c-…
quote 221a7e08-… completed: customer notification queued (demo: no e-mail is sent)
n8n <- quote-request rejected: bad-signature corr=0d03ff4b-… 382 B
n8n <- quote-request rejected: stale-timestamp corr=d49e7449-… 382 B
n8n <- quote-request rejected: key does not match the signed job corr=624d4f78-…
```

**`send-signed-callback.mjs`** проти `/api/n8n/quote-request` з `--request-key` = id щойно створеного
запиту — **15 з 15 PASS**, exit 0:

```
PASS  wrong-content-type     expected 415  got 415   only application/json is accepted
PASS  oversized-body         expected 413  got 413   callbacks carry links, not files (limit 64 KB)
PASS  missing-signature      expected 401  got 401   no x-n8n-signature header
PASS  bad-signature          expected 401  got 401   random hex instead of the HMAC
PASS  short-signature        expected 401  got 401   wrong length must not crash timingSafeEqual
PASS  wrong-secret           expected 401  got 401   signed with another secret
PASS  stale-timestamp        expected 401  got 401   timestamp 10 min old (window 300 s)
PASS  future-timestamp       expected 401  got 401   timestamp 10 min ahead (window 300 s)
PASS  non-numeric-timestamp  expected 401  got 401   x-n8n-timestamp is not unix seconds
PASS  reserialized-body      expected 401  got 401   signed compact JSON, sent pretty-printed JSON (same data, other bytes)
PASS  malformed-json         expected 400  got 400   valid signature over a body that is not JSON
PASS  unknown-event          expected 404  got 404   valid signature, route for an event the app does not handle
PASS  valid                  expected 202  got 202   fresh, correctly signed callback for a real job
PASS  replay-same-key        expected 200  got 200   same idempotency-key again (n8n Retry On Fail): acknowledged, not applied twice
PASS  replay-new-key         expected 400  got 400   captured callback replayed under a fresh key: the key must equal <jobId>:<event> from the signed body

0 failed, 15 passed (15 cases)
```

Випадок `replay-new-key` — це саме той сценарій, заради якого ключ звіряється з тілом: ті самі байти,
той самий час і той самий підпис, що й у `valid`, лише з іншим `idempotency-key`. До цієї перевірки
роут приймав такий запит (202) і виконував `after()` ще раз; тепер — 400, а в журналі
`rejected: key does not match the signed job`.

Додатково: сервер **без** `N8N_CALLBACK_SECRET` на правильно підписаний колбек відповідає 500 (не 2xx і
не 400) — HMAC із порожнім ключем не приймається. Сторінка статусу не показує email і опис задачі;
невідомий чи некоректний id → 404.

**Що скіл змінив сам по собі під час роботи** (коміт `f3ba25d`): шаблон роуту в
`references/nextjs-patterns.md` оновлено за робочим кодом — `Object.hasOwn` для мапи обробників (інакше
`/api/n8n/toString` знаходив «обробник» у прототипі) і лог похідного `jobStatus` замість об'єкта конверта
(C7 навмисно суворий до `envelope`/`body`/`payload`).

## Вимірювання: до (`main`) і після (`ws04/sample`)

| Що | `main` (`ea73649`) | `ws04/sample` | Правило |
|---|---|---|---|
| `/dashboard`, перший байт (3 прогони) | 2266–2277 мс | 645–648 мс | `async-suspense-boundaries` |
| `/dashboard`, уся сторінка (3 прогони) | 2270–2281 мс | 1438–1440 мс | `async-parallel` |
| `db:*` на один запит `/dashboard` | `getUserBySession` 3, `getWorkspace` 3, `getLeads` 1, `getLeadStats` 1, `getSourceBreakdown` 1 | усі по 1 | `server-cache-react` |
| HTML `/dashboard` | 424 592 Б, є `internalNotes`/`rawPayload`/`ipAddress` | 121 220 Б, немає | `server-serialization` |
| RSC-відповідь `/dashboard` (`rsc: 1`) | 315 197 Б | 38 781 Б | `server-serialization` |
| Початковий JS `/dashboard` (чанки з HTML) | 10 чанків, 1828 КБ / 526 КБ gzip | 9 чанків, 571 КБ / 177 КБ gzip | `bundle-dynamic-imports`, `bundle-conditional` |
| Де exceljs і recharts | в одному чанку 1266 КБ, який HTML вантажить одразу | exceljs 909 КБ і recharts 350 КБ — окремі чанки, вантажаться за кліком | те саме |
| Відправка форми ліда проти мока n8n (2 с, `last-node`) | 2403–2428 мс | 130–156 мс | `server-after-nonblocking` |
| `updateLeadStatus` напряму: чужий workspace / довільна cookie | статус змінено / змінено | не змінено / не змінено | `server-auth-actions` |

Як міряли:
- **`/dashboard`**: cookie `leaddesk_session=demo-u_olena`, один прогрівальний запит + 3 виміри. Перший
  байт — момент, коли `fetch()` отримав заголовки (при стрімінгу вони приходять разом з оболонкою), уся
  сторінка — до кінця тіла. `db:*` — різниця лічильників `console.count` у журналі сервера до і після запиту.
- **Початковий JS**: усі `/_next/static/**/*.js` з HTML `/dashboard`, розміри з `.next/static` (gzip —
  Node zlib). Де лежать бібліотеки — пошук характерних рядків (`xl/workbook.xml` для exceljs,
  `recharts-wrapper` для recharts) у кожному чанку.
- **`npx next experimental-analyze --output`** (`.next/diagnostics/analyze/data/dashboard/analyze.data`):
  на обох гілках маршрут `/dashboard` «важить» ≈ 1827 КБ, бо аналізатор рахує і чанки, що вантажаться
  пізніше через `import()`. Різниця — у розкладці: на `main` exceljs (909 КБ) і recharts (227 КБ) сидять в
  одному файлі на 1266 КБ; на `ws04/sample` — два окремі файли (909 КБ лише exceljs; 350 КБ recharts + d3).
  lodash на `main` — 2,6 КБ (Next.js сам переписує імпорт на `lodash/debounce`), на `ws04/sample` — 0.
- **Браузер** (продакшн-збірка): клік «Показати графік джерел» довантажив один чанк і намалював 6 стовпців;
  «Експорт в Excel» довантажив чанк exceljs і згенерував `leads-2026-09-21.xlsx` (18,7 КБ) без помилок у консолі.
- **Форма ліда**: POST форми без JS (як браузер без JavaScript), 3 відправки; мок
  `tools/mock-n8n.mjs --mode last-node` (воркфлоу 2000 мс, викликач чекає). На `main` —
  `N8N_WEBHOOK_URL=…/webhook/lead-created` без авторизації; на `ws04/sample` — `N8N_WEBHOOK_BASE_URL`
  і `N8N_WEBHOOK_TOKEN` (мок з Header Auth: `auth=ok idempotency=new`, n8n отримує 371 Б замість 1083 Б).
- **Server Actions**: POST із заголовком `next-action` = id `updateLeadStatus` з
  `.next/server/server-reference-manifest.json`, тіло `["lead_0001", "<status>"]`.

`npm run build` і `npm run lint` на `ws04/sample` — без помилок.
