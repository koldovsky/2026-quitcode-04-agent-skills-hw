# Перевірка (Task A–C, бонус E3)

> Скопіюйте в `docs/verification.md` і заповніть. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code у десктопному застосунку Claude (вкладка Code; CLI `claude` не встановлено в PATH, тож номер версії звідси не видно) · Opus 5.5 (`claude-opus-5-5`)
- **ОС і термінал, Node:** macOS 26.2 (Darwin 25.2.0) · zsh · Node v24.15.0

## Скіли видно у свіжій сесії

- Як перевіряли: 2026-09-27, свіжа сесія на гілці `ws04/pavmys` (коміт `e737290`). Спитали «which skills are available here?», звірили відповідь із переліком skills у контексті сесії та з `ls .claude/skills/` і `ls ~/.claude/skills/`.

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project (`.claude/skills/vercel-react-best-practices/`) | Видно. Закріплено на `agent-skills-063bee9` (коміт `e737290`), `version: "1.0.0"`, author: vercel |
| `building-client-form` | — | Не видно: у `.claude/skills/` його ще немає (створюється в Task B) |
| `integrating-n8n-webhooks` | — | Не видно: у `.claude/skills/` його ще немає (створюється в Task C) |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки:
  - `find-skills` (Personal, `~/.claude/skills/find-skills/`): шукає і встановлює скіли. На перевірки
    Task A–D не впливає: він спрацьовує лише на запити на кшталт «find a skill for X». Встановлювати
    щось через нього можна лише після явного «так» людини (правило з `AGENTS.md`).
  - Вбудовані скіли Claude Code і застосунку, які не стосуються предмета перевірок: `code-review`,
    `security-review`, `simplify`, `run`, `init`, `update-config`, `fewer-permission-prompts`,
    `keybindings-help`, `loop`, `schedule`, `workflow-authoring`, `claude-api`, `artifact-*`, `dataviz`,
    `anthropic-skills:*` (docs, docx, pptx, xlsx, pdf, google-workspace, skill-creator, schedule,
    consolidate-memory, import-memory, explain-usage, morning, setup-claude). Можливий вплив: `code-review`
    і `simplify` частково перетинаються з `vercel-react-best-practices` на запитах «review/refactor React
    code», а `run` може перехопити запит «запусти застосунок». Під час Task B/D варто перевіряти, що
    спрацював саме проєктний скіл.

## Task A — виправлення за скілом Vercel

Щонайменше 2 виправлення (досить двох); для **одного** (на ваш вибір) — числа до/після, для решти
досить id правила й пояснення.

