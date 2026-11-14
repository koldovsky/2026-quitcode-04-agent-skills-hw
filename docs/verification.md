# Перевірка (Task A–C)

> Лише те, що справді сталося: цитати, числа, SHA комітів. Прогони A/B і фіча «запит на кошторис» —
> у `docs/ab-validation.md`.

- **Інструмент і версія, модель:** Claude Code 2.1.308 · claude-opus-5-5 · effort high
- **ОС і термінал, Node:** macOS (Darwin 27.2) · zsh · Node 24.15.0

**Як запускались «свіжі сесії».** Кожна перевірка — окремий процес `claude -p` з теки проєкту (новий
`session_id`). Запуск ізольовано від мого особистого середовища: `--setting-sources project,local`
(без особистих налаштувань, скілів і плагінів), `--strict-mcp-config` з порожнім списком MCP,
особистий `~/.claude/CLAUDE.md` виключено (`claudeMdExcludes`), усі змінні `CLAUDE*` батьківської
сесії скинуто; модель і effort закріплені. Це важливо саме тут — див. нижче.

## Скіли видно у свіжій сесії

- Як перевіряли: `claude -p "/context"` з кореня репозиторію, розділ **Skills**.

| Skill | Звідки | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів (лише `description`) |
| `building-client-form` | Project | ~340 токенів |
| `integrating-n8n-webhooks` | Project | ~310 токенів |

- Особисті скіли: у мене в `~/.claude/skills/` лежать 10 скілів `n8n-*` (`n8n-workflow-builder`,
  `n8n-code-javascript`, …) і `tasks`. Звичайний `claude -p "/context"` без ізоляції показує їх
  поруч із проєктними (`| n8n-workflow-builder | User | ~200 |` …). Для перевірок і особливо для
  прогону A в Task D це було б забрудненням (агент «без скіла» мав би 10 скілів про n8n), тому всі
  перевірки йшли з ізоляцією — у ній видно лише три проєктні скіли.

## Task A — виправлення за скілом Vercel

**Рев'ю застосунку зі скілом** — нова сесія (`32fbed62`), запит із walkthrough («Зроби рев'ю app/,
components/, lib/ за скілом vercel-react-best-practices … Файли не змінюй.»), Edit/Write заборонені.
Перший крок агента — виклик інструмента `Skill` → `vercel-react-best-practices`; результат — таблиця
з 22 рядків (`файл:рядок | id | що не так | виправлення`), від `server-auth-actions` і `async-parallel`
до `js-index-maps`, плюс одна «хибна тривога», яку агент сам позначив (`bundle-barrel-imports` для lodash). Звідти я взяв чотири виправлення.

**Як міряли:** продакшн-збірка (`npm run build`, `next start -p 3000`), скрипт заміру: 1 прогрів +
3 прогони `curl` з cookie `leaddesk_session=demo-u_olena` на `/dashboard`, розмір HTML і RSC
(`-H "RSC: 1"`), лічильники `db:<запит>` у журналі сервера (сумарно / 12 однакових запитів —
`next start` пише журнал із затримкою, тож рахувати «до/після одного curl» ненадійно).

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `221d73b` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` — у `Promise.all` замість трьох послідовних `await` | TTFB **2,27 / 2,25 / 2,23 с** | TTFB **1,42 / 1,41 / 1,41 с** | `curl -w "%{time_starttransfer}"`, 3 прогони |
| `server-cache-react` | `bf87942` | `lib/data.ts`, layout, header, сторінки | `getCurrentUser` у `cache()`; `getWorkspace` бере рядок `slug` замість inline-об'єкта `{ slug }` (з об'єктом `cache` завжди промахувався — `Object.is`) | на запит: `getUserBySession` **3**, `getWorkspace` **3** | **1** і **1** | лічильники `db:*`; TTFB 1,41 с — без змін (layout і page і так ішли паралельно) |
| `server-serialization` | `bc385f7` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у Client Component `LeadsTable` — лише 5 полів (`LeadRow`) замість повного `Lead` | HTML **424 592 Б**, RSC **315 197 Б**; у HTML 172× `rawPayload`, 172× `internalNotes`, 172× `ipAddress` | HTML **111 377 Б** (−74 %), RSC **31 257 Б** (−90 %); 0 × кожного з цих полів | `curl … \| wc -c`, `grep -o '<поле>' \| wc -l` |
| `server-auth-actions` | `3e934ec` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` перевіряють сесію й що лід належить воркспейсу користувача; статус — зі списку | (без заміру швидкості) | (без заміру) | Playwright, див. нижче |

