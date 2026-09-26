# Перевірка (Task A–C)

> Прогони A/B і фіча «запит на кошторис» — у [`docs/ab-validation.md`](ab-validation.md) (Task D).
> Бонус: E2 — [`docs/trigger-evals.md`](trigger-evals.md), E1 — [`docs/skill-review-n8n.md`](skill-review-n8n.md).

- **Інструмент і модель:** Claude Code 2.1.283, `claude-opus-5-5`
- **ОС, Node:** macOS (Darwin 24.6), zsh, Node 22.20.0; Next.js 16.3.5. Усі заміри — продакшн-збірка
  (`npm run build && npm start`), браузер — Google Chrome 153 (headless, через DevTools-протокол).

## Скіли видно у свіжій сесії

`claude -p "/context"` з кореня репозиторію, розділ Skills:

| Skill | Source | Токенів в описі |
|---|---|---|
| `building-client-form` | Project | ~300 |
| `integrating-n8n-webhooks` | Project | ~300 |
| `vercel-react-best-practices` | Project | ~120 |

Решта — вбудовані скіли Claude Code і синхронізовані з claude.ai (`~/.claude/skills/synced/`: docx, pdf, pptx, xlsx,
docs, google-workspace, import-memory, morning, skill-creator). Жоден не стосується форм, n8n чи продуктивності React.
Особистих копій наших скілів у `~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills` немає.

**Відповідність специфікації** (name = тека, `description` ≤ 1024 символи з «що» + «коли», `SKILL.md` < 500 рядків):
`building-client-form` — 875 символів, 145 рядків; `integrating-n8n-webhooks` — 857 символів, 134 рядки;
`vercel-react-best-practices` — 329 символів, 149 рядків. Усі три — так.

## Task A — виправлення за скілом Vercel

Сім виправлень, кожне окремим комітом `fix(<rule-id>)`. Кожну пораду перед застосуванням звіряв з
`node_modules/next/dist/docs/` (таблиця — `docs/skill-review.md`, розділ 5).

### До (`main`) і після (гілка) — один скрипт, однакові умови

| Що | `main` (`01a7dd4`) | гілка | Правило |
|---|---|---|---|
| `/dashboard`, перший байт (3 прогони) | 2242 / 2241 / 2244 мс | 218 / 218 / 215 мс | `async-suspense-boundaries` |
| `/dashboard`, уся сторінка (3 прогони) | 2251 / 2251 / 2252 мс | 1415 / 1416 / 1414 мс | `async-parallel` (`Promise.all` у `448bee5`; з `872ddaa` ті самі запити йдуть паралельно в сусідніх `<Suspense>`) |
| Запитів до БД на один `/dashboard` | 9: `getUserBySession` 3, `getWorkspace` 3, `getLeads`, `getLeadStats`, `getSourceBreakdown` по 1 | 5: усі по 1 | `server-cache-react` |
| HTML `/dashboard` | 424 592 Б; `rawPayload`, `ipAddress`, `internalNotes` — по 172 рази | 114 021 Б; 0 / 0 / 0 | `server-serialization` |
| RSC-відповідь `/dashboard` | 315 197 Б | 31 933 Б | `server-serialization` |
| Початковий JS `/dashboard` | 10 чанків, 1828 КБ / 526 КБ gzip | 9 чанків, 573 КБ / 178 КБ gzip | `bundle-conditional`, `bundle-dynamic-imports` |
| Де exceljs і recharts | обидва в одному чанку на 1266 КБ, який HTML вантажить одразу | exceljs (909 КБ) і recharts (350 КБ) — окремі чанки, вантажаться лише за кліком | те саме |
| Форма ліда проти мока n8n (`last-node`, воркфлоу 2 с), 3 відправки | 2451 / 2402 / 2399 мс | 158 / 141 / 135 мс | `server-after-nonblocking`: виклик n8n в `after()` — `54c14bc` (перенесено з прогону B1, ≈ 2 с), запис аудиту в `after()` — `a4d9712` (≈ 250 мс) |
| `updateLeadStatus` напряму на лід чужого workspace: підроблена cookie / користувач іншого workspace | HTTP 200, статус змінено / HTTP 200, змінено | HTTP 500, не змінено / HTTP 500, не змінено | `server-auth-actions` |