**Як міряли (для виправлення з числами):** продакшн-збірка (`npm run build && npm start`, Next.js
16.3.5, Turbopack) для кожного варіанта `app/dashboard/page.tsx`, свіжий процес. Скрипт на Node — підхід
із `node_modules/next/dist/docs/01-app/02-guides/streaming.md` («Verifying that streaming works»); curl
не годиться, бо буферизує. Скрипт робить `GET /dashboard` з `Accept-Encoding: identity`,
`Cookie: leaddesk_session=demo-u_olena` (демо-сесія із seed) і браузерним User-Agent, читає тіло потоком
і фіксує мілісекунду першого шматка та першої появи HTML кожної секції. 1 розігрівний + 10 вимірюваних
прогонів підряд, у таблицях — медіана [мін–макс]. Затримки БД — штучні `sleep` з `LATENCY_MS` у
`lib/db.ts`, тому числа відтворювані; localhost, без стиснення й мережі. «Було» — збірка `a062fc7`:
`app/dashboard/` і `components/` там збігаються з `main` (`git diff main` порожній), а `lib/data.ts`
відрізняється лише функцією `requireLeadAccess`, яку дашборд не викликає.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `server-auth-actions` | `a062fc7` | `app/actions.ts`, `lib/data.ts` | `updateLeadStatus` і `deleteLead` першим кроком викликають новий `requireLeadAccess(id)`: сесія → workspace користувача → лід належить цьому workspace, інакше `throw new Error("Forbidden")`; без дійсної сесії — `redirect("/login")` (з `getCurrentUser`). `status` звіряється з `LEAD_STATUSES` ще до першого `await`. | — | — | Без заміру: це безпекове виправлення, а не швидкодія, — числа, яке порада мала б змінити, немає. Замість заміру перевірили поведінку: 5 прямих HTTP-викликів дій на продакшн-збірці `main` і `a062fc7` (таблиця нижче). |
| `async-suspense-boundaries`, `server-parallel-fetching` (замість `async-parallel`) | `b19a732` | `app/dashboard/page.tsx` | Сторінка чекає лише user + workspace, потрібні для заголовка. Три запити винесено в окремі async-компоненти `Stats`, `Toolbar`, `Table`, кожен у своєму `<Suspense>` із заглушкою приблизно фінальної висоти. Запити йдуть паралельно, і кожна секція приходить потоком, щойно готова. | Уся сторінка одним шматком: перший байт і всі секції — 2233 мс | Перший байт і заголовок — 417 мс (−81%), таблиця — 630 мс (−72%), статистика й кінець відповіді — 1413 мс (−37%) | Медіана 10 прогонів, потокове читання `/dashboard` на продакшн-збірці (методика вище, усі варіанти — нижче) |
| `bundle-conditional` (exceljs), `bundle-dynamic-imports` (recharts), `bundle-preload` | `2a8ea9a` | `components/leads-toolbar.tsx` | `exceljs` більше не імпортується статично: `handleExport` робить `import("exceljs")` паралельно з `fetch("/api/leads")`. `SourcesChart` підключено через `next/dynamic(…, { ssr: false })` із заглушкою `h-64`. Наведення й фокус на кнопках запускають `import()` заздалегідь. | Перше відкриття `/dashboard`: 9 JS-файлів, 1717,9 КБ (487,3 КБ gzip). З них один шматок з exceljs + recharts — 1265,8 КБ (352,6 КБ gzip). | 8 файлів, 463,7 КБ (−73%), 139,1 КБ gzip (−71%). exceljs (909,1 КБ / 249,8 КБ gzip) і recharts (349,8 КБ / 100,1 КБ gzip) — окремі шматки, вантажаться лише після наведення чи кліку. | Сума JS, на який посилається HTML `/dashboard`, + звірка з Resource Timing у браузері (методика й усі числа — нижче) |

**Перевірка поведінки `server-auth-actions`.** Для кожного стану коду — `npm run build && npm start`
(Next.js 16.3.5, Turbopack), свіжий процес, тож сховище в пам'яті щоразу з seed: 172 ліди Studio Nova.
Стан `main` — `git checkout main -- app/actions.ts lib/data.ts`, після перевірки повернули
`git checkout HEAD -- …` і перезібрали. Один прогін на стан: результат детермінований, час не мірявся.
Дії викликали без UI, як це зробив би зловмисник:
`curl -X POST http://localhost:3000/dashboard/leads/lead_0001 -H "Next-Action: <id з .next/server/server-reference-manifest.json>" -H "Content-Type: text/plain;charset=UTF-8" -H "Origin: http://localhost:3000" -H "Cookie: leaddesk_session=<…>" --data '["lead_0001"]'`.
Стан після кожного кроку читали через `GET /api/leads` від імені власника Studio Nova. Cookie — демо-сесії
із seed (`lib/db.ts`: `demo-` + id користувача), секретів немає.

