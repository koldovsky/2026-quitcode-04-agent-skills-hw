# Перевірка (Task A–C)

Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code 2.1.283 (розширення VS Code) · Opus 5.5
- **ОС і термінал, Node:** Windows 11 Home · Git Bash · Node 24.12.0

## Скіли видно у свіжій сесії

- Як перевіряли: `/skills` у новій сесії Claude Code (VS Code).

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | `/vercel-react-best-practices` · project · ~120 tokens; 75 файлів у `.claude/skills/`, коміт `8bc9f78` |
| `building-client-form` | Project | спрацював у свіжій сесії без назви (Task B) |
| `integrating-n8n-webhooks` | Project | у списку скілів на старті нової сесії Claude Code (VS Code), 27.09.2026; тека `.claude/skills/integrating-n8n-webhooks/` |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки:
  у `~/.claude/skills/` — `find-skills`, `postgres-migrations`, `synced`. На Task A не впливають
  (не про React/Next.js); перед прогонами Task D їх треба врахувати — у прогоні A вони будуть видні.

## Task A — виправлення за скілом Vercel

Рев'ю зроблено в новій сесії запитом «Зроби рев'ю app/, components/, lib/ за скілом
vercel-react-best-practices… Файли не змінюй»: 17 знахідок. Застосовано 3: два — з числами
продуктивності, третє (`server-auth-actions`) — безпека, з вимірюваним «було/стало» за журналом `db:*`.

**Як міряли:** продакшн-збірка (`npm run build`, потім `npx next start -p 3001` — на `:3000` працював
`npm run dev`); cookie `leaddesk_session=demo-u_olena`; `curl` на `/dashboard`: 1 прогрів + 5 прогонів
`-w "TTFB %{time_starttransfer}s, total %{time_total}s"`; розмір — `curl -s … | wc -c` (HTML) і
`curl -sL -H "RSC: 1" … | wc -c` (RSC); поля ліда в HTML — `grep -o '<поле>' | wc -l`; запити до БД —
приріст лічильників `db:…` у журналі `next start` після одного `curl`. «Було» — коміт `8bc9f78`
(код = `main`), кожне «Стало» — одразу після свого коміту. Для `server-serialization` «було» те саме:
між `8bc9f78` і `a829fe1` змінився лише порядок запитів, а не props таблиці, тож розмір HTML/RSC
на обох комітах однаковий.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `a829fe1` | `app/dashboard/page.tsx` | `getLeads` (400 мс), `getLeadStats` (1200 мс), `getSourceBreakdown` (400 мс) — через `Promise.all` замість трьох послідовних `await` | TTFB 2.279 / 2.281 / 2.298 / 2.304 / 2.274 с (медіана **2.28 с**) | TTFB 1.511 / 1.502 / 1.468 / 1.452 / 1.475 с (медіана **1.48 с**) | `curl` TTFB, 5 прогонів |
| `server-serialization` | `08725c4` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у клієнтський `LeadsTable` передаються лише 5 полів (`LeadRow = Pick<Lead, "id" \| "fullName" \| "company" \| "status" \| "createdAt">`) замість усього `Lead` | HTML **424 592 Б**, RSC **315 197 Б**; `rawPayload`/`ipAddress`/`internalNotes` у HTML — по 172, `userAgent` — 344 | HTML **111 377 Б** (−74 %), RSC **31 257 Б** (−90 %); усі чотири поля — 0 | `curl … \| wc -c`, `grep -o … \| wc -l` |
| `server-auth-actions` | `8fe89ee` | `app/actions.ts` | `updateLeadStatus` і `deleteLead` перевіряють сесію, належність ліда до воркспейсу користувача й значення статусу (`LEAD_STATUSES`) і повертають лише `{ status }`; `addLeadNote` — та сама перевірка (`authorizeLead`) | cookie `bogus` → `db:updateLeadStatus` / `db:deleteLead` **виконано**; `demo-u_marta` (brightline) на лід studio-nova — теж; статус `"hacked"` — записано | `{"status":"unauthorized"}` лише з `db:getUserBySession`; `{"status":"forbidden"}` без запису; `"hacked"` → `{"status":"invalid"}`; коректний виклик → `ok` і `db:updateLeadStatus: 1` | виклик дії напряму (POST із заголовком `Next-Action`, id з `server-reference-manifest.json`), приріст `db:*` у журналі `next start` |

Запити до БД на один запит сторінки не змінились (9: `getUserBySession` ×3, `getWorkspace` ×3,
`getLeads`, `getLeadStats`, `getSourceBreakdown`) — змінився лише порядок: після `async-parallel`
три запити сторінки стартують разом.

