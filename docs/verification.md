# Перевірка (Task A–C, бонус E3)

> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code (desktop app, вкладка Code) · Claude Opus 5.5
- **ОС і термінал, Node:** Windows 11 Pro 10.0.26200 · Git Bash · Node 23.4.0

## Скіли видно у свіжій сесії

- Як перевіряли: окремий неінтерактивний запуск `MSYS_NO_PATHCONV=1 claude -p "/context"` (Claude Code CLI 2.1.281) з теки `hw4` → розділ Skills. Паралельно — `/context` у новій сесії desktop-застосунку: Skills 4,9k токенів.

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів в індексі; встановлено в `.claude/skills/`, коміт `c8d53ce` |
| `building-client-form` | Project | ~290 токенів в індексі; коміт `04d514b`; видно в `claude -p "/context"` і в `init` сесії Task B |
| `integrating-n8n-webhooks` | Project | ~330 токенів в індексі; коміт `2f6e85f`; видно в `claude -p "/context"` після коміту |

- Особисті скіли, які теж видно: `find-skills` (Source: User, `~/.claude/skills/find-skills/SKILL.md`, створено 27.09.2026 о 20:44 — разом із запуском `npx skills@1.7.0`). Решта — вбудовані скіли Claude Code (`code-review`, `simplify`, `init`, …). Для Task A–C не заважає; перед Task D `find-skills` треба прибрати з `~/.claude/skills/`, бо за протоколом у копії A не має бути жодного скіла, а в копії B — лише `integrating-n8n-webhooks`. **Оновлення перед Task D:** `find-skills` перенесено в `~/.claude/skills-disabled/`; після цього `/context` показує лише 3 скіли Project і вбудовані, особистих (User) — 0. У `~/.claude/skills/synced/` лишились синхронізовані застосунком скіли акаунта (`anthropic-skills:docs`, `docx`, `pdf`, `pptx`, `xlsx`, `skill-creator`…) — керує ними застосунок, до n8n/форм не стосуються й однакові для обох прогонів Task D.

## Task A — виправлення за скілом Vercel

### Рев'ю застосунку за скілом

- **Як робили:** окремий агент із чистим контекстом (субагент Claude Code, без історії цієї сесії й без наших знахідок) у копії `../hw4-review-base` на коміті `c8d53ce`: скіл уже встановлено, виправлень ще немає. Запит — дослівно з walkthrough, крок 5; режим лише читання.
- **Скіл спрацював?** Через інструмент Skill — ні: скіл встановили посеред сесії, і в індексі скілів цієї сесії його не було. Агент прочитав `SKILL.md` і 19 файлів `rules/*.md` напряму. Свіжа сесія CLI скіл бачить (див. вище); неінтерактивний `claude -p` з рев'ю запустити не вдалося — CLI не залогінений (`Not logged in`).
- **Відхилення:** у копії немає `node_modules`, тому документацію Next.js агент читав з `hw4/node_modules/next/dist/docs/` (та сама версія 16.3.5).

Знахідки (від CRITICAL до LOW; ✅ — виправлено в Task A):