| # | Хто викликає | Виклик | `main` | `a062fc7` |
|---|---|---|---|---|
| 1 | менеджер Brightline (`demo-u_marta`) | `updateLeadStatus("lead_0001", "won")` — лід Studio Nova | HTTP 200, статус змінено | HTTP 500 `Forbidden`, без змін |
| 2 | власник Studio Nova (`demo-u_olena`) | `updateLeadStatus("lead_0001", "hacked")` | HTTP 200, у БД записано `hacked` | HTTP 500 `Invalid status`, без змін |
| 3 | будь-яка cookie (`leaddesk_session=x`) | `deleteLead("lead_0001")` | HTTP 200, лід видалено (172 → 171) | HTTP 200 + `x-action-redirect: /login`, лід на місці |
| 4 | менеджер Brightline | `deleteLead("lead_0002")` — лід Studio Nova | HTTP 200, лід видалено (171 → 170) | HTTP 500 `Forbidden`, лід на місці |
| 5 | власник Studio Nova | `updateLeadStatus("lead_0002", "won")` — законний виклик | HTTP 200 (лід уже видалено кроком 4) | HTTP 200, статус `won` |

Крок 3 показує, чому `proxy.ts` не захищає: він перевіряє лише наявність cookie, тож довільне значення
проходить до дії. Причини HTTP 500 звірили з журналом `next start`: `Error: Forbidden` (кроки 1, 4) і
`Error: Invalid status` (крок 2).

**Замір `/dashboard` (`async-suspense-boundaries`).** Мілісекунди від початку запиту, медіана 10
прогонів [мін–макс]:

| Варіант коду | Перший байт | Заголовок («Вітаємо,») | Таблиця (`<table`) | Панель («Показати графік джерел») | Статистика («Усього лідів») | Уся відповідь | Шматків |
|---|---|---|---|---|---|---|---|
| `main`: послідовні `await` | 2233 [2229–2236] | 2233 | 2233 | 2233 | 2233 | 2234 | 7 |
| A: лише `Promise.all` (`async-parallel`) — проміжний, не закомічено | 1426 [1422–1432] | 1426 | 1426 | 1426 | 1426 | 1427 | 7 |
| **B: композиція + `<Suspense>` — фінал** | **417** [411–421] | 417 | 630 [624–635] | 630 | 1413 [1408–1416] | 1414 | 11 |
| B + тимчасовий `React.cache` — діагностика, відкочено | 215 [210–218] | 215 | 631 [622–640] | 631 | 1415 [1410–1418] | 1416 | 11 |

Числа збігаються з розрахунком за `LATENCY_MS` (`lib/db.ts:25`), накладні витрати ~15–35 мс: `main` —
100 + 100 + 400 + 1200 + 400 = 2200; A — 200 + max(400, 1200, 400) = 1400; B — таблиця й панель
200 + 400 = 600, статистика 200 + 1200 = 1400.

**Замір JS `/dashboard` (`bundle-conditional`, `bundle-dynamic-imports`).** Продакшн-збірка
(`npm run build && npm start`) до правки (`b19a732`) і після (`2a8ea9a`). Час тут не мірявся: на
localhost мережа не вузьке місце, а пряма метрика цієї поради — байти, які браузер мусить завантажити
й розібрати. Два способи:

1. Node-скрипт робить `GET /dashboard` (`Cookie: leaddesk_session=demo-u_olena`) і збирає всі
   `/_next/static/chunks/*.js`, на які посилається HTML: `<script src>`, `<link rel="preload">` і шляхи в
   RSC-даних. `noModule`-поліфіл (`0cz1d0mv5g_q7.js`) пропускає, бо сучасний браузер його не вантажить.
   Скрипт завантажує кожен файл, рахує сирі байти й gzip (`zlib`, рівень за замовчуванням) і позначає
   шматки з рядками `xl/workbook.xml` (exceljs) та `recharts-wrapper` (recharts). Результат
   детермінований, один прогін на стан.
2. Звірка у вбудованому браузері: `performance.getEntriesByType("resource")` для `.js`, `decodedBodySize`
   (розпаковано) і `encodedBodySize` (по мережі, gzip від `next start`). Сюди додатково потрапляє
   `1984p6wthq08z.js` (12,7 КБ): це передзавантаження маршруту `/` через `<Link>` у layout, однакове до й
   після.