**Як міряли.** Один Node-скрипт на обох гілках (на `main` — `git checkout main`, та сама машина, одразу одне за одним):
- `/dashboard` — cookie `leaddesk_session=demo-u_olena`, один прогрівальний запит і три виміри `fetch()`: «перший байт» —
  коли прийшли заголовки (при стрімінгу вони приходять разом з оболонкою сторінки), «уся сторінка» — до кінця тіла;
- запити до БД — приріст лічильників `console.count("db:<запит>")` у журналі `npm start` за один запит;
- розміри — байти тіла `GET /dashboard` і того самого з заголовком `rsc: 1`; поля — підрахунок входжень у HTML;
- JS — усі `/_next/static/**.js`, на які посилається HTML `/dashboard`, розміри файлів з `.next/static` (gzip — Node zlib);
  бібліотеки шукали за характерними рядками (`xl/workbook.xml` — exceljs, `recharts-wrapper` — recharts) у кожному чанку;
- форма ліда — POST форми як браузер без JS (з прихованими полями дії з HTML), мок `tools/mock-n8n.mjs --mode last-node`.
  На `main` — `N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook/lead-created` (production-URL, щоб «воркфлоу» справді
  працював 2 с; з тестовим URL із `.env.example` мок відповідає `404 in 2 ms`, і замір був би нечесним), у журналі мока —
  `-> 200 in 2003 ms auth=none idempotency=absent … body 1010 B`. На гілці — ключі контракту з `.env.local`, мок з Header
  Auth: `-> 200 in 2001–2002 ms auth=ok idempotency=new … body 112 B` (у n8n іде мінімум замість усього рядка ліда);
- дія — `POST` з заголовком `next-action` = id `updateLeadStatus` з `.next/server/server-reference-manifest.json`,
  тіло `["lead_0007", "<статус>"]`; лід `lead_0007` належить workspace `brightline`, статус читали під його власником.

### Кожне виправлення окремо

Заміри одразу після кожного коміту (прод-збірка, `curl`, 3 прогони; JS — сума чанків з HTML):

| Правило (id) | Коміт | Файли | Що змінилось | Було | Стало |
|---|---|---|---|---|---|
| `async-parallel` | `448bee5` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` — `Promise.all` замість трьох послідовних `await` | TTFB 2,253 / 2,245 / 2,243 с | 1,429 / 1,427 / 1,435 с |
| `server-cache-react` | `6f5838e` | `lib/data.ts` + 4 виклики | `getCurrentUser` у `cache()`; `getWorkspace(slug)` з рядком замість `{ slug }` | 3× `getUserBySession`, 3× `getWorkspace` | 1× і 1× (TTFB без змін — див. нижче) |
| `server-serialization` | `6aabe2b` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у Client Component `LeadsTable` — 5 полів (`LeadRow`) замість цілого `Lead` | HTML 424 592 Б, RSC 315 197 Б | HTML 111 377 Б, RSC 31 257 Б |
| `bundle-conditional` | `f49d573` | `components/leads-toolbar.tsx` | `exceljs` — `await import("exceljs")` в обробнику «Експорт» | JS 1 871 692 Б (gzip 538 252) | 941 001 Б (gzip 282 762) |
| `bundle-dynamic-imports` | `cc0a87b` | `components/leads-toolbar.tsx` | графік — `next/dynamic(..., { ssr: false })` усередині Client Component | 941 001 Б (gzip 282 762) | 587 212 Б (gzip 181 721) |
| `server-auth-actions` | `df34d29` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` перевіряють сесію, належність ліда до workspace і валідний статус | підроблена cookie змінила статус чужого ліда (HTTP 200) | HTTP 500, статус не змінено |
| `async-suspense-boundaries` | `872ddaa` | `app/dashboard/page.tsx`, `components/stats-cards.tsx` | заголовок і пошук віддаються одразу; статистика, тулбар і таблиця — кожна у своєму `<Suspense>` зі скелетоном | перший байт 1423 / 1427 / 1420 мс | 221 / 216 / 211 мс, уся сторінка без змін (1419 / 1414 / 1412 мс) |