- Чому обрали для заміру `async-parallel`: найпростіше видно в числах і саме він відповідає скарзі
  клієнта «понад 2 секунди» (послідовні 100 + 100 + 400 + 1200 + 400 мс ≈ 2,2 с).
- `server-auth-actions` — не про швидкість, а про безпеку, але рев'ю за скілом знайшло його першим, і
  незалежно від мене те саме помітив агент у перевірці Task B. Як переконався: скрипт Playwright
  (`auth-check.mjs`, поза репо) — (1) Olena змінює статус свого `lead_0001` через UI; (2) Marta
  (інший воркспейс) змінює статус свого `lead_0007`, а запит Server Action перехоплюється й `lead_0007`
  у тілі замінюється на `lead_0001`.
  - **До виправлення:** `1) … qualified -> won … PASS`, `2) … action HTTP 200; lead_0001 now contacted
    (must stay won) => FAIL` — Marta змінила чужий лід.
  - **Після:** `1) … PASS`, `2) … action HTTP 500; lead_0001 now won (must stay won) => PASS`, у журналі
    сервера `Error: Lead not found`.
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували — `bundle-barrel-imports`
  для `lodash`: `node_modules/next/dist/server/config.js:1117` за замовчуванням має
  `modularizeImports: { lodash: { transform: 'lodash/{{member}}' } }`, а `lucide-react`/`@mui/material`/
  `recharts` уже в стандартному `optimizePackageImports`. Також не застосовано пораду з `ssr: false` у
  `next/dynamic` в Server Component (у 16.3.5 — помилка збірки). Деталі — `docs/skill-review.md`, розділ 5.
- Якщо виміряне виправлення не змінило чисел: `server-cache-react` не змінив TTFB — пояснення в таблиці.
- `npm run lint`, `npm run build` після кожного виправлення: без помилок (`✓ Compiled successfully`).

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо) — дослівно з walkthrough:
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове
  > поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл: **так, з першої спроби** — перший виклик інструмента в сесії `88fec0ed`:
  `Skill: building-client-form`. `description` не змінювали.
- Сесія йшла в окремому git worktree від `ac5e1fa`, щоб не змішувати з виправленнями Task A.
- Що зроблено (файли): `lib/lead-note-form.ts` (парсинг і валідація, повертає `values`),
  `app/dashboard/leads/[id]/actions.ts` (`addLeadNote`: сесія → лід свого воркспейсу → валідація →
  запис → аудит в `after()` → `revalidatePath` → лише `{ status }`), `components/lead-note-form.tsx`
  (`useActionState`, `aria-invalid`, `aria-describedby`, `role="alert"`, `defaultValue` зі
  `state.values`), `lib/db.ts` (`appendLeadNote`), сторінка ліда (`addLeadNote.bind(null, lead.id)`).
  Результат залишено в гілці: `7953bec` + `ed4ab5d` (підлаштування під новий `getWorkspace(slug)`).
- Пункти Verify — агент перевірив сам на `next start` звичайними POST без JavaScript (цитата з
  фінальної відповіді): «порожня нотатка → „Напишіть текст нотатки“, поле позначене як помилкове,
  зверху блок з помилкою; 501 символ → „Нотатка задовга: 501 з 500 символів“, введений текст лишився в
  полі; правильна нотатка → „Нотатку додано“; без cookie, з підробленою cookie або з підміненим `id`
  ліда з іншого воркспейсу → нічого не змінилось; у журналі сервера немає ні тексту нотаток, ні
  персональних даних». `npm run lint`, `npm run build` — без помилок.