| Стан | JS-файлів | Розпаковано | gzip | Де exceljs | Де recharts |
|---|---|---|---|---|---|
| До (`b19a732`), скрипт | 9 | 1717,9 КБ | 487,3 КБ | `0m6anbet4hr_s.js` — 1265,8 КБ (352,6 КБ gzip), разом із recharts, вантажиться одразу | той самий шматок |
| Після, скрипт | 8 | **463,7 КБ** (−73%) | **139,1 КБ** (−71%) | `1dlbn3ojb2_sj.js` — 909,1 КБ (249,8 КБ gzip), не в HTML | `3ozix-xy0slyn.js` — 349,8 КБ (100,1 КБ gzip), не в HTML |

| Момент (браузер, Resource Timing) | JS-файлів | Розпаковано | По мережі |
|---|---|---|---|
| До: перше відкриття `/dashboard` | 10 | 1730,6 КБ | 492,4 КБ |
| Після: перше відкриття `/dashboard` | 9 | 476,5 КБ | 143,9 КБ |
| Після: + клік «Показати графік джерел» (довантажився `3ozix-xy0slyn.js`) | 11 | 826,4 КБ | 244,3 КБ |
| Після: + клік «Експорт в Excel» (довантажився `1dlbn3ojb2_sj.js`) | 12 | 1735,5 КБ | 493,9 КБ |

- Чому обрали для заміру саме це виправлення: №2 за критичністю в рев'ю і єдине з трійки, де порада
  обіцяє конкретні мілісекунди. `/dashboard` — головна сторінка порталу, а затримки БД у `lib/db.ts`
  детерміновані, тож до/після порівнюються без шуму: розкид у межах 20 мс.
- Друге (і кожне наступне) виправлення — що і чому змінили, як переконались, що не зламали:
  `server-auth-actions` (`a062fc7`) — №1 за критичністю в рев'ю: Server Actions — публічні POST-ендпоінти,
  а id лідів послідовні (`lead_0001`…`lead_0200`), тож на `main` будь-хто з будь-якою cookie міг змінити
  або видалити ліди іншого клієнта (кроки 1, 3, 4 вище). Що не зламали: `npm run lint` і `npm run build`
  зелені; законна зміна статусу власником через той самий протокол, яким користується `LeadActions`,
  працює (крок 5). Вручну в браузері кнопки не клікали.
  Бандл дашборда (`bundle-conditional` / `bundle-dynamic-imports`) — №3 у рев'ю: ~1,3 МБ бібліотек
  вантажились на кожному відкритті `/dashboard`, хоча потрібні лише після двох кліків. Що не зламали
  (вбудований браузер, продакшн-збірка): «Показати графік джерел» малює графік (`.recharts-wrapper`,
  6 стовпців). «Експорт в Excel» генерує `leads-2026-09-27.xlsx` на 18 703 байти з MIME
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`: `URL.createObjectURL` і `a.click()`
  на час перевірки перехопили в сторінці, тож файл не зберігався. Наведення на «Експорт в Excel» без
  кліку запускає завантаження `1dlbn3ojb2_sj.js` (`bundle-preload` працює). Єдина помилка в консолі
  вкладки, `ERR_CONNECTION_REFUSED` на `/login?_rsc`, — передзавантаження, що припало на перезапуск
  сервера між збірками. Усі запити самої перевірки мають статус 200.
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували або змінили — і чому:
  - Приклад у скілі кидає `unauthorized(...)` зі свого `@/lib/errors`. Вбудовані `unauthorized()` /
    `forbidden()` з `next/navigation` у Next.js 16 працюють лише з експериментальним прапорцем
    `authInterrupts` (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`), а в
    `next.config.ts` його немає. Тому для чужого ліда — звичайний `throw new Error("Forbidden")`, а для
    відсутньої сесії — наявний `redirect("/login")` з `getCurrentUser`.
  - Перевірку ролі з прикладу скіла (`role !== 'admin'`) не додали: у seed у Brightline є лише менеджер,
    тож «видаляти може тільки owner» зробило б видалення там неможливим. Це продуктове рішення. Від IDOR,
    про який пише `02-guides/data-security.md`, захищає перевірка workspace.
  - `async-parallel` (`Promise.all`) застосували не буквально. Проміжний замір A показав: `Promise.all`
    прибирає водоспад (2233 → 1426 мс), але сторінка все одно приходить одним шматком, бо чекає
    найповільніший `getLeadStats` (1200 мс). Тому у фіналі замість `Promise.all` — композиція
    (`server-parallel-fetching`): кожна секція сама бере свої дані, а паралельність дає одночасний рендер
    сусідніх async-компонентів.
  - `loading.tsx` не додали. Документація Next.js 16 (`02-guides/streaming.md`, «When to use `loading.js`
    vs `<Suspense>`») радить `<Suspense>` біля даних, а `loading.tsx` показав би скелет усієї сторінки
    замість заголовка й таблиці. Заголовок лишили поза `<Suspense>`, як радить розділ «Streaming and Web
    Vitals» (LCP).
  - `bundle-conditional` у скілі вантажить модуль через `useEffect` і state. Нам це не потрібно:
    exceljs потрібен лише всередині обробника кліку, тому `import("exceljs")` стоїть прямо в
    `handleExport`, як у прикладі з `fuse.js` у `01-app/02-guides/lazy-loading.md`.
  - Для `next/dynamic` дотримались двох вимог документації Next.js 16 (`02-guides/lazy-loading.md`):
    `import("./sources-chart")` записано буквально всередині `dynamic()`, а не через змінну, а
    `ssr: false` стоїть у Client Component (файл має `"use client"`; у Server Component це помилка).
  - Перевірку `typeof window !== 'undefined'` із прикладів `bundle-preload` / `bundle-conditional` не
    додали. `preloadExcel` і `preloadChart` викликаються лише з обробників подій, тобто тільки в
    браузері, а ця перевірка впливає лише на серверний бандл, який тут не мірявся.