| Файл:рядок | id правила | Що не так | Виправлення для Next.js 16 |
|---|---|---|---|
| `app/dashboard/page.tsx:14-18` | `async-parallel` ✅ | leads (400) → stats (1200) → sources (400) по черзі | `Promise.all` (коміт `6d3b885`) |
| `components/leads-toolbar.tsx:4` | `bundle-conditional` | `exceljs` у початковому бандлі, потрібен лише після кліку «Експорт» | `await import("exceljs")` у `handleExport`, preload на hover/focus |
| `components/leads-toolbar.tsx:6` | `bundle-dynamic-imports` | `SourcesChart` (recharts) у початковому чанку, показується лише після кліку | `next/dynamic` з `ssr: false` (файл уже Client Component) |
| `components/lead-search.tsx:5` | `bundle-barrel-imports` | `import { debounce } from "lodash"` — увесь CJS-пакет; `lodash` (на відміну від `lodash-es`) не оптимізується автоматично | `lodash/debounce` або прибрати debounce (`useDeferredValue`) |
| `app/actions.ts:68-77` | `server-auth-actions` ✅ | `updateLeadStatus`/`deleteLead` не перевіряють сесію й workspace; `proxy.ts` захищає лише сторінки `/dashboard/*`, а Server Action доступна прямим POST | `getCurrentUser()` + перевірка `lead.workspaceId` на початку кожної дії |
| `app/dashboard/layout.tsx:6-7` → `components/dashboard-header.tsx:5-6` | `server-parallel-fetching` ✅ | header повторює запити user/workspace | дедуплікація через `cache()` (коміт `a6385fb`) |
| `app/dashboard/leads/[id]/page.tsx:12-16` | `async-api-routes` | `getLead(id)` стартує лише після `getCurrentUser()` | стартувати проміс раніше, `Promise.all` |
| `app/dashboard/page.tsx` (без `loading.tsx`) | `async-suspense-boundaries` | уся сторінка чекає найповільніший `getLeadStats` (1200 мс) | async-компоненти в `<Suspense>` / `loading.tsx` |
| `app/dashboard/page.tsx:32` → `components/leads-table.tsx:12` | `server-serialization` ✅ | у Client Component — повні `Lead` з `rawPayload`, `internalNotes`, IP | лише 5 полів (коміт `ebff140`) |
| `components/lead-search.tsx:16-24` | `client-swr-dedup` | після гідрації повторно тягне `/api/leads` (~600 мс), експорт — ще раз | передати серверні рядки пропсом або `useSWR` |
| `lib/data.ts:7-16`, `lib/data.ts:18` | `server-cache-react` ✅ | `getCurrentUser` без `cache()`; `getWorkspace` з inline-об'єктом — кеш завжди промахується | `cache()` + примітивний аргумент (коміт `a6385fb`) |
| `app/actions.ts:53-63` | `server-after-nonblocking` | відповідь форми чекає `fetch` до n8n і `logAudit` (250 мс) | `after()` — **не застосовуємо в Task A**: виклик n8n переробляється за контрактом у Task D |
| `components/lead-search.tsx:18, 26-45` | `rerender-derived-state-no-effect`, `rerender-use-deferred-value` | похідний `filtered` через effect + debounce без `.cancel()` | `useDeferredValue` + `useMemo` |
| `components/leads-table.tsx:25`, `components/leads-toolbar.tsx:72` | `rerender-functional-setstate` | `setX(!x)` через замикання | `setX(v => !v)` |
| `components/leads-table.tsx:17-20` | `js-tosorted-immutable` | копія + сортування на кожен рендер, collator щоразу | `useMemo` + `toSorted`, `Intl.Collator` на рівні модуля |
| `lib/db.ts:334-338` | `js-combine-iterations` | `getSourceBreakdown` проходить ліди 6 разів (заглушка БД) | один прохід / `GROUP BY` |

Порівняння з нашим рев'ю: усі три наші виправлення агент знайшов незалежно. Нове, чого ми не
помітили: `server-auth-actions` (Server Actions без перевірки сесії — безпекова, а не лише
продуктивна проблема) і `client-swr-dedup` (повторний `/api/leads` з клієнта).

**Як міряли (для `async-parallel`):** продакшн-збірка (`npm run build && npm start`), cookie
`leaddesk_session=demo-u_olena`, один прогрівальний запит і 3 прогони
`curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s
" http://localhost:3000/dashboard`;
лічильники `db:…` — приріст у журналі `npm start` після одного `curl`.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `6d3b885` | `app/dashboard/page.tsx` | три незалежні запити дашборду — через `Promise.all` | TTFB 2,245 / 2,265 / 2,286 с | TTFB 1,458 / 1,447 / 1,445 с | `curl`, 3 прогони, prod |
| `server-cache-react` | `a6385fb` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` у `cache()`; `getWorkspace(slug: string)` замість `{ slug }` | `db:getUserBySession` ×3, `db:getWorkspace` ×3 на запит | ×1 і ×1; TTFB без змін (1,44–1,45 с) | лічильники `db:…` за один `curl` |
| `server-serialization` | `ebff140` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у `LeadsTable` передаються лише 5 полів, які таблиця рендерить (`LeadRow`) | HTML 424 592 Б, RSC 315 197 Б; `rawPayload` у HTML — 172 входження | HTML 111 377 Б (−74 %), RSC 31 257 Б (−90 %); `rawPayload`, `internalNotes`, `ipAddress`, `userAgent`, `phone`, `email` — 0 | `curl … | wc -c`, `curl … | grep -o <поле> | wc -l` |
| `server-auth-actions` | `a976a46` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` перевіряють сесію (`getCurrentUser`) і що лід належить workspace користувача; статус валідується за `LEAD_STATUSES` | Марта (Brightline) змінює статус і **видаляє** лід Studio Nova — HTTP 200, зміна застосована; статус `"hacked"` приймається | ті самі запити — HTTP 500 (`Lead not found` / `Invalid status`), дані не змінені; власник (Olena) змінює статус як і раніше | `curl -X POST` з `Next-Action: <id з .next/server/server-reference-manifest.json>` і cookie різних користувачів |