- Чому головним заміром обрали `async-parallel`: найбільший внесок у скаргу клієнта («дашборд > 2 с»), ефект
  передбачуваний із `LATENCY_MS` у `lib/db.ts` (400 + 1200 + 400 → max = 1200 мс, очікувано −0,8 с) і
  видно одним `curl`. Отримали −0,80 с — збігається з розрахунком. Решта ~1,5 с — `getCurrentUser`
  і `getWorkspace` перед запитами (≈200 мс) і сам `getLeadStats` (1200 мс).
- `server-serialization` — навіщо: `LeadsTable` — Client Component, тож усе, що в його props,
  серіалізується в RSC Payload і HTML; таблиця використовує 5 полів із ~30, а в браузер ішли IP,
  user-agent, сирий payload форми й внутрішні нотатки (витік PII, не лише вага). Як переконались, що не
  зламали: `npm run lint` і `npm run build` (TypeScript перевіряє, що таблиця не читає інших полів:
  сортування й рядки використовують лише `fullName`, `company`, `status`, `createdAt`, `id`);
  `/dashboard` віддає сторінку з таблицею (111 КБ HTML). Вручну в браузері після `08725c4`: клік по
  заголовках таблиці сортує рядки, клік по рядку відкриває сторінку ліда — працює.
- `server-auth-actions` — навіщо: Server Action — публічний POST-ендпоінт, а `proxy.ts` перевіряє
  лише наявність cookie, не її значення й не права. До виправлення будь-хто з будь-якою cookie міг
  змінити статус чи видалити лід будь-якого воркспейсу (див. «Було»). Документація 16.3.5:
  `01-getting-started/07-mutating-data.md:32`, `02-guides/production-checklist.md:102`. Як
  переконались, що не зламали: `npm run lint`, `npm run build`; коректний виклик дає `ok` і
  `db:updateLeadStatus: 1`; `LeadActions` результат не читає, лише робить `router.refresh()`.
  «Було» знято тим самим скриптом на коді до коміту (тимчасова копія поза репозиторієм,
  `next start`), «стало» — на `8fe89ee`.

- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували або змінили — і чому:
  - `bundle-barrel-imports` для `import { debounce } from "lodash"` (`components/lead-search.tsx:5`) і
    `recharts` — у 16.3.5 не потрібна: `node_modules/next/dist/server/config.js:1117` за замовчуванням
    додає `modularizeImports: { lodash: { transform: "lodash/{{member}}" } }`, а `recharts` є в
    списку автоматичного `optimizePackageImports`
    (`docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`).
  - `server-cache-react` для `getWorkspace` — порада рев'ю правильна (`cache()` з inline-об'єктом
    `{ slug }` порівнює аргументи через `Object.is`, тож кеш не спрацьовує, і `getWorkspace` іде 3 рази),
    але в цій домашці не застосовано: досить двох виправлень.
  - `rendering-hydration-suppress-warning` для дат у `LeadsTable` — рев'ю саме пропонує не глушити
    попередження, а прибрати розбіжність (`timeZone`); погоджуємось: за
    `02-guides/preventing-flash-before-hydration.md:109-113` атрибут лишає в DOM серверне значення
    («The DOM wins») і має сенс лише з inline-скриптом, що виправляє дату до гідрації. Такого скрипта
    немає, тож `suppressHydrationWarning` не застосовуємо.
- Якщо виміряне виправлення не змінило чисел — чому: змінило (див. таблицю).
- `npm run lint`, `npm run build` після виправлень: після кожного з трьох комітів — без помилок і
  попереджень.

## Task B — `building-client-form`

Скіл — коміт `e6c6139` (на цій версії, 143 рядки, був прогін нижче); після перевірки виправлено в
`db83cd6`, `9b3019c` і `8f9fa18` — зараз 174 рядки (< 500). `name: building-client-form` = тека;
`description` 864 символи (≤ 1024), не змінювався; лише інструкції (без `scripts/`, `references/`);
правила Vercel — за id (`server-auth-actions`, `server-serialization`, `server-after-nonblocking`,
`rendering-usetransition-loading`).