- Якщо виміряне виправлення не змінило чисел — чому: змінило, але два числа не такі, як обіцяла порада, і
  це висновок рев'ю, а не збій заміру:
  - **Перший байт — 417 мс, а не ~200 мс**, як я прогнозував у рев'ю. Причина не в Suspense, а у
    водоспаді вище за деревом. `DashboardHeader` усередині `app/dashboard/layout.tsx` — async-компонент:
    він запускає свої `getCurrentUser` + `getWorkspace` (200 мс) лише після того, як layout дочекався тих
    самих запитів (ще 200 мс). `React.cache` їх не дедуплікує: `getCurrentUser` не обгорнуто, а
    `getWorkspace` щоразу отримує новий об'єкт `{ slug }`, тож `Object.is` дає промах. Діагностика: з
    тимчасовим `React.cache` перший байт — 215 мс, решта чисел та сама. Це окреме виправлення
    (`server-cache-react`, `lib/data.ts:7` і `:18`), і в цей коміт воно не входить.
  - **Кінець відповіді: 1426 (A) → 1414 мс (B), майже без змін.** Так і має бути: Suspense не пришвидшує
    `getLeadStats` (1200 мс), а лише перестає блокувати ним решту сторінки. Виграш B — таблицю й заголовок
    видно раніше, а не в загальному часі.
  - **Бандл: якщо користувач натиснув обидві кнопки, JS загалом стільки ж, скільки до правки** —
    1735,5 КБ проти 1730,6 КБ розпакованого, 493,9 проти 492,4 КБ по мережі. Так і має бути: код exceljs
    і recharts нікуди не зник, а завантажується пізніше. Виграш — у першому відкритті (−73% JS) і для
    тих, хто не експортує й не відкриває графік. Ціна — одноразове довантаження 250 / 100 КБ gzip у
    момент першого кліку, яке `bundle-preload` запускає вже при наведенні.