- Чому обрали для заміру `async-parallel`: ефект прямо передбачуваний із затримок у `lib/db.ts` (400 + 1200 + 400 → max 1200 мс, тобто −800 мс) і видно одним `curl`. Отримали −810…−840 мс.
- `server-cache-react`: layout, `DashboardHeader` і page кожен викликали `getCurrentUser()` і `getWorkspace()`. У `getWorkspace` `cache()` вже був, але аргумент-об'єкт створювався заново, а `React.cache` порівнює аргументи через `Object.is` — саме цей антипатерн описано в правилі. Перевірили, що не зламали: `/dashboard` без cookie → 307 на `/login`, з невідомою сесією → 307, `/dashboard/leads/lead_0001` → 200; `npm run build` проходить (типи всіх викликів `getWorkspace` оновлено).
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували: `bundle-barrel-imports` радить додати бібліотеки в `experimental.optimizePackageImports`. У Next.js 16.3.5 `recharts` уже в списку «optimized by default» (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`) — додавати його в конфіг зайве. `lodash` (CommonJS) у тому списку немає (є лише `lodash-es`), тож для нього допомогла б не конфігурація, а прямий імпорт `lodash/debounce`. Не застосовували: не входить у два виправлення, ефект на час відкриття дашборду незначний.
- Виміряне виправлення змінило числа: TTFB −35 %. `server-cache-react` на TTFB не вплинув, бо layout і page Next.js рендерить паралельно — дублікати йшли одночасно; ефект — утричі менше запитів до БД на відкриття сторінки.
- `server-serialization`: `LeadsTable` — Client Component, тож усі 25+ полів кожного з 172 лідів серіалізувались у HTML і RSC, включно з `rawPayload` (IP, user-agent, UTM), внутрішніми нотатками менеджерів, телефонами й email — хоча таблиця показує лише ім'я, компанію, статус і дату. Це і вага сторінки, і витік персональних даних у браузер (документація Next.js 16 `data-security.md` радить те саме: «safe, minimal DTOs»). Перевірили в браузері: 172 рядки, сортування за компанією — правильне, клік по рядку відкриває `/dashboard/leads/<id>`.
- `server-auth-actions` (знайдено рев'ю в чистому контексті): Server Actions — публічні POST-ендпоінти, а `proxy.ts` лише перевіряє, що cookie **є**. Перевірка: ті самі 5 запитів `curl` на старому й новому коді. На старому: чужий workspace змінив статус (`lead_0001` → `hacked`, бейдж порожній) і видалив `lead_0002` (сторінка → 404). Без cookie атака не пройшла й на старому коді: з маршруту `/login` дію не знайдено, а `/dashboard/*` без cookie відсікає `proxy.ts`, — отже дірка саме в авторизації (IDOR між workspace), а не в автентифікації. На новому: 3 атаки → HTTP 500, дані не змінено; легітимна зміна статусу власником → 200.
- `npm run lint`, `npm run build` після кожного виправлення: без помилок.

## Task B — `building-client-form`

- **Сесія:** нова, неінтерактивна: `claude -p --output-format stream-json --verbose` (Claude Code CLI 2.1.283, модель `claude-opus-5-5`, effort за замовчуванням) з теки `hw4` на коміті `04d514b`. Дозволені інструменти: `Read, Grep, Glob, Skill, Edit, Write, Bash(npm run lint), Bash(npm run build)`. У `init` сесії серед скілів — `building-client-form` і `vercel-react-best-practices` (Project), `find-skills` (User).
- Запит у свіжій сесії (скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- **Чи спрацював скіл і як це видно:** так, з першої спроби. **Перший** виклик інструмента в журналі сесії — `Skill {"skill":"building-client-form"}`, ще до читання коду. Далі агент прочитав `app/actions.ts`, `lib/lead-form.ts`, `lib/data.ts` (посилання зі скіла) і перевірив `after` у `node_modules/next/dist/docs`. 25 ходів, 75 с. `description` не змінювали.
- **Що зроблено (файли)** — коміт `70a2bac` (код агента без змін): `lib/note-form.ts` (`parseNoteForm`, `NoteFormState`), `components/note-form.tsx` (`useActionState`), `app/actions.ts` (`addLeadNote` + спільна перевірка `isOwnLead`), `lib/db.ts` (`appendInternalNote`), `app/dashboard/leads/[id]/page.tsx`. Агент сам не запустив lint/build: викликав `PowerShell`, а дозволено було лише `Bash(npm run …)` — дві відмови в `permission_denials`; запускали ми.
- **Що довелось виправити руками** — коміт `e92b702`: агент передав id через `useActionState(addLeadNote.bind(null, leadId))`. Відправка **без JS** з такою дією не завершувалась: дія повертала `invalid`, серверні компоненти рендерились (перевірено тимчасовими мітками в layout/header/page), а відповідь висіла до обриву клієнтом (15 с; `next dev`: `application-code: 15.0s`). Публічна форма заявки (`useActionState` без `bind`) і кнопка «Вийти» без JS працювали. Замінили `bind` на приховане поле `leadId` → та сама відправка — 0,5 с. Висновок перенесено в скіл (коміт `6cbdc2a`, версія 0.1.1): id — hidden-полем, у Verify — «відповідь без JS не висить».

**Пункти Verify зі скіла** (продакшн-збірка, `npm run build && npm start`; «без JS» — multipart POST з прихованими полями форми й заголовком `Origin`, як це робить браузер з вимкненим JavaScript):

| Пункт Verify | Результат |
|---|---|
| `npm run lint`, `npm run build` | без помилок (на `70a2bac` і на `e92b702`) |
| Порожня відправка | без JS: HTTP 200 за 483 мс, `role="alert"` «Перевірте 1 поле», під полем «Напишіть текст нотатки», `aria-invalid="true"`, `aria-describedby="note-text-error note-text-hint"`; з JS — те саме за 266 мс |
| Помилка — введене не зникає | 501 символ без JS: «Нотатка задовга: 501 із 500 символів. Скоротіть її.», у полі лишились 500 символів; з JS (510 символів) — так само |
| Відправка без JavaScript | до `e92b702` — **висла** (15 с, див. вище); після — коректна нотатка: HTTP 200 за 555 мс, `role="status"` «Нотатку додано», нотатка на сторінці |
| Дія без сесії | POST без cookie → 307 на `/login` (`proxy.ts`), запис не змінено |
| Дія для чужого об'єкта | Марта (Brightline) надсилає форму ліда Studio Nova (`lead_0002`) → дія повертає «Лід не знайдено», сторінка — 404; нотатку не дописано |
| Час відповіді не залежить від аудиту | з JS: 557 мс від кліку до «Нотатку додано»; `logAudit` (250 мс) — в `after()`; кнопка `disabled` і «Зберігаємо…» під час відправки |
| Журнал сервера без персональних даних | у журналі `npm start` лише `db:<запит>` і службові рядки Next.js; текстів нотаток і email — 0 збігів |

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- **Структура:** `SKILL.md` (138 рядків, `description` 969 символів) · `references/contract.md`, `response-modes.md`, `code-templates.md`, `n8n-setup.md` · `scripts/check-contract.mjs`, `send-signed-callback.mjs`, `mock-n8n.mjs` (байт-у-байт копія `tools/mock-n8n.mjs`, перевірено `cmp`).
- **Що лишили в `SKILL.md`, а що винесли в `references/` (і чому):** у `SKILL.md` — те, що агент мусить зробити щоразу: 4 змінні `.env.example`, правила запиту (модуль `lib/n8n/client.ts` + `server-only`, заголовки, конверт, таймаут, повтори), «хто викликає» (`after()`, посилання на `server-auth-actions` і `server-after-nonblocking` за id), правило 100 с, 9 кроків колбека одним рядком кожен, журнали, чекліст, правила зупинки, Verify. У `references/` — те, що потрібно лише під час написання коду або для пояснення «чому»: повні таблиці заголовків і тіл, повний порядок колбека з причинами (`contract.md`), режими відповіді й таблиця «код → дія», тестовий/production URL (`response-modes.md`), готові шаблони `lib/n8n/client.ts`, Server Action, колбек-роуту й сховища ключів (`code-templates.md`), налаштування n8n словами й пастки документації (`n8n-setup.md`). Посилання — прямі з `SKILL.md`, один рівень.
- **Правила зупинки — перелік:** тестовий URL у коді чи `.env.example`; секрет/токен у Client Component, `NEXT_PUBLIC_*`, query string, відповіді дії чи журналі; синхронна відповідь для довгого воркфлоу або воркфлоу невідомої тривалості; невідомо, які поля потрібні в `data` (спокуса слати весь запис чи персональні дані); зміна самого воркфлоу n8n, шляху, режиму чи credential; колбек без підпису; `runtime = "edge"` або інший рантайм без `node:crypto`.
- **Шаблони перевірено до коміту** (у тимчасовій копії проєкту поза репозиторієм, потім видалено): `next build` без помилок; `check-contract.mjs` на шаблонних файлах — жодного FAIL (FAIL лише у старому `app/actions.ts`); повний цикл з моком `--mode respond-202 --delay 3000`: `POST /webhook/quote-request -> 202 auth=ok idempotency=new`, через 3 с `callback … -> 202`, статус `processing` → `ready`; `send-signed-callback.mjs` — 13/13 PASS. Дві правки скриптів після цієї перевірки: C14 давав хибний FAIL на дозволеному `bytes=${Buffer.byteLength(raw)}` і `${body.event}`; `send-signed-callback.mjs` на Node 23 / Windows падав з `UV_HANDLE_CLOSING` (код 127) через `process.exit()` після `fetch` — замінено на `process.exitCode`.
- **SHA коміту зі скілом (BASE для Task D):** `2f6e85f`
- Що скіл змінив у собі після прогонів (коміти й чому): `bbbf5f1` — сліпа пляма `check-contract.mjs`, знайдена на коді прогону A (нестандартні `N8N_QUOTE_WEBHOOK_URL` і `app/api/quotes/[id]/callback` не впізнавались: 2 FAIL замість 10); `515f48b` — 2 попередження ESLint у скрипті (помітив агент B); `5a77b97` — чекліст `SKILL.md` 0.1.1: наявні виклики n8n привести до контракту або явно винести в окрему задачу, 0 FAIL на всьому проєкті. Деталі — `docs/ab-validation.md`, «Що змінилось у скілі».

**`check-contract.mjs` на коді `main`** (`git archive main` → `../leaddesk-main`, `--root ../leaddesk-main`):

```
check-contract · root: ../leaddesk-main · 15 checks
FAIL  C1   No test webhook URL (/webhook-test/) in code or .env.example
        .env.example:6  test webhook URL
PASS  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
FAIL  C3   Requests to n8n only from lib/n8n/client.ts
        app/actions.ts:54  fetch to n8n outside lib/n8n/client.ts
        app/actions.ts:54  N8N_WEBHOOK_URL read outside lib/n8n/client.ts
FAIL  C4   lib/n8n/client.ts starts with import "server-only"
        app/actions.ts:54  no lib/n8n/client.ts with import "server-only"
FAIL  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
        app/actions.ts:54  fetch without AbortSignal.timeout
FAIL  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
        app/actions.ts:54  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
FAIL  C7   Request body is the envelope { version, event, data }
        app/actions.ts:54  body is not the { version: 1, event, data } envelope
FAIL  C8   Server Actions do not await n8n: calls to n8n run inside after()
        app/actions.ts:54  n8n called in a Server Action outside after()
PASS  C9   Callback route reads the raw body and parses JSON only after the signature check (nothing to check: no callback route)
PASS  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures (nothing to check: no callback route)
PASS  C11  Callback checks x-n8n-timestamp within a 300 s window (nothing to check: no callback route)
PASS  C12  Callback uses idempotency-key and checks it against jobId from the signed body (nothing to check: no callback route)
PASS  C13  No runtime = "edge"
PASS  C14  No request bodies or personal data in logs of n8n / Server Action code
FAIL  C15  .env.example has the contract variables
        .env.example:1  N8N_WEBHOOK_BASE_URL is missing
        .env.example:1  N8N_WEBHOOK_TOKEN is missing
        .env.example:1  N8N_CALLBACK_SECRET is missing
        .env.example:1  APP_BASE_URL is missing
        .env.example:6  N8N_WEBHOOK_URL (full URL) — use N8N_WEBHOOK_BASE_URL + event path

8 FAIL, 7 PASS
exit=1
```

C9–C12 на `main` перевіряти нічого (колбек-роуту немає), тому їх перевірили на навмисно поганому коді.

**Що скрипт побачив на навмисно поганому коді** (тимчасова тека `../bad-callback`, потім видалена).
Варіант 1 — роут з `request.json()`, `JSON.stringify` замість сирого тіла, підпис через `!==`,
`runtime = "edge"`, `console.log("callback body", raw)`; клієнт без `server-only`, таймауту й заголовків,
з `NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL`; `.env.example` з `/webhook-test` і справжнім на вигляд токеном:

```
FAIL  C1   .env.example:1  test webhook URL
FAIL  C2   lib/n8n/client.ts:3  N8N_* exposed to the browser
FAIL  C4   lib/n8n/client.ts:2  first statement is not import "server-only"
FAIL  C5   lib/n8n/client.ts:3  fetch without AbortSignal.timeout
FAIL  C6   lib/n8n/client.ts:3  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
FAIL  C7   lib/n8n/client.ts:3  body is not the { version: 1, event, data } envelope
FAIL  C9   app/api/n8n/[event]/route.ts:5  request.json() instead of the raw body
           app/api/n8n/[event]/route.ts:1  raw body is never read (request.text())
FAIL  C10  app/api/n8n/[event]/route.ts:1  no crypto.timingSafeEqual
           app/api/n8n/[event]/route.ts:9  signature compared with !==
FAIL  C11  app/api/n8n/[event]/route.ts:1  x-n8n-timestamp is not read
FAIL  C12  app/api/n8n/[event]/route.ts:1  idempotency-key header is not used
FAIL  C13  app/api/n8n/[event]/route.ts:2  edge runtime (node:crypto needed)
FAIL  C14  app/api/n8n/[event]/route.ts:10  log may contain a body, secret or personal data
FAIL  C15  .env.example:1  N8N_WEBHOOK_BASE_URL must end with /webhook
           .env.example:2  N8N_WEBHOOK_TOKEN must be a change-me-… placeholder
13 FAIL, 2 PASS · exit=1
```

Варіант 2 — найтонший випадок: `request.text()`, вікно 300 с, довжина + `timingSafeEqual`, ключ проти
`jobId`, але `JSON.parse(raw)` **до** перевірки підпису:

```
FAIL  C9   app/api/n8n/[event]/route.ts:5  JSON.parse before the signature check
PASS  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures
PASS  C11  Callback checks x-n8n-timestamp within a 300 s window
PASS  C12  Callback uses idempotency-key and checks it against jobId from the signed body
```

`--changed-since` перевірено в git-копії з тегом `base`: додано рядок `console.log("lead", lead.email)`
і новий файл з `/webhook-test/` → лише `C1 lib/new-file.ts:1` і `C14 app/actions.ts:66`; старі FAIL у
`app/actions.ts:57` (рядок не змінювали) відфільтровано.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
check-contract · root: . (ws04 branch) · 15 checks
PASS  C1   No test webhook URL (/webhook-test/) in code or .env.example
PASS  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
PASS  C3   Requests to n8n only from lib/n8n/client.ts
PASS  C4   lib/n8n/client.ts starts with import "server-only"
PASS  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
PASS  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
PASS  C7   Request body is the envelope { version, event, data }
PASS  C8   Server Actions do not await n8n: calls to n8n run inside after()
PASS  C9   Callback route reads the raw body and parses JSON only after the signature check
PASS  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures
PASS  C11  Callback checks x-n8n-timestamp within a 300 s window
PASS  C12  Callback uses idempotency-key and checks it against jobId from the signed body
PASS  C13  No runtime = "edge"
PASS  C14  No request bodies or personal data in logs of n8n / Server Action code
PASS  C15  .env.example has the contract variables

0 FAIL, 15 PASS
exit=0
```

**Додатково: матриця колбеків** (`send-signed-callback.mjs`) — на шаблонному роуті до коміту — 13/13 PASS; на фінальному коді (гілка, `npm start` + мок):

```
send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request.completed · 10 cases
PASS  unknown event path                       expected 404, got 404
PASS  wrong content-type                       expected 415, got 415
PASS  body over 64 KB                          expected 413, got 413
PASS  timestamp 10 min old                     expected 401, got 401
PASS  timestamp 10 min ahead                   expected 401, got 401
PASS  wrong signature                          expected 401, got 401
PASS  signature without sha256= prefix         expected 401, got 401
PASS  body reformatted after signing           expected 401, got 401
PASS  valid signature, key != jobId:event      expected 400, got 400
PASS  valid signature, event of another path   expected 400, got 400

0 FAIL, 10 PASS
exit=0
```

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