- Запит у свіжій сесії Claude Code (VS Code, Opus 5.5; скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове
  > поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл і як це видно: **так, з першої спроби** — першим кроком після запиту в журналі
  сесії виклик `building-client-form · skill` (інструмент `Skill`), ще до читання будь-яких файлів
  проєкту.
- Якщо не з першого разу: не знадобилось; `description` не змінювали.
- Що зроблено (коміт `8eb0a8a`):
  - `lib/note-form.ts` — `parseNoteForm`: серверна валідація (порожньо / > 500 символів; CRLF
    рахується як один символ, як у `maxLength`), повертає `errors` і `values`;
  - `app/actions.ts` — `addLeadNote`: сесія → `unauthorized`, лід з воркспейсу користувача →
    інакше `forbidden`, валідація, запис, `revalidatePath`; повертає лише `{ status, … }`;
  - `components/lead-note-form.tsx` — `useActionState`, `label htmlFor`, `aria-invalid`,
    `aria-describedby`, `role="alert"` для помилок, `role="status"` для успіху, `defaultValue` з
    `values`, `leadId` — прихованим полем;
  - `lib/data.ts` — `getSessionUser()` (повертає `null` замість редиректу, `getCurrentUser()` на ній);
    `lib/db.ts` — `appendLeadNote`; `app/dashboard/leads/[id]/page.tsx` — блок нотаток і форма.
- Пункти Verify зі скіла — результат кожного:
  - `npm run lint`, `npm run build` — без помилок (агент і повторно вручну після сесії). ✅
  - Порожня відправка — «Нотатку не збережено: виправте поле нижче.» у `<p role="alert">`, під полем
    «Напишіть текст нотатки»; у DevTools у `<textarea>` — `aria-invalid="true"`,
    `aria-describedby="note-text-hint note-text-error"`. Дія повернула
    `{"status":"invalid","errors":{"text":"Напишіть текст нотатки"},"values":{"text":""}}`. ✅
  - Понад 500 символів в обхід `maxLength` (501 символ, multipart POST без JS, `next start`,
    після `aeba5bf`) — `HTTP 200`, «Нотатка має бути не довшою за 500 символів» під полем,
    `aria-invalid="true"`, у `<textarea>` лишились **усі 501** символи. До `aeba5bf` `parseNoteForm`
    обрізав `values` до 500 — текст «лишався» не весь; тепер введене повертається без змін. ✅
  - Успішна відправка — «Нотатку додано.» (`role="status"`), нотатка з'явилась у «Внутрішні
    нотатки»; у журналі `db:appendLeadNote: 1`. ✅
  - Без JS — працює. ✅ Серверний HTML форми (як його бачить браузер без JS):
    `<form … action="" encType="multipart/form-data" method="POST">` зі службовими полями React
    (`$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`) і `leadId`. Цю форму надіслано
    звичайним multipart POST без виконання JS (скрипт на Node `fetch`), і на `next start`, і на
    `next dev`:
    - порожня → `HTTP 200`, сторінка з `role="alert"` «Нотатку не збережено…» і `aria-invalid="true"`;
    - з текстом → `HTTP 200` за ~0,8 с, «Нотатку додано.», текст у «Внутрішні нотатки»,
      `db:appendLeadNote: 1`;
    - з cookie `bogus` → запису немає (після дії рендер сторінки через `getCurrentUser()` дає
      редирект на `/login`, `HTTP 307`).

    У браузері з DevTools «Disable JavaScript» спершу «не працювало»: вимкнення JS діє лише після
    **перезавантаження** сторінки — у вже гідрованому DOM форма має
    `action="javascript:throw new Error('A React form was unexpectedly submitted…')"`, яку React
    ставить на клієнті, і без JS така форма нічого не відправляє.
    Перевірено в браузері після F5: помилка й збереження працюють ✅
  - Без сесії:
    - cookie **видалено** — `proxy.ts` перенаправив POST на `/login` (`POST /login 200 in 61ms`), у
      dev — «An unexpected response was received from the server»; **запису немає** (після цього в
      журналі жодного `db:appendLeadNote`). Дію цей сценарій не перевіряє: до неї запит не дійшов;
    - cookie **змінено** на `bogus` (DevTools → Application → Cookies) — перевірено в браузері:
      форма показала «Сесія завершилась. Увійдіть знову.», у журналі після
      `POST /dashboard/leads/lead_0023 200 in 202ms` лише `db:getUserBySession` — без `db:getWorkspace`,
      `db:getLead` і `db:appendLeadNote`, тобто дія зупинилась на першій перевірці. ✅
    - з cookie `bogus` і вже гідрованою формою (виклик дії так, як її робить React: заголовок
      `Next-Action`, аргументи `[prevState, FormData]`) — дія повернула
      `{"status":"unauthorized","message":"Сесія завершилась. Увійдіть знову.","values":{"text":"текст після зміни cookie"}}`
      — введене не зникає (після `aeba5bf`; раніше `values` були лише в `invalid`); у журналі лише
      `db:getUserBySession`. ✅
  - Чужий ресурс: `demo-u_marta` (воркспейс brightline) відкрила свій лід `lead_0007`, у формі
    підмінено приховане `leadId` на `lead_0002` (studio-nova), multipart POST без JS на `next start` —
    `HTTP 200`, «Немає доступу до цього ліда.» у `role="alert"`, текст («чужий лід») лишився в полі,
    у журналі `db:getUserBySession`, `db:getWorkspace`, `db:getLead` — **без** `db:appendLeadNote`. ✅
  - Журнал сервера (`npm run build && npm start`): у коді дії лише
    `console.error("lead.note_add failed", { leadId, code })`, без тексту. Журнал `next start` на двох
    відправках без JS — невалідній (501 символ) і успішній — містить лише лічильники `db:*`, жодного
    тексту нотатки, email чи імені:

    ```
    # 501 символ → invalid
    db:getUserBySession: 65 · db:getWorkspace: 61 · db:getLead: 25 · db:getUserBySession: 66 ·
    db:getUserBySession: 67 · db:getWorkspace: 62 · db:getWorkspace: 63 · db:getLead: 26 ·
    db:getUserBySession: 68 · db:getWorkspace: 64
    # «Перевірка без JS: клієнт просить дзвінок у вівторок» → ok
    db:getUserBySession: 72 · db:getWorkspace: 68 · db:getLead: 28 · db:appendLeadNote: 3 ·
    db:getUserBySession: 73 · db:getUserBySession: 74 · db:getWorkspace: 69 · db:getWorkspace: 70 ·
    db:getLead: 29 · db:getUserBySession: 75 · db:getWorkspace: 71
    ```

    `next dev` сам журналює назву, аргументи й тривалість Server Action (`└─ ƒ addLeadNote({…})`),
    тож у терміналі розробника введене видно; у `next start` цього рядка немає. Не вимикали:
    `logging.serverFunctions: false` — налаштування всього проєкту, скіл лишає це рішення людині. ✅
  - Відповідь приходить одразу: у дії немає повільних побічних ефектів (листів, n8n, аудиту), тож
    `after()` тут не потрібен; відправка без JS — `HTTP 200` за 0,65–0,78 с, це повний рендер сторінки
    з синтетичними затримками `lib/db.ts`, дія сама — ~0,28 с (`getUserBySession` 100 мс, потім
    `getWorkspace` і `getLead` паралельно — 100 мс, `appendLeadNote` 80 мс). ✅

**Що скіл виправив у собі після перевірки.**

Коміт `db83cd6` (одразу після прогону):

- порада `addNote.bind(null, leadId)` у Client Component з `useActionState`: агент знайшов, що без JS
  POST зависає (нотатка записана, відповіді немає), і сам перейшов на приховане поле
  (`docs/01-app/02-guides/forms.md:126` таку альтернативу описує);
- пункт Verify «без сесії»: змінювати значення cookie, а не видаляти — інакше спрацьовує `proxy.ts`;
- журнал: `next dev` журналює аргументи Server Action — перевіряти на продакшн-збірці.

Коміт `8f9fa18` (після рев'ю скіла й коду; код — `aeba5bf`):

- `.bind()`: у `db83cd6` скіл подавав це як загальне правило («`.bind()` лише в Server Component»),
  а `forms.md:127` каже: «`bind` works in both Server and Client Components and supports progressive
  enhancement». Відтворили в тимчасовій копії поза репозиторієм (Next.js 16.3.5, React 19.2.8,
  `next start`): `useActionState(addLeadNoteFor.bind(null, leadId), …)` без прихованого поля,
  multipart POST без JS — `db:appendLeadNote: 1`, але `TimeoutError after 20006 ms — no response`.
  Тепер скіл цитує документацію (обидва способи допустимі), подає приховане поле як рішення команди
  й наводить це відтворення, а не загальне правило;
- `values` — у **кожному** стані помилки: React 19 скидає форму після будь-якої дії, тож після
  `unauthorized` / `forbidden` / `error` нотатка зникала (пункт 8 чекліста скіла цього вимагав, а
  тип у самому скілі — ні). Той самий тип агент переніс у код; виправлено в `aeba5bf`;
- крок 1.1: хелпер сесії, що повертає `null` (`getSessionUser()`), а не `getCurrentUser()` з
  редиректом; `next dev` журналює назву, аргументи й **тривалість** (`logging.md`), не результат;
- Verify: окремо «невалідне непорожнє значення лишається» (порожня відправка цього не перевіряє) і
  «чужий ресурс → `forbidden`»; з прикладу прибрано `tabIndex={-1}` без коду, що переводить фокус.

Рішення, які агент залишив людині (правило зупинки «неясно, хто має право»): хто може додавати
нотатки (зараз — будь-хто з воркспейсу ліда), формат нотатки (без автора й дати), аудит (не
пишеться, як і для зміни статусу/видалення). Для домашки лишили як є.

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому):
  - `SKILL.md` (136 рядків) — те, що агент має зробити: контракт однією таблицею (обидва напрями:
    хто, URL, захист, ідемпотентність, трасування, тіло, відповідь), 7 кроків «Як робимо», чекліст
    з 10 пунктів, правила зупинки, Verify і прямі посилання на кожен файл `references/`.
  - `references/contract.md` — змінні, запит до n8n (конверт, заголовки), таймаут і повтори,
    режими відповіді, тестовий vs production URL, журнали, ліміти, мок: це «чому» й довідка, яку
    агент відкриває перед викликом n8n.
  - `references/callback.md` — 10 кроків обробки колбека таблицею «крок → код відповіді» і
    окремо «чому саме так»: порядок тут критичний, а пояснення довгі.
  - `references/code-templates.md` — шаблони `lib/n8n/client.ts`, `lib/n8n/idempotency.ts`,
    `app/api/n8n/[event]/route.ts`, Server Action з `after()` (у записці коду немає — це додано).
    Перевірка шаблонів — у тимчасовій копії LeadDesk поза репозиторієм (`../leaddesk-verify-tmp`,
    видалена після перевірки), з мінімальними реалізаціями того, що в кожному проєкті своє
    (`db.insertQuote`, `db.updateQuoteIfStatus`, `parseQuoteForm`): `next build` (з перевіркою
    TypeScript) і `eslint` — без помилок; `check-contract.mjs` — 13 PASS (вивід нижче); колбек-роут
    на `next start` — 11/11 випадків `send-signed-callback.mjs` (нижче).
  - `references/n8n-setup.md` — що передати людині для налаштування воркфлоу, відомі пастки
    (таблиця «джерело каже / насправді / що робимо»), поза межами, реєстр інтеграцій.
  - Записку не переписано: переструктуровано під задачі агента (таблиці замість прози), додано
    шаблони коду, скрипти й правила зупинки, яких у записці немає.
  - Правила Vercel — лише за id: `server-auth-actions`, `server-after-nonblocking`.
- Правила зупинки — перелік: тестовий URL у коді/`.env.example`; секрет у клієнтському коді,
  `NEXT_PUBLIC_*`, query, журналі, git чи відповіді (значень не вигадувати й не читати
  `.env.local`); синхронне очікування воркфлоу невідомої або довгої (≈100 с) тривалості; невідомі
  режим відповіді й шлях воркфлоу; зміна/експорт воркфлоу чи код вузла Code; послаблення перевірки
  колбека «для налагодження»; сховище `idempotency-key` лише в пам'яті для продакшну; персональні
  дані понад мінімум, файли замість посилань, встановлення пакетів. Без винятків «якщо задача
  цього потребує».
- Скрипти (лише вбудовані модулі Node):
  - `scripts/check-contract.mjs` — 13 перевірок C1–C13 з PASS/FAIL, для FAIL — файл:рядок;
    `--root`, `--changed-since`, `--help`; код виходу 0 / 1 при FAIL / 2 при помилці аргументів;
    значень секретів з `.env.example` не друкує (`<значення приховано>`);
  - `scripts/send-signed-callback.mjs` — матриця з 11 підписаних колбеків з очікуваним кодом на
    кожен; секрет — лише зі змінної середовища, не друкується;
  - `scripts/mock-n8n.mjs` — копія `tools/mock-n8n.mjs` (`cmp` — ідентична).
- Перша знахідка з розділу 0, відтворена на поточному коді: мок `node tools/mock-n8n.mjs` (`:5678`,
  без `--listen`), застосунок — `next start` з `N8N_WEBHOOK_URL` рівно як у `.env.example`
  (`http://127.0.0.1:5678/webhook-test/lead-created`), заявка з публічної форми `/` (синтетичні дані
  `*.example.test`). Форма відповіла `HTTP 200` і «Дякуємо!», а мок записав:
  `POST /webhook-test/lead-created -> 404 in 15 ms  | headers: accept,accept-language,content-type,user-agent | body 1058 B`
  — тестовий URL без `--listen`, воркфлоу не запускався; немає `x-n8n-token`, `idempotency-key`,
  `x-correlation-id`; 1058 Б — увесь рядок ліда (IP, user agent, сирий payload). Код не дивиться на
  статус відповіді й чекає на n8n у самій дії, тому користувач бачить «успіх». Це C1, C3, C5, C6,
  C11 і C13 нижче; виправляється в Task D.
- SHA коміту зі скілом (BASE для Task D): `c9b2f02` — у ньому виправлення Task A, скіли
  `building-client-form` і `integrating-n8n-webhooks`; `/quotes` і переробленого виклику n8n ще
  немає. Наступні коміти змінюють лише `docs/`, яких у копіях Task D немає.
- Що скіл змінив у собі під час Task D (докладно — `docs/ab-validation.md`):
  - `2aa71a0` — `check-contract.mjs` не бачив коду прогону A: виклик n8n у `lib/quotes.ts` через
    `fetch(webhookUrl, …)` і колбек у `app/api/quotes/[id]/callback` лежали поза `lib/n8n/` і
    `app/api/n8n/`, тож C4–C9 і C13 давали PASS «бо нічого немає» (11 PASS / 2 FAIL замість 6 / 7).
    Тепер — розпізнавання за змінною з URL, POST-роут зі згадкою n8n як колбек, хелпери з локальних
    модулів на один рівень;
  - `816b79f` — `send-signed-callback.mjs` після 11/11 падав на Windows з `Assertion failed … async.c`
    (код виходу 127): `process.exit()` при відкритих keep-alive-з'єднаннях → `process.exitCode`.

**Як перевіряли сам скрипт.** Спершу на `main` — там порушення є. Потім на навмисно поганому коді,
де кожна з 13 перевірок має що знайти. Далі на «обхідному» коді, який попередня версія скрипта
пропускала (див. нижче). Нарешті на шаблонах скіла, де очікуємо 0 FAIL, і з `--changed-since`.
`main` — з кореня репозиторію (`../leaddesk-main`, як у walkthrough); навмисно поганий код, шаблони й
git-копія для `--changed-since` — тестові теки `bad/`, `tpl-now/`, `cs2/` у тимчасовій теці сесії поза
репозиторієм, команда запускалась з неї. Виводи — версії `2aa71a0` (після прогону A скрипт навчився
бачити код n8n поза `lib/n8n/` і `app/api/n8n/`; див. нижче).

**`check-contract.mjs` на коді `main`** (`mkdir ../leaddesk-main && git archive main | tar -x -C ../leaddesk-main`, `main` = `01a7dd4`):

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ../leaddesk-main; echo "exit=$?"
check-contract · root=../leaddesk-main · whole project
C1   FAIL  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
         .env.example:6  N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
C3   FAIL  Виклики n8n і змінні N8N_* лише в lib/n8n/
         app/actions.ts:54  await fetch(process.env.N8N_WEBHOOK_URL!, {
C4   PASS  Модулі, що викликають n8n, починаються з import "server-only"  (немає модулів n8n)
C5   FAIL  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
         app/actions.ts:54  await fetch(process.env.N8N_WEBHOOK_URL!, {  ← немає signal: AbortSignal.timeout(…)
C6   FAIL  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
         app/actions.ts:54  заголовки не передаються: x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису  (колбек-роутів немає)
C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===  (колбек-роутів немає)
C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key  (колбек-роутів немає)
C10  PASS  Немає runtime = "edge"
C11  FAIL  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
         .env.example  немає N8N_WEBHOOK_BASE_URL
         .env.example  немає N8N_WEBHOOK_TOKEN
         .env.example  немає N8N_CALLBACK_SECRET
         .env.example  немає APP_BASE_URL
C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
C13  FAIL  Server Action не чекає на n8n: виклик лише в after()
         app/actions.ts:54  await fetch(process.env.N8N_WEBHOOK_URL!, {  ← виклик n8n поза after(): користувач чекає на n8n

7 PASS, 6 FAIL
exit=1
```

C7–C9 і C12 на `main` — PASS, бо колбек-роуту й модуля n8n ще немає (скрипт пише це в дужках).
Той самий результат (7 PASS, 6 FAIL) — і на поточному коді гілки: виклик n8n у `submitLead` і
`.env.example` за умовою виправляються в Task D.

**Навмисно поганий код** (`bad/`: колбек-роут з `request.json()`, підписом через `!==`,
`runtime = "edge"` і `console.log(body)`; `lib/n8n/client.ts` без `server-only`, таймауту й двох
заголовків, з токеном у журналі; Server Action, що чекає на n8n і сама робить `fetch` до n8n;
компонент з `NEXT_PUBLIC_N8N_WEBHOOK_URL`; `.env.example` з `/webhook-test`, «справжнім» на вигляд
токеном і `NEXT_PUBLIC_N8N_*`) — кожна з 13 перевірок дає FAIL; значення токена не надруковано:

```
$ node <repo>/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root bad; echo "exit=$?"
check-contract · root=bad · whole project
C1   FAIL  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
         .env.example:1  N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook-test
C2   FAIL  Змінні N8N_* з префіксом NEXT_PUBLIC_
         components/quote-button.tsx:2  export const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
         .env.example:3  NEXT_PUBLIC_N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request
C3   FAIL  Виклики n8n і змінні N8N_* лише в lib/n8n/
         app/quotes/actions.ts:6  await fetch(process.env.N8N_WEBHOOK_BASE_URL + "/quote-audit", { method: "POST", body: "{}" });
C4   FAIL  Модулі, що викликають n8n, починаються з import "server-only"
         lib/n8n/client.ts:1  перший рядок не import "server-only"
C5   FAIL  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
         app/quotes/actions.ts:6  await fetch(process.env.N8N_WEBHOOK_BASE_URL + "/quote-audit", { method: "POST", body: "{}" });  ← немає signal: AbortSignal.timeout(…)
         lib/n8n/client.ts:4  return fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/quote-request`, { method: "POST", headers: { "x-n8  ← немає signal: AbortSignal.timeout(…)
C6   FAIL  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
         app/quotes/actions.ts:6  заголовки не передаються: x-n8n-token, idempotency-key, x-correlation-id
         lib/n8n/client.ts:4  заголовки не передаються: idempotency-key, x-correlation-id
C7   FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
         app/api/n8n/[event]/route.ts:5  const body = await request.json();  ← .json() замість request.text()
         app/api/n8n/[event]/route.ts:1  немає request.text() — сире тіло не читається
C8   FAIL  Підпис: спершу довжини, потім timingSafeEqual; не ===
         app/api/n8n/[event]/route.ts:1  немає crypto.timingSafeEqual
         app/api/n8n/[event]/route.ts:8  if (signature !== expected) return new Response("bad signature", { status: 401 });  ← підпис через ===/==
C9   FAIL  Колбек перевіряє час (±300 с) і idempotency-key
         app/api/n8n/[event]/route.ts:1  немає: x-n8n-timestamp, порівняння з Date.now() у вікні 300 с, idempotency-key, звірка ключа з data.jobId
C10  FAIL  Немає runtime = "edge"
         app/api/n8n/[event]/route.ts:2  export const runtime = "edge";
C11  FAIL  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
         .env.example:1  N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook-test  ← локальна адреса, що закінчується на /webhook (http://127.0.0.1:5678/webhook)
         .env.example:2  N8N_WEBHOOK_TOKEN=<значення приховано>  ← секрет у прикладі — лише change-me-…
         .env.example  немає N8N_CALLBACK_SECRET
         .env.example  немає APP_BASE_URL
C12  FAIL  Журнали коду n8n без тіл, секретів і персональних даних
         lib/n8n/client.ts:3  console.info("sending to n8n with token", token);
         app/api/n8n/[event]/route.ts:9  console.log("callback", body);
C13  FAIL  Server Action не чекає на n8n: виклик лише в after()
         app/quotes/actions.ts:6  await fetch(process.env.N8N_WEBHOOK_BASE_URL + "/quote-audit", { method: "POST", body: "{}" });  ← виклик n8n поза after(): користувач чекає на n8n
         app/quotes/actions.ts:5  const res = await sendQuote(Object.fromEntries(formData));  ← виклик n8n поза after(): користувач чекає на n8n

0 PASS, 13 FAIL
exit=1
```

**Обхідний код.** Рев'ю попередньої версії скрипта (C1–C12) зібрало код, що порушує контракт, але
давав 12 PASS: `signal: controller.signal` без таймауту; назви заголовків лише в масиві, не в
запиті; хелпер `safeEqual` з `timingSafeEqual` без перевірки довжини вище за `POST`, а в `POST` —
`JSON.parse` до перевірки й `sig !== expected`; `const MAX_ITEMS = 300` без перевірки часу;
`console.log("n8n answered", await res.text())`; Server Action з `await trigger(…)` і
`console.log(formData.get("email"))`; `.env.example` з адресою n8n Cloud і `change-me<hex>`. Крім
того, `.env.example` з кінцями рядків CRLF (Windows, `core.autocrlf=true`) давав хибний FAIL у C11
(«немає N8N_WEBHOOK_BASE_URL», хоча ключ є), а FAIL у C11 друкував значення секрету. Поточна
версія: на обхідному коді — `5 PASS, 8 FAIL` (C5, C6, C7, C8, C9, C11, C12, C13 — саме ті
порушення), на шаблонах з `.env.example` у CRLF — `13 PASS, 0 FAIL`.

**Шаблони з `references/code-templates.md`** + `.env.example` з ключами контракту (у CRLF):

```
$ node <repo>/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root tpl-now; echo "exit=$?"
check-contract · root=tpl-now · whole project
C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
C3   PASS  Виклики n8n і змінні N8N_* лише в lib/n8n/
C4   PASS  Модулі, що викликають n8n, починаються з import "server-only"
C5   PASS  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
C6   PASS  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===
C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key
C10  PASS  Немає runtime = "edge"
C11  PASS  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
C13  PASS  Server Action не чекає на n8n: виклик лише в after()

13 PASS, 0 FAIL
exit=0
```

**`--changed-since`** — git-копія `main` з тегом `base`, після нього доданий `lib/n8n/client.ts` без
`server-only`, таймауту й заголовків і правильний `.env.example`: старі порушення `app/actions.ts`
(C3, C5, C6, C13) не показано, показано лише новий файл; неіснуючий ref — повідомлення й `exit=2`.

```
$ node <repo>/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root cs2 --changed-since base; echo "exit=$?"
check-contract · root=cs2 · changed since base (2 file(s))
C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
C3   PASS  Виклики n8n і змінні N8N_* лише в lib/n8n/
C4   FAIL  Модулі, що викликають n8n, починаються з import "server-only"
         lib/n8n/client.ts:1  перший рядок не import "server-only"
C5   FAIL  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
         lib/n8n/client.ts:2  return fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/quote-request`, { method: "POST", body: JSON.strin  ← немає signal: AbortSignal.timeout(…)
C6   FAIL  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
         lib/n8n/client.ts:2  заголовки не передаються: x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису  (колбек-роутів немає)
C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===  (колбек-роутів немає)
C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key  (колбек-роутів немає)
C10  PASS  Немає runtime = "edge"
C11  PASS  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
C13  PASS  Server Action не чекає на n8n: виклик лише в after()

10 PASS, 3 FAIL
exit=1
```

**`check-contract.mjs` на фінальному коді** — гілка після перенесення прогону B і доведення (`5679c83`),
увесь проєкт, без `--changed-since`:

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs; echo "exit=$?"
check-contract · root=. · whole project
C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
C3   PASS  Виклики n8n і змінні N8N_* лише в lib/n8n/
C4   PASS  Модулі, що викликають n8n, починаються з import "server-only"
C5   PASS  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
C6   PASS  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===
C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key
C10  PASS  Немає runtime = "edge"
C11  PASS  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
C13  PASS  Server Action не чекає на n8n: виклик лише в after()

13 PASS, 0 FAIL
exit=0
```

**Матриця колбеків** — `send-signed-callback.mjs` проти шаблону `app/api/n8n/[event]/route.ts` у
тимчасовій копії (`next start -p 3003`, `N8N_CALLBACK_SECRET` — щойно згенерований тестовий секрет
у змінній середовища, ніде не збережений і не надрукований):

```
$ node --env-file=<файл з тестовим секретом> .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3003/api/n8n/quote-request
callbacks → http://127.0.0.1:3003/api/n8n/quote-request · event quote-request.completed
ok    valid callback                       expected 202, got 202 {"ok":true}
ok    same callback again (duplicate)      expected 200, got 200 {"duplicate":true}
ok    unknown event in the path            expected 404, got 404
ok    "constructor" as the event           expected 404, got 404
ok    wrong content-type                   expected 415, got 415
ok    wrong signature                      expected 401, got 401
ok    timestamp 10 min old                 expected 401, got 401
ok    body reformatted after signing       expected 401, got 401
ok    new key for the same signed body     expected 400, got 400
ok    signed body of the wrong shape       expected 400, got 400
ok    body > 64 KB                         expected 413, got 413

all cases as expected
exit=0
```

У журналі сервера на кожен колбек — лише `n8n.in { event, correlationId, status, size, sha256 }`;
`grep -ciE "sha256=|documentUrl|jobId"` по журналу — `0` (ні підписів, ні тіла).
Випадок `"constructor" as the event` — регресія: з `HANDLERS[event]` на звичайному об'єкті такий
шлях знаходив `Object.prototype.constructor` замість 404; у шаблоні тепер `Object.hasOwn`.