- `npm run lint`, `npm run build` після виправлень: на `a062fc7` `npm run lint` — код виходу 0, без
  попереджень; `npm run build` — код виходу 0, «Compiled successfully», TypeScript без помилок, маршрути
  `/`, `/_not-found`, `/api/leads`, `/dashboard`, `/dashboard/leads/[id]`, `/login` + Proxy. Запускали
  двічі: одразу після виправлення і після повернення коду з перевірки на `main`.
  Для `async-suspense-boundaries` (`b19a732`) `npm run lint` — код виходу 0, без
  попереджень; `npm run build` — код виходу 0, «Compiled successfully», TypeScript без помилок, ті самі
  маршрути. Запускали двічі: після правки і після відкату діагностичного `React.cache`. У вбудованому
  браузері на продакшн-збірці `/dashboard` під Olena показує всі секції (картки з 172 лідами, панель,
  пошук, таблиця), помилок у консолі немає. CLS не міряли: заглушки мають фіксовану висоту (картки
  86 px, панель 34 px), а заглушка таблиці — `h-96`, нижча за саму таблицю.
  Для бандла дашборда (`2a8ea9a`) `npm run lint` — код виходу 0, без попереджень;
  `npm run build` — код виходу 0, «Compiled successfully», TypeScript без помилок, ті самі маршрути.

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо): 2026-09-27, нова сесія Claude Code (десктоп, Opus 5.5) на
  гілці `ws04/pavmys`, HEAD `6ba57e7` (скіл додано в `c95048a`). Перше повідомлення сесії:
  > On the lead page in the dashboard (/dashboard/leads/[id]), add an “Add Note” form: one text field with a maximum of 500 characters; the note is appended to the lead's internal notes.
- Чи спрацював скіл і як це видно: так, з першого разу. Першою дією сесії, ще до читання будь-якого
  файлу, агент викликав інструмент `Skill` з `skill: "building-client-form"`. Відповідь — «Launching
  skill: building-client-form» і повний текст `SKILL.md` з `.claude/skills/building-client-form/`. Далі
  агент зробив те, що скіл вимагає перед кодом: прочитав `01-app/02-guides/forms.md`,
  `01-app/03-api-reference/04-functions/after.md` і правила `server-auth-actions`,
  `server-serialization`, `server-after-nonblocking`. Сліди скіла в коді: три файли за схемою
  `lib/<name>-form.ts` / `actions.ts` / `components/<name>-form.tsx`; назви `parseLeadNoteForm`,
  `submitLeadNote`, `LeadNoteState`; `requireLeadAccess` першим рядком дії; журнал
  `console.error("lead.note_failed", { leadId, error: … error.name … })` дослівно з кроку 5; `logAudit`
  у `after()` з власним `try/catch`; кнопка «Надсилаємо…»; зведення помилок у `role="alert"`.
- Якщо не з першого разу — що змінили в `description`, і результат другої спроби: не знадобилось,
  `description` не змінювали.
- Що зроблено (файли):
  - Коміт `cb26cc3` (`feat(lead-note): add note form to the lead page`):
    - `lib/lead-note-form.ts` — `parseLeadNoteForm`: пробіли обрізає, порожня → «Напишіть текст
      нотатки», понад 500 → «Скоротіть нотатку до 500 символів (зараз N)». Перед підрахунком CRLF → LF.
    - `app/actions.ts` — `submitLeadNote(leadId, prevState, formData)` і тип `LeadNoteState`.
    - `lib/db.ts` — `appendLeadNote`: дописує нотатку через порожній рядок, оновлює `updatedAt`.
    - `components/lead-note-form.tsx` — форма з `useActionState`.
    - `app/dashboard/leads/[id]/page.tsx` — секція «Внутрішні нотатки» тепер видна завжди (порожня —
      «Нотаток ще немає.»), зберігає переноси рядків, містить форму; `submitLeadNote.bind(null, lead.id)`
      стоїть тут, а не в Client Component (чому — нижче).
  - Коміт `fix(proxy): …` (разом із цим файлом) — `proxy.ts`. Без нього не проходив пункт Verify про дію
    без сесії (пункт 5 нижче).