- Спостереження: агент спершу прив'язував `id` до дії в клієнтському компоненті — без JS повторний
  рендер після POST зависав; сам виправив на `.bind` у сторінці (як у документації Next.js). Наприкінці
  він незалежно знайшов відсутність перевірок у `updateLeadStatus`/`deleteLead` (`server-auth-actions`).

## Task C — `integrating-n8n-webhooks`

- Що лишили в `SKILL.md` (113 рядків): контракт у 7 пунктах (змінні, клієнтський модуль, хто
  викликає, режим відповіді, порядок обробки колбека, журнали, реєстр), чекліст, правила зупинки,
  Verify. У `references/`: `contract.md` (таблиці заголовків, конверт, повтори, колбек крок за кроком,
  ідемпотентність, ліміти, відомі пастки), `response-modes.md` (режими, 100 с / 524, тестовий і
  production URL, мок), `n8n-setup.md` (налаштування n8n словами для клієнта), `code-templates.md`
  (`lib/n8n/client.ts`, `lib/n8n/callback.ts`, колбек-роут, Server Action, `.env.example`). Чому так:
  `SKILL.md` агент читає завжди, коли скіл спрацював, — там «що зробити»; таблиці й код — лише коли
  дійде до реалізації.
- Правила зупинки: тестовий URL `/webhook-test/` для коду/`.env.example`/продакшну; секрет у
  клієнтському коді, `NEXT_PUBLIC_*`, query string, журналі чи відповіді; синхронне очікування
  довгого воркфлоу; «спрощений» колбек (без підпису, без вікна, `===`, `req.json()`);
  `runtime = "edge"`, файли в тілі, зміна воркфлоу/JSON/вузол Code; невідомо, які поля потрібні
  воркфлоу в `data`.
- Скрипти: `check-contract.mjs` (C1–C14, `--root`, `--changed-since`, `--json`, `--help`, код виходу
  1 при FAIL), `mock-n8n.mjs` (копія `tools/mock-n8n.mjs`; після рев'ю CodeRabbit відрізняється
  однією правкою — адреса колбека в журналі без облікових даних і query), `send-signed-callback.mjs`
  (10 випадків: 404, 415, 413, неправильний підпис 401, прострочений час 401, тіло переформатоване
  після підпису 401, ключ ≠ тіло 400, `status` ≠ подія 400, валідний 202, повтор 200 `duplicate`).
- SHA коміту зі скілом (BASE для Task D): **`6c7fcc6`** (`6c7fcc69c3f7fc6133442d4240c6348ba6498b58`).
- Що скіл змінив у собі після прогонів: коміт `8adab99` — `check-contract.mjs` упізнає код n8n за будь-якою
  змінною `N8N_*`, а не лише за назвами контракту (прогін A з `N8N_QUOTE_WEBHOOK_URL` і
  `/api/quotes/callback` інакше давав N/A замість FAIL); деталі — `docs/ab-validation.md`.

**`check-contract.mjs` на коді `main`** (`git archive main` → `../leaddesk-main`):

```
check-contract — ../leaddesk-main (28 file(s))

C1   FAIL  no-test-url
             - .env.example:6 test URL /webhook-test/
C2   PASS  no-public-n8n-env
C3   FAIL  single-client
             - app/actions.ts:54 reads N8N_WEBHOOK_* outside lib/n8n/
C4   N/A   server-only
C5   FAIL  fetch-timeout
             - app/actions.ts:54 fetch to n8n without signal: AbortSignal.timeout(...)
C6   FAIL  contract-headers
             - app/actions.ts:54 n8n request without x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  non-blocking-action
             - app/actions.ts:54 Server Action starts an n8n workflow without after() — the user waits for n8n
C8   N/A   callback-raw-body
C9   N/A   timing-safe-compare
C10  PASS  no-edge-runtime
C11  FAIL  env-example
             - .env.example missing N8N_WEBHOOK_BASE_URL
             - .env.example missing N8N_WEBHOOK_TOKEN
             - .env.example missing N8N_CALLBACK_SECRET
             - .env.example missing APP_BASE_URL
             - .env.example:6 N8N_WEBHOOK_URL is not a contract key (use N8N_WEBHOOK_BASE_URL + /<event>)
C12  PASS  no-sensitive-logs
C13  N/A   callback-replay
C14  N/A   callback-idempotent

TOTAL: 3 PASS, 6 FAIL, 5 N/A
exit=1
```