Ще одне виправлення за тим самим скілом зроблено під час доведення фічі (Task D): `a4d9712`
`fix(server-after-nonblocking)` — запис аудиту `lead.created` (250 мс) перенесено в `after()`.

Нотатки до таблиці:
- **Для заміру основним обрано `async-parallel`** — він прямо відповідає на скаргу клієнта («дашборд > 2 с»). Затримки в
  `lib/db.ts` детерміновані (сесія 100 + workspace 100, далі 400 → 1200 → 400 мс), тож очікування «≈ 2,2 → ≈ 1,4 с»
  (200 мс + найдовший запит 1200 мс) збіглося із заміром до сотих.
- **`server-cache-react` не змінив час — і це очікувано:** layout, header і page Next.js рендерить паралельно, три однакові
  запити йшли одночасно. Виграш — навантаження на БД (6 → 2 запити). Заразом знахідка: `getWorkspace` уже був у `cache()`,
  але приймав `{ slug }` — щоразу новий об'єкт, тож кеш не спрацьовував ніколи; саме від цього застерігає правило.
- **`server-serialization`** — ще й безпека: до браузера доходили IP, user agent, сирий payload форми й внутрішні нотатки
  менеджерів для всіх 172 лідів.
- **`server-auth-actions`:** `proxy.ts` перевіряє лише **наявність** cookie, а не її дійсність, тож будь-яке значення
  cookie відкривало дії. Дія тепер кидає помилку — Next.js відповідає 500; статус не змінюється.
- JS у зведеній таблиці — у КіБ (1828 КБ = 1 871 692 Б / 1024), по кроках — у байтах; це ті самі числа. HTML відрізняється
  (111 377 Б одразу після `server-serialization` проти 114 021 Б на фіналі), бо пізніше в сторінку додались скелетони
  `<Suspense>` і форма нотатки з Task B.