- Пункти Verify зі скіла — результат кожного. Перевіряли на продакшн-збірці (`npm run build` +
  `npm start -p 3100`, Next.js 16.3.5) у копії репозиторію в тимчасовій теці. У самій теці проєкту інша
  сесія тримала `npm run start` на порту 3000 з тим самим `.next`, і збірка перезаписала б їй файли.
  Вхід — демо-сесії із seed (`demo-u_olena`, `demo-u_marta`), секретів немає. Браузер — вбудований у
  застосунок Claude.

| # | Пункт Verify | Як перевіряли | Результат |
|---|---|---|---|
| 1 | `npm run lint` і `npm run build` без помилок | У проєкті (lint) і в копії (build) | lint — код виходу 0, без попереджень. Перша збірка впала: `TS2339: Property 'values' does not exist on type '{ ok: true; data: LeadNoteFormData; }'` — у гілці успіху парсера немає `values`, виправили. Далі build — код виходу 0, «Compiled successfully», TypeScript без помилок, маршрути `/`, `/_not-found`, `/api/leads`, `/dashboard`, `/dashboard/leads/[id]`, `/login` + Proxy. Після правки `proxy.ts` — обидві команди знову з кодом 0. |
| 2 | Порожня відправка: текст помилки, зведення в `role="alert"`, `aria-invalid="true"`, `aria-describedby` → `id` тексту помилки | Браузер з JS; атрибути читали запитом до DOM замість DevTools → Elements | `role="alert"`: «Перевірте поле: Нова нотатка» з посиланням на `#lead-note`. Під полем — «Напишіть текст нотатки». `aria-invalid="true"`, `aria-describedby="lead-note-error lead-note-hint"` (текст помилки й підказка «До 500 символів…»). |
| 3 | Відправка з однією помилкою: решта введеного лишається, select і checkbox теж | 501 символ; з поля прибрали `maxlength`, як у прямому POST | «Скоротіть нотатку до 500 символів (зараз 501)», у полі лишились усі 501 символи, нотатки ліда не змінились. Select і checkbox у формі немає — ця частина не застосовна. |
| 4 | Без JS: порожня, з помилкою й успішна відправки поводяться так само, з перезавантаженням | Вимкнути JS у вбудованому браузері не можна, тож скрипт повторює браузер без JS: `GET` сторінки, приховані поля `$ACTION_*` форми з SSR-HTML, `POST multipart/form-data`, розбір HTML-відповіді | Спершу — зависання (див. нижче). Після виправлення: порожня — HTTP 200 за 636 мс, зведення й помилка, `aria-invalid="true"`; 501 символ — 200 за 625 мс, помилка, текст лишився; рівно 500 символів із переносом рядка (у multipart — CRLF) — прийнято; звичайна нотатка — 200 за 713 мс, «Нотатку додано.», нотатку дописано. |
| 5 | Дія без сесії: «Вийти» в іншій вкладці, відправка в першій → `/login`, дані без змін | Дві вкладки браузера з JS; без JS — той самий скрипт без cookie | Спершу **не пройшов**: дані не змінились, але замість `/login` — «This page couldn't load» (див. нижче). Після `fix(proxy)`: форма нотатки й список статусу з JS → `/login`, нових помилок у консолі й журналі сервера немає; без JS → `303 /login` → сторінка входу (200). Після повторного входу: статус «Новий», «Нотаток ще немає.» — нічого не записалось. |
| 6 | Журнал сервера після невдалої й успішної відправки: без імен, email, телефонів, тексту, IP | Журнал `next start` + пошук надісланих текстів | Лише лічильники `db:<запит>: N` (`db:appendLeadNote`, а після відповіді `db:insertAuditEntry` — `after()` спрацював) і `⨯ Error: Forbidden` від спроб із чужого workspace. Пошук текстів нотаток («No-JS», «should not») — 0 збігів. |
| 7 | Network: відповідь `POST` містить лише `status` (+ `errors`/`values`/`id`), без полів із `db` | Браузер. Тіло успішної відповіді інструмент мережі не віддав (`ERR_ABORTED`), тож його зняли тимчасовою обгорткою `window.fetch` у сторінці | Помилка: `{"status":"invalid","errors":{"note":"Напишіть текст нотатки"},"values":{"note":""}}`. Успіх: результат дії `{"status":"ok"}`. Решта тіла (10 642 байти) — перерендер сторінки через `revalidatePath`: єдиний email у ньому — з картки ліда, яку сторінка й так показує; `ipAddress`, `rawPayload` і IP із seed — 0 збігів. n8n дія не викликає, тож мок не запускали. |