**Навмисно поганий код** — тимчасова тека з одним роутом `app/api/n8n/quote-request/route.ts`:
`export const runtime = "edge"`, `await req.json()`, `console.log("callback", raw)`, секрет з
`process.env.NEXT_PUBLIC_N8N_CALLBACK_SECRET`, `if (sig !== expected)`, `JSON.parse` (теку видалено):

```
C2   FAIL  no-public-n8n-env    - route.ts:8 NEXT_PUBLIC_N8N_CALLBACK would be inlined into the client bundle
C8   FAIL  callback-raw-body    - route.ts:4 request.json() — read the raw body with request.text()
                                - route.ts:1 the raw body is never read with request.text()
                                - route.ts:10 JSON.parse before the signature check
C9   FAIL  timing-safe-compare  - route.ts:9 signature compared with ===/!== — use crypto.timingSafeEqual
                                - route.ts:1 no crypto.timingSafeEqual in the callback code
C10  FAIL  no-edge-runtime      - route.ts:2 runtime = "edge" (node:crypto is needed; edge is deprecated in Next.js 16)
C12  FAIL  no-sensitive-logs    - route.ts:6 console.* may print a body, personal data or a secret
C13  FAIL  callback-replay      - route.ts:1 x-n8n-timestamp is never read
C14  FAIL  callback-idempotent  - route.ts:1 idempotency-key header is never read
TOTAL: 2 PASS, 7 FAIL, 5 N/A   exit=1
```

**Позитивний контроль:** файли, зібрані прямо з `references/code-templates.md` (`.env.example`,
`lib/n8n/client.ts`, `lib/n8n/callback.ts`, колбек-роут, Server Action) → `TOTAL: 14 PASS, 0 FAIL,
0 N/A`, exit 0 — шаблони, які скіл дає агенту, проходять його ж перевірку.

**`--changed-since`:** копія `main` з тегом `base`, додано `lib/n8n/client.ts` із шаблону й рядок
`process.env.NEXT_PUBLIC_N8N_WEBHOOK_TOKEN` у `lib/session.ts` → `2 changed file(s) since base`,
`C2 FAIL lib/session.ts:3`, C4–C6 PASS на новому модулі; старі FAIL з `app/actions.ts` і
`.env.example` не враховано (ці файли не змінювались).

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B `c442121` і доведення
`dde28ce`; увесь проєкт, без `--changed-since`):

```
check-contract — . (40 file(s))

C1   PASS  no-test-url
C2   PASS  no-public-n8n-env
C3   PASS  single-client
C4   PASS  server-only
C5   PASS  fetch-timeout
C6   PASS  contract-headers
C7   PASS  non-blocking-action
C8   PASS  callback-raw-body
C9   PASS  timing-safe-compare
C10  PASS  no-edge-runtime
C11  PASS  env-example
C12  PASS  no-sensitive-logs
C13  PASS  callback-replay
C14  PASS  callback-idempotent

TOTAL: 14 PASS, 0 FAIL, 0 N/A
exit=0
```

**Матриця колбеків** (`send-signed-callback.mjs --request-key <ключ справжнього запиту>`) проти
`/api/n8n/quote-request` на гілці: 404 / 415 / 413 / 401 / 401 / 401 / 400 / 202 / 200 — **9/9 PASS**.

## Після рев'ю CodeRabbit (PR #21)

16 зауважень, усі звірено з кодом; виправлено 16 — окремими комітами `f92293b`…`8a04211`.