**Браузер** (Chrome 153 headless, продакшн-збірка гілки, JS увімкнено): `/dashboard` — таблиця лідів (172 засіяні ліди
Studio Nova; 175 — у прогоні, де перед тим у тому самому процесі тричі відправляли форму ліда) і картки статистики, браузер завантажив 8 скриптів (дев'ятий чанк з HTML — `noModule`-поліфіл, сучасний браузер його не бере); клік «Показати графік джерел» довантажив один чанк (`12u489g0chpbt.js`, recharts) і
намалював 6 стовпців; клік «Експорт в Excel» довантажив чанк exceljs (`1dlbn3ojb2_sj.js`) і скачав `leads-2026-09-26.xlsx`
(18 703 Б, zip-архів `PK…`; прогін на `e8c9f90`). Помилок і винятків у консолі — 0.

**Поради, звірені з документацією Next.js 16 і змінені або не застосовані:**
- `bundle-dynamic-imports` радить `next/dynamic(..., { ssr: false })` — у Server Component це помилка збірки
  (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:94`). Застосовано лише всередині Client Component
  `LeadsToolbar`; для exceljs узято простіший `await import()` на клік (`bundle-conditional`).
- `bundle-barrel-imports` радить `experimental.optimizePackageImports` — `recharts` Next.js 16 уже оптимізує за
  замовчуванням (`optimizePackageImports.md`). Для `lodash` перевірили збірку: чанк пошуку з `import { debounce } from
  "lodash"` важить 12 КБ і містить лише `debounce`, повного lodash у початкових чанках немає — не застосовували.

`npm run lint` і `npm run build` — без помилок після кожного виправлення.

## Task B — `building-client-form`

**Звичайний запит у свіжій сесії** (скіл не названо), з кореня репозиторію:
`claude -p --output-format stream-json --verbose --permission-mode acceptEdits` (модель у журналі сесії — `claude-opus-5-5[1m]`):

> На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів;
> нотатка дописується до внутрішніх нотаток ліда.

- **Скіл спрацював з першої спроби:** у журналі сесії є виклик інструмента `Skill` з `"skill":"building-client-form"`;
  у фінальній відповіді — «built with the project's `building-client-form` pattern». `description` не змінював.
- **Що зроблено** (коміт `0dabf4f`, код із цієї сесії без змін): `lib/note-form.ts` — чиста валідація (trim, не порожня,
  ≤ 500 символів, повертає `values`); `app/dashboard/leads/[id]/actions.ts` — дія `addNote`: сесія → валідація → лід
  належить workspace користувача → запис → `after(logAudit)` → `{ status }` (при помилці валідації — ще `errors`
  і `values`), без жодного рядка з бази; `components/note-form.tsx` —
  `useActionState`, `label`, `aria-invalid`/`aria-describedby`, підсумок у `role="alert"`, `defaultValue` з `values`,
  «Надсилаємо…»; `lib/db.ts` — `appendLeadNote`. Сесія ще й помітила, що `updateLeadStatus`/`deleteLead` не перевіряють
  сесію, — з цього виросло виправлення `server-auth-actions`.
- **Пункти Verify** (продакшн-збірка; «без JS» — multipart POST з прихованими полями `$ACTION_REF_1`, `$ACTION_1:*`,
  `$ACTION_KEY` з HTML, як відправляє браузер без JavaScript; «з JS» — Chrome):

  | Пункт Verify | Результат |
  |---|---|
  | `npm run lint`, `npm run build` | без помилок |
  | Порожня відправка, без JS | HTTP 200; «Напишіть текст нотатки», `aria-invalid="true"`, `role="alert"` «Перевірте поле нотатки» |
  | Порожня відправка, з JS | `aria-invalid="true"`, `aria-describedby` веде на «Напишіть текст нотатки», `role="alert"` «Перевірте поле нотатки» |
  | Введене не зникає | 501 символ → «Не більше 500 символів (зараз 501)», текст лишився в `<textarea>` |
  | Відправка без JS | валідна нотатка → HTTP 200 за 518 мс, «Нотатку додано.», нотатка на сторінці |
  | Відправка з JS | «Нотатку додано.» і нотатка на сторінці |
  | Дія без сесії | без cookie — `proxy.ts` відповідає 307 за 9 мс; з підробленою cookie `demo-intruder` (proxy її пропускає) — 307 → `/login` за 223 мс (дія перевірила сесію і нічого не записала, сторінка перенаправила), нотатку не збережено |
  | Чужий запис | `leadId=lead_0007` (workspace `brightline`) від користувача Studio Nova → «Лід не знайдено або він недоступний.», у лід нічого не записано |
  | Журнал сервера | лише `lead.note_added { leadId: 'lead_0002' }`; тексту нотатки, email, телефону — жодного збігу |

  Пізніше (`d3142ad`) текст нотатки зберігається й тоді, коли дія повертає `unauthorized`, `not_found` чи `error`, —
  раніше `values` поверталися лише при помилці валідації. Звідси й правка в скілі (`4ac1c1c`).

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакується; фічу будує агент у прогонах Task D. Основний доказ спрацювання — прогони B
(`docs/ab-validation.md`: скіл викликано першим кроком у 3 з 3).

- **`SKILL.md`** (134 рядки): схема двох сторін, стислий контракт (змінні, 5 правил виклику, режим, 10 кроків колбека),
  порядок роботи, чекліст з прив'язкою до перевірок C1–C15, правила зупинки, Verify. **`references/`** — те, що потрібно
  під час написання коду: `outbound-webhook.md` (змінні, заголовки, конверт, повтори, шаблони `lib/n8n/client.ts` і Server
  Action), `callback-route.md` (10 кроків з кодами відповідей і причинами, шаблон роуту, як запускати матрицю),
  `response-modes.md` (режими, правило 100 с, тестовий і production URL, ліміти, журнали, пастки документації),
  `n8n-setup.md` (налаштування вузлів n8n текстом для клієнта, мок, реєстр). Посилання з `SKILL.md` — прямі, один рівень.
  Правила Vercel `server-auth-actions` і `server-after-nonblocking` — за id, без копії тексту.
- **Правила зупинки:** тестовий URL або «поки без токена/підпису»; секрет у клієнтському коді, `NEXT_PUBLIC_*`, query
  string, журналі чи git; синхронне очікування довгого воркфлоу; зміна воркфлоу в n8n, його JSON чи код для вузла Code;
  випадок поза контрактом (інша схема підпису чи auth, колбек без підпису, файли замість посилань, > 64 КБ); нова залежність.
  Без винятків «якщо задача цього потребує».
- **`scripts/`:** `check-contract.mjs` (15 перевірок C1–C15, `--root`, `--changed-since`, `--json`, `--help`, коди виходу
  0/1/2, лише `node:`-модулі), `test-check-contract.mjs` (самотест на 18 фікстурах), `send-signed-callback.mjs` (матриця
  з 20 колбеків), `mock-n8n.mjs` (копія `tools/mock-n8n.mjs`).
- **BASE для Task D:** коміт зі скілом `9f608e4`.

**Що скіл змінив у собі після першого бою** (усе — окремими комітами після BASE):
- `85bd2c8` — `check-contract.mjs` не бачив коду прогону A1 (агент назвав змінну `N8N_QUOTE_WEBHOOK_URL`, а колбек поклав у
  `app/api/quotes/[id]/callback/route.ts`), і C3–C15 проходили «порожньо»; тепер будь-яка `process.env.N8N_*` (крім секрету
  колбека) — це виклик n8n, а будь-який route з `callback` у шляху чи згадкою n8n — колбек. Там же: хибний C1 FAIL на
  коментарі `.env.example` прогону B1 («never /webhook-test») — коментарі більше не рахуються.
- `1b6ae91` — хибний C10 FAIL у прогонах A2 і A3: вони порівнюють свій Bearer-токен через `timingSafeEqual` у модулі, який
  імпортує роут (`lib/quote-callback.ts`, `lib/quotes.ts`); тепер модулі, імпортовані колбек-роутом, теж рахуються.
- `8b34b4f` — матриця колбеків 9 → 18 випадків знайшла дві діри в перенесеному роуті (див. `docs/ab-validation.md`):
  `content-type` порівнювався через `startsWith`, і `application/jsonx` проходив; колбек іншої задачі перезаписував готовий
  кошторис. Виправлено і роут (`08f5334`), і шаблон у `references/callback-route.md`.
- `4ac1c1c` — ще дві діри з матриці 18 → 20 (`.completed` зі `status: "failed"`; колбек з чужим `correlationId`) і
  `Content-Length` до читання тіла — у шаблон роуту; уроки прогонів B1/B2 — у тексти скілів (контакти в n8n лише за
  потреби; посилання або `redirect()` на статус без JS; `values` за будь-якої невдачі дії, `key` для `<select>`).
- `ec23819` — самотест `test-check-contract.mjs` (тепер 18 випадків): проти скрипта з BASE він падає у 8 — три хибні
  результати з A/B, виправлені в `85bd2c8` (коментар у `.env.example`, вигадане ім'я `N8N_*`) і `1b6ae91` (перевірка в
  імпортованому модулі), відсутній номер рядка у FAIL (`4e4fce5`) і потокове читання тіла (`85e2b83`); проти поточного — 18/18.
- `b540c6d` / `85e2b83` — після другого рев'ю CodeRabbit: chunked-запит без `Content-Length` обходив ранню перевірку
  розміру, і `req.text()` читав усе тіло до перевірки підпису. Тепер тіло читається потоком з обривом на 64 КБ (роут і
  шаблон); 128 КБ і пауза 3 с раніше отримували 413 через 3008 мс, тепер — через 38 мс. C9 визнає таке читання сирим.
- `4e4fce5` — після рев'ю CodeRabbit кожна знахідка `check-contract.mjs` має `файл:рядок`: знахідки «на рівні файлу»
  (немає заголовка, ключа в `.env.example`, перевірки часу) прив'язано до рядка, де треба правити (обробник `POST`,
  `createHmac`, виклик `fetch`) або до рядка 1. Самотест тепер перевіряє саму вимогу — попередня версія скрипта падає на
  ній у 5 випадках — і знаходить скрипт через `fileURLToPath` (працює на Windows і в шляхах із пробілами).
- `70c0a30` — шаблон колбек-роуту відповідає 400 (а не 500) на тіло, що не є JSON, і на порожній `idempotency-key`.
- `e8c9f90` — шаблон клієнта n8n не йде за перенаправленнями (`redirect: "manual"`): інакше `fetch` пересилає
  `x-n8n-token` на хост із `Location` (знайдено й перевірено на коді фічі, `73379ce`).
- `37aac6c` — приклади коду в скілах приведено до тексту: дія у `building-client-form` повертає `values` за будь-якої
  невдачі, шаблон колбека логує деструктуризований `correlationId`; шаблонний роут проходить C9–C14 `check-contract.mjs`.

**`check-contract.mjs` на коді `main`** (`git archive main | tar -x -C ../leaddesk-main`):

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ../leaddesk-main; echo "exit=$?"
check-contract: ../leaddesk-main
scope: whole project

C1   FAIL  no test webhook URL (/webhook-test/) in code or .env.example
      .env.example:6  N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2   PASS  no N8N_* variable with NEXT_PUBLIC_ prefix
C3   FAIL  n8n is called only from lib/n8n/client.ts
      app/actions.ts:54  await fetch(process.env.N8N_WEBHOOK_URL!, {
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
      app/actions.ts:54  n8n is called here, but lib/n8n/client.ts does not exist
C5   FAIL  every fetch() to n8n has a timeout signal
      app/actions.ts:54  fetch() without signal: AbortSignal.timeout(10_000)
C6   N/A   n8n client sends x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  .env.example lists the contract keys with safe values
      .env.example:1  missing N8N_WEBHOOK_BASE_URL
      .env.example:1  missing N8N_WEBHOOK_TOKEN
      .env.example:1  missing N8N_CALLBACK_SECRET
      .env.example:1  missing APP_BASE_URL
      .env.example:6  legacy N8N_WEBHOOK_URL — use N8N_WEBHOOK_BASE_URL + event path
C8   FAIL  Server Actions do not wait for n8n (call runs inside after())
      app/actions.ts:54  Server Action reaches n8n without after(): the user waits for the webhook
C9   N/A   callback reads the raw body; no .json()/JSON.parse before the signature check
C10  N/A   callback signature compared with crypto.timingSafeEqual, not ===
C11  N/A   callback rejects x-n8n-timestamp outside a 300 s window
C12  N/A   callback deduplicates by idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  n8n code does not log bodies, headers, secrets or personal data
C15  FAIL  request body is the envelope {version, event, data}, not a whole DB row
      app/actions.ts:54  body is JSON.stringify(lead) — send { version, event, data } with minimal data

3 PASS, 7 FAIL, 5 N/A
exit=1
```

N/A замість PASS там, де нема на що дивитись (колбек-роуту на `main` немає): «усе зелене» не має означати «нікуди не
дивились». Цей вивід пояснює й першу знахідку з налаштування: форма шле в n8n весь рядок ліда (з IP, user agent, сирими
даними форми) на тестовий URL без токена й таймауту, чекає відповідь синхронно, а помилку ковтає — тому мок пише `404`,
а форма каже «Дякуємо».

**Самотест скрипта** — `node .claude/skills/integrating-n8n-webhooks/scripts/test-check-contract.mjs`: кожен випадок —
маленький проєкт у тимчасовій теці й очікуваний статус для конкретних перевірок (порушення й коректний код, на якому
перевірки не повинні спрацьовувати):

```
PASS  contract-compliant project
PASS  no n8n code at all
PASS  legacy call like main (test URL, whole row, awaited)
PASS  comment explaining the rule is not a test URL
PASS  NEXT_PUBLIC_ n8n variable
PASS  agent-invented env name outside the client
PASS  client without server-only and headers
PASS  real-looking token in .env.example
PASS  Server Action awaits n8n without after()
PASS  callback reads req.json()
PASS  capped stream read counts as raw body
PASS  JSON.parse before the signature check
PASS  signature compared with !==
PASS  verification in an imported helper (lib/quote-callback.ts)
PASS  runtime = "edge"
PASS  logging the raw body and a token
PASS  --changed-since keeps the new line 7, drops the old line 4 (C3 whole: 4,7; changed: 7; C5 changed: 7)
PASS  unknown git ref -> exit 2 (got 2)

0 failed, 18 passed (18 cases)
exit=0
```

Той самий тест проти `check-contract.mjs` з BASE (`9f608e4`) — падає там, де BASE помилявся або не виконував вимог:

```
FAIL  legacy call like main (test URL, whole row, awaited)  — finding without file:line: C7 .env.example, C7 .env.example, C7 .env.example, C7 .env.example
FAIL  comment explaining the rule is not a test URL  — C1 expected PASS, got FAIL
FAIL  agent-invented env name outside the client  — C3 expected FAIL, got PASS
FAIL  client without server-only and headers  — finding without file:line: C6 lib/n8n/client.ts, C6 lib/n8n/client.ts, C6 lib/n8n/client.ts, C6 lib/n8n/client.ts
FAIL  callback reads req.json()  — finding without file:line: C9 app/api/n8n/[event]/route.ts
FAIL  capped stream read counts as raw body  — C9 expected PASS, got FAIL; finding without file:line: C9 app/api/n8n/[event]/route.ts
FAIL  signature compared with !==  — finding without file:line: C10 app/api/n8n/[event]/route.ts
FAIL  verification in an imported helper (lib/quote-callback.ts)  — C10 expected PASS, got FAIL; finding without file:line: C10 app/api/n8n/[event]/route.ts, C11 app/api/n8n/[event]/route.ts, C12 app/api/n8n/[event]/route.ts, C12 app/api/n8n/[event]/route.ts
8 failed, 10 passed (18 cases)
```

**`check-contract.mjs` на фінальному коді гілки:**

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs; echo "exit=$?"
check-contract: .
scope: whole project

C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no N8N_* variable with NEXT_PUBLIC_ prefix
C3   PASS  n8n is called only from lib/n8n/client.ts
C4   PASS  lib/n8n/client.ts exists and starts with import "server-only"
C5   PASS  every fetch() to n8n has a timeout signal
C6   PASS  n8n client sends x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  .env.example lists the contract keys with safe values
C8   PASS  Server Actions do not wait for n8n (call runs inside after())
C9   PASS  callback reads the raw body; no .json()/JSON.parse before the signature check
C10  PASS  callback signature compared with crypto.timingSafeEqual, not ===
C11  PASS  callback rejects x-n8n-timestamp outside a 300 s window
C12  PASS  callback deduplicates by idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  n8n code does not log bodies, headers, secrets or personal data
C15  PASS  request body is the envelope {version, event, data}, not a whole DB row

15 PASS, 0 FAIL, 0 N/A
exit=0
```

Матриця колбеків на фінальному коді (20/20) — у `docs/ab-validation.md`, розділ про перенесення.