- Доступ (пункт 2 чекліста, прямі POST без JS): менеджер Brightline (`demo-u_marta`) на `lead_0001` —
  HTTP 500 `Forbidden`, нічого не записано. Сесія Olena, але у прихованому полі id ліда замінено на
  `lead_0007` (Brightline) — HTTP 500 `Forbidden`, нотатки `lead_0007` без змін. Cookie
  `leaddesk_session=x` — `303 /login`.
- Порада скіла, яка не спрацювала як написано, і що знайшлось під час Verify:
  - **`.bind` у Client Component ламає форму без JS.** Приклад із кроку 2 скіла
    (`useActionState(submitX.bind(null, leadId), …)` у `"use client"`) дав зависання: POST без JS не
    отримував навіть заголовків (curl — `HTTP 000` після тайм-аутів 5 і 8 с, Node `fetch` —
    `TimeoutError` після 8 с), а `next-server` тримав 56–65% CPU. Відтворилось 3 рази. У журналі після
    POST видно запити і дії (`requireLeadAccess`), і перерендеру сторінки, але відповідь так і не пішла.
    Причину всередині React/Next не шукали. Варіант із `submitLeadNote.bind(null, lead.id)` у Server
    Component і пропом `action` дав ті самі приховані поля (`$ACTION_1:1` =
    `["lead_0001",{"status":"idle"}]`) і HTTP 200 за 0,63 с. Так і закомічено, з коментарем у
    `components/lead-note-form.tsx`. Сам скіл ще не виправлено.
  - **Пункт 5 не проходив через `proxy.ts`, а не через форму.** Без cookie proxy відповідав на POST дії
    `307 → /login`, і браузер повторював POST уже на `/login`, де цієї дії немає. Без JS — HTTP 500 і в
    журналі `Failed to find Server Action "70f7…"`; з JS — «This page couldn't load» і в консолі
    `Uncaught Error: An unexpected response was received from the server.`. Так само поводився наявний
    список статусу (`LeadActions`), тож проблема старша за форму. Виправлення: proxy пропускає запити,
    крім `GET` і `HEAD`, а сесію перевіряє сама дія (`requireLeadAccess` → `redirect("/login")`: з JS —
    навігація, без JS — 303, за `01-app/03-api-reference/04-functions/redirect.md`). `GET`, `HEAD` і
    RSC-навігація без cookie й далі отримують `307 → /login`; `POST /dashboard` без дії — теж `307`, без
    даних дашборда.
  - Чого скіл не каже, але знадобилось: `maxLength` рахує перенос рядка як 1 символ, а браузер без JS
    надсилає CRLF (2). Без заміни `\r\n → \n` у `parseLeadNoteForm` нотатку рівно на 500 символів із
    переносами сервер би відхилив.

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому): <…>
- Правила зупинки — перелік: <…>
- SHA коміту зі скілом (BASE для Task D): <…>
- Що скіл змінив у собі після прогонів (коміти й чому): <… або «нічого»>

**`check-contract.mjs` на коді `main`** (id + PASS/FAIL, код виходу):

```
<вивід>
```

**За бажанням: що скрипт побачив на навмисно поганому коді** (яку перевірку ламали, що вона
сказала). До рубрики це не входить, але бали знімає скрипт, який завжди PASS:

```
<вивід>
```

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
<вивід>
```

**Додатково (за бажанням):** матриця колбеків (`send-signed-callback.mjs`): випадок → очікуваний код → отриманий код.

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