| Зауваження | Що було насправді | Виправлення і доказ |
|---|---|---|
| `building-client-form` Verify шукає лише `$ACTION_ID_` | На продакшн-збірці `/quotes/new` рендерить лише `$ACTION_REF_1`, нотатка — `$ACTION_REF_2` (дія з `useActionState`/`.bind`): перевірка «провалювала» робочу форму | grep `\$ACTION_(ID\|REF)_` → `name="$ACTION_REF_1"` |
| Шаблон колбека: ліміт тіла після `request.text()` | Те саме було й у робочому роуті | `readBodyLimited()` у `lib/n8n/callback.ts` і шаблоні: потік 10 МБ без `Content-Length` зупиняється на ~68 КБ, «брехливий» `Content-Length: 10` — так само, рівно 64 КБ проходить; матриця `too-large` → 413 |
| Шаблон: будь-яка `<event>.*`, ключ запиту може бути `null`, довільний `documentUrl` | Шаблон відставав від роуту, який скіл сам і згенерував | `parseCallback` у шаблоні = перевірки роуту: точні події, непорожній ключ, `isHttpUrl` |
| Роут: `data.status` не звірявся з подією | `….failed` зі `status: "completed"` зберігався як `completed` | Перевірка в роуті й шаблоні + новий випадок матриці `status-mismatch` → 400 |
| Шаблон Server Action перезаписує кінцевий статус | Безумовний `update` після `triggerWorkflow` | `quotes.markTriggered` — лише з `queued` (робочий `markQuoteTriggered` так і робив) |
| `check-contract` C5/C6, C7, C9/C13, C14 | Фікстура на кожне зауваження: старий чекер дав N/A, PASS, хибні FAIL, PASS | Новий чекер: C5 FAIL, C7 FAIL, 0 хибних FAIL, C14 FAIL (таблиця нижче) |
| `send-signed-callback`: `--only` з помилкою — «all cases match», `duplicate` без `valid` | Так | Невідома/порожня назва → код 2; `duplicate` сам робить першу доставку: `setup → 202`, `duplicate → 200` |
| `mock-n8n.mjs`: `--callback-url` з паролем/токеном у журналі | Так | Копія скіла пише лише origin + path; `tools/` не змінено |
| Нотатка: при `error` введене зникає; поле не `required` | Так | `values` у стані `error`, `required` |
| `QuoteForm` не оголошує помилки | Форма з прогону B не відповідала нашому ж `building-client-form` | Playwright: `role="alert"` «помилок — 4», усі 4 поля `aria-invalid=true`, `aria-describedby` → текст помилки, `required`, `label` |

**Регресія `check-contract.mjs`** (локальний стенд `~/.local/share/qc-ws7-tools/ws4/regress`: ті самі
прогони, що вище, плюс по фікстурі на кожне зауваження):

| Прогін | Старий чекер | Новий чекер |
|---|---|---|
| `main` | 6 FAIL (C1 C3 C5 C6 C7 C11) | те саме |
| навмисно поганий роут | 7 FAIL | те саме |
| шаблони скіла | 0 FAIL | 0 FAIL (нові шаблони) |
| `--changed-since` контроль | C2 FAIL | те саме |
| копія A / копія B (`--changed-since base`) | 8 FAIL / 0 FAIL | ті самі id |
| увесь проєкт | 13 PASS, **C8 FAIL** (новий потоковий читач) | **14 PASS** |
| f221: з `fetch` видалено лише `signal:` | C5/C6 **N/A** | **C5 FAIL** |
| f286: `await triggerWorkflow()` поруч із порожнім `after()` | C7 **PASS** | **C7 FAIL** |
| f298: змінено лише роут, `lib/n8n/callback.ts` незмінний | **C9, C13 FAIL** (хибно) | PASS |
| f411: назви є, механізму немає | C14 **PASS** | **C14 FAIL** ×2 |

**Матриця колбеків після виправлень** (продакшн-збірка, ключ справжнього запиту з `/quotes/new`):
404 / 415 / 413 / 401 / 401 / 401 / 400 / **400** / 202 / 200 — **10/10 PASS**; `npm run lint` і
`npm run build` без помилок.
