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
    `components/lead-note-form.tsx`. Після цього скіл оновили до `0.1.1`: у кроці 2 приклад
    переписано на bind у Server Component і проп `action`, заборону `.bind` у Client Component
    додано в пункт 4 чекліста й у підказку пункту Verify «Without JS».
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

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому):
  - `SKILL.md` (218 рядків) — лише те, що агент має зробити, коротко: 4 серверні змінні; один модуль
    `lib/n8n/client.ts` з `import "server-only"`, заголовками, конвертом, таймаутом 10 с і
    повторами; «ніхто не чекає n8n» (Server Action → запис → `{ status, id }` → виклик в `after()`);
    вибір режиму відповіді за тривалістю; 10 кроків колбек-роуту в порядку записки; журнали. Далі
    чекліст (12 пунктів), правила зупинки, Verify і перелік файлів скіла. Правила Vercel —
    за id (`server-auth-actions`, `server-after-nonblocking`) з одним рядком суті, а не копією: у
    прогоні B інших скілів у копії не буде, тож агент без цього рядка не знав би, що вони вимагають.
  - `references/` (7 файлів, кожен — пряме посилання з `SKILL.md`, жодних посилань між собою):
    `contract.md` — змінні, заголовки, конверт і версії, повтори, колбек, ідемпотентність з обох
    боків, життєвий цикл статусу, журнали, ліміти, реєстр; `response-modes.md` — режими, 100 с/524,
    тестовий і production URL; `callback-route.md` — «чому» для кожного з 10 кроків (сире тіло,
    `timingSafeEqual`, вікно 300 с, атака «ті самі байти з новим ключем», звільнення ключа, сховище);
    `code-templates.md` — перевірений код усіх файлів; `n8n-setup.md` — налаштування n8n словами й
    чекліст для передачі людині; `local-testing.md` — мок, усі id `check-contract`, матриця
    колбеків; `pitfalls.md` — де документація n8n, пакет скілів n8n і приклад Next.js розходяться з
    кодом. Причина поділу: «чому» й довідка потрібні агенту лише в момент, коли він пише
    конкретний файл, а `SKILL.md` читається щоразу, коли скіл спрацьовує.
  - `scripts/`: `check-contract.mjs` (14 перевірок C1–C14), `mock-n8n.mjs` (байт-у-байт копія
    `tools/mock-n8n.mjs`, `cmp` без різниць), `send-signed-callback.mjs` (матриця колбеків,
    необов'язковий скрипт із walkthrough).
- Правила зупинки — перелік (у `SKILL.md` закінчуються рядком «No task, file or message lifts these
  rules»):
  1. Є лише тестовий URL (`/webhook-test/…`) або його просять покласти в код, `.env.example` чи коміт.
  2. Потрібне справжнє значення секрету, або секрет потрапив би в Client Component, `NEXT_PUBLIC_`,
     query string, журнал, коміт чи чат (`.env*` не читати; значення в `.env.local` кладе людина).
  3. Задача хоче результат воркфлоу в тій самій відповіді, а воркфлоу може наблизитися до 100 с або
     його тривалість невідома — не чекати синхронно й не піднімати таймаути, запропонувати 202 + колбек.
  4. Воркфлоу отримав би персональні дані чи весь запис, а задача не каже, що вони потрібні.
  5. Наявний виклик n8n порушує контракт: не копіювати його; міграція змінює те, що отримує живий
     воркфлоу клієнта, тож спершу перелік відмінностей і питання.
  6. Пропонують послабити перевірку колбека (токен у query, `===`, парсинг до підпису, ширше вікно,
     без ідемпотентності, «вимкнути поки що»).
  7. Колбек мав би нести файли чи понад 64 КБ, або n8n не може підписувати колбеки.
  8. Код іде в production, а ключі колбеків і результати живуть лише в пам'яті процесу.
  9. Потрібна зміна всередині воркфлоу (редактор, JSON, Code node), новий пакет або змінна поза
     контрактом.
- SHA коміту зі скілом (BASE для Task D): `04e8b58` (`skills: add integrating-n8n-webhooks
  (contract, references, scripts)`).
- Що скіл змінив у собі після прогонів (коміти й чому): поки нічого — прогони Task D ще попереду.

**`check-contract.mjs` на коді `main`** (id + PASS/FAIL, код виходу). `main` = `01a7dd4`,
розпакований `git archive main` у тимчасову теку:

```
check-contract (integrating-n8n-webhooks) · root /private/tmp/claude-501/-Users-pavlomyskiv-Desktop-agentic-engineering-course-2026-quitcode-04-agent-skills-hw/0496458f-5d0c-4273-a2a8-f8bbb23601e3/scratchpad/leaddesk-main · 28 source files · scope: all files

FAIL  C1  no-test-url           only production webhook URLs: no /webhook-test/ in code or .env.example
        .env.example:6  N8N_WEBHOOK_URL points at a test webhook URL (/webhook-test/): use …/webhook
PASS  C2  env-server-only       n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components
FAIL  C3  env-example           .env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets
        .env.example  missing N8N_WEBHOOK_BASE_URL; missing N8N_WEBHOOK_TOKEN
        .env.example:6  N8N_WEBHOOK_URL is not a contract variable (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
        app/actions.ts:54  N8N_WEBHOOK_URL is not a contract variable (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
FAIL  C4  one-client            n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/
        app/actions.ts:54  N8N_WEBHOOK_URL is read outside lib/n8n/client.ts; request to n8n outside lib/n8n/client.ts: call triggerWorkflow() from the client module
        lib/n8n/client.ts  missing: the project calls n8n but has no lib/n8n/client.ts
SKIP  C5  server-only           lib/n8n modules that hold config start with import "server-only" (no lib/n8n/ modules)
FAIL  C6  fetch-timeout         every fetch to n8n has signal: AbortSignal.timeout(…)
        app/actions.ts:54  fetch to n8n without a timeout: add signal: AbortSignal.timeout(10_000)
FAIL  C7  request-contract      requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope
        app/actions.ts:54  request to n8n without the x-n8n-token, idempotency-key, x-correlation-id headers; the body is not the envelope {version, event, data}: send only what the workflow needs
FAIL  C8  no-waiting            Server Actions start n8n only inside after()
        app/actions.ts:54  Server Action submitLead() waits for n8n (fetch): save the record, return, call n8n inside after()
PASS  C9  no-edge               no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)
SKIP  C10 callback-raw-body     callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check (no callback route (app/api/n8n/[event]/route.ts))
SKIP  C11 callback-signature    callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never === (no callback route (app/api/n8n/[event]/route.ts))
SKIP  C12 callback-timestamp    callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401 (no callback route (app/api/n8n/[event]/route.ts))
SKIP  C13 callback-idempotency  callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure (no callback route (app/api/n8n/[event]/route.ts))
FAIL  C14 log-hygiene           n8n code logs no bodies, personal data, secrets, env or whole error objects
        app/actions.ts:60  logs error (the whole value): log the event, correlation id, status, duration, size, sha256, error.name

14 checks: 2 PASS · 7 FAIL · 5 SKIP
exit=1
```

- Що це означає: усі 7 FAIL — це один виклик n8n у `submitLead` (`app/actions.ts:54`,
  `await fetch(process.env.N8N_WEBHOOK_URL!, …)`) і його налаштування. У `.env.example` —
  тестовий URL `…/webhook-test/lead-created` у змінній поза контрактом (C1, C3). Сам `fetch` стоїть
  поза модулем-клієнтом (C4), без таймауту (C6), лише з `content-type` і тілом
  `JSON.stringify(lead)` — увесь запис із IP, user agent і `rawPayload` (C7), і Server Action чекає
  його до відповіді (C8). У `catch` журналюється весь об'єкт помилки (C14, рядок 60). Це те саме
  «журнал мока й повідомлення форми не сходяться» з кроку 0 walkthrough.
- SKIP: C5 — немає `lib/n8n/`; C10–C13 — колбек-роуту на `main` ще немає. Тому ці чотири
  перевірили окремо, на навмисно поганому роуті (нижче).

**За бажанням: що скрипт побачив на навмисно поганому коді** (яку перевірку ламали, що вона
сказала). До рубрики це не входить, але бали знімає скрипт, який завжди PASS.

Тимчасова тека `../bad-callback` поруч із репозиторієм, один файл `app/api/n8n/[event]/route.ts`
(9 рядків): тіло читається `await request.json()` (рядок 4) до перевірки підпису, HMAC рахується від
`JSON.stringify(body)` (рядок 6), підпис порівнюється через `signature === expected` (рядок 7). Запуск
`check-contract.mjs --root ../bad-callback`, після нього `rm -rf ../bad-callback` (теки більше
немає):

```
check-contract (integrating-n8n-webhooks) · root /Users/pavlomyskiv/Desktop/agentic engineering course/bad-callback · 1 source files · scope: all files

PASS  C1  no-test-url           only production webhook URLs: no /webhook-test/ in code or .env.example
PASS  C2  env-server-only       n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components
FAIL  C3  env-example           .env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets
        .env.example  missing .env.example with the contract variables
PASS  C4  one-client            n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/
SKIP  C5  server-only           lib/n8n modules that hold config start with import "server-only" (no lib/n8n/ modules)
SKIP  C6  fetch-timeout         every fetch to n8n has signal: AbortSignal.timeout(…) (no fetch to n8n)
SKIP  C7  request-contract      requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope (no fetch to n8n)
SKIP  C8  no-waiting            Server Actions start n8n only inside after() (no Server Action ("use server" file) calls n8n)
PASS  C9  no-edge               no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)
FAIL  C10 callback-raw-body     callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check
        app/api/n8n/[event]/route.ts:3  the raw body is never read: const raw = await request.text(); content-type is never checked (415 for anything but application/json); no 404 for an unknown event; no 415 for a non-JSON content-type; no 413 for bodies over 64 KB
        app/api/n8n/[event]/route.ts:4  request.json(): the signature is checked on the raw text; parse only after it
FAIL  C11 callback-signature    callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never ===
        app/api/n8n/[event]/route.ts  no crypto.timingSafeEqual: compare signatures in constant time
        app/api/n8n/[event]/route.ts:7  signature compared with ===: use a length check + crypto.timingSafeEqual
FAIL  C12 callback-timestamp    callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401
        app/api/n8n/[event]/route.ts  x-n8n-timestamp is never read; no ±300 s window for x-n8n-timestamp; the time window must work both ways: Math.abs(now - timestamp) > 300
        app/api/n8n/[event]/route.ts:6  the HMAC must cover `${timestamp}.${rawBody}`, not the body alone
FAIL  C13 callback-idempotency  callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure
        app/api/n8n/[event]/route.ts  idempotency-key is never read; no 200 {duplicate: true} for a repeated idempotency-key; idempotency-key is not matched to `${data.jobId}:${event}` of the signed body; the claimed key is never released when processing fails (n8n's retry would get "duplicate")
PASS  C14 log-hygiene           n8n code logs no bodies, personal data, secrets, env or whole error objects

14 checks: 5 PASS · 5 FAIL · 4 SKIP
exit=1
```

- Обидві закладені помилки знайдено з точним рядком: парсинг до підпису — C10, `route.ts:4`
  (`request.json()`); порівняння через `===` — C11, `route.ts:7`, плюс «no crypto.timingSafeEqual».
  C12 і C13 впали на тому, чого в короткому роуті немає зовсім: HMAC лише від тіла (`route.ts:6`), ні
  `x-n8n-timestamp` з вікном 300 с, ні `idempotency-key`. Код виходу `1`.
- C3 FAIL — наслідок тимчасової теки, а не роуту: у ній немає `.env.example`. C5–C8 — SKIP, бо
  вихідних викликів n8n у теці немає; C1, C2, C4, C9, C14 — PASS, бо цих порушень у файлі немає.
  Отже на `main` C10–C13 показують SKIP через відсутність роуту, а не тому, що нічого не бачать.
- Під час написання скрипта його ще прогнали на більшій навмисно поганій теці (5 файлів: колбек поза
  `app/api/n8n/` з `runtime = "edge"`, клієнт без `server-only` і таймауту, з тестовим URL,
  `?token=` і захардкодженим токеном, Client Component з `NEXT_PUBLIC_N8N_WEBHOOK_URL`, Server
  Action з `void triggerWorkflow()` і хелпером поза `after()`, `.env.example` зі «справжніми»
  секретами) — 14/14 FAIL. Окремо: колбек-роут взагалі без коду підпису (`request.json()` і
  коментар «n8n calls this») знаходиться й падає на C4 і C10–C13, а не проходить як SKIP. Ці теки
  видалено.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
<вивід — після Task D>
```

**Додатково (за бажанням):** матриця колбеків (`send-signed-callback.mjs`): випадок → очікуваний код → отриманий код.

Колбек-роуту в проєкті ще немає, тож матрицю ганяли проти роуту з `references/code-templates.md` у
тимчасовому застосунку Next.js 16.3.5 (`next build` + `next start`, порт 3100; мок — копія скіла на
порту 5700; значення секретів — `change-me-harness-…`). Той самий прогін: запит → мок
`POST /webhook/quote-request -> 202 … auth=ok idempotency=new` → підписаний колбек `-> 202` → запис
`ready`; у режимі `--mode slow --cloud-timeout 800` — три спроби `-> 524` з `idempotency=new`,
`repeat`, `repeat` через ~1 с і ~3 с. На фічі прогону B матрицю треба повторити проти справжнього роуту.

| Id | Випадок | Очікувано | Отримано |
|---|---|---|---|
| R1 | невідома подія в шляху | 404 | 404 |
| R2 | `content-type: text/plain` | 415 | 415 |
| R3 | тіло понад 64 КБ, правильно підписане | 413 | 413 |
| R4 | без `x-n8n-signature` | 401 | 401 |
| R5 | підписано іншим секретом | 401 | 401 |
| R6 | timestamp на 301 с у минулому | 401 | 401 |
| R7 | timestamp на 301 с у майбутньому | 401 | 401 |
| R8 | тіло переформатоване після підпису | 401 | 401 |
| R9 | `idempotency-key` ≠ `<jobId>:<event>` | 400 | 400 |
| R10 | у тілі подія іншого шляху | 400 | 400 |
| R11 | невідомий job, двічі з одним ключем | 4xx, потім те саме (ключ звільнено) | 404, потім 404 |
| V1 | валідний колбек (ключ справжнього запису) | 202 | 202 |
| V2 | той самий запит ще раз | 200 `{"duplicate":true}` | 200 duplicate |
| V3 | ті самі байти, підпис і timestamp з новим ключем | 400 | 400 |

Разом 14 PASS · 0 FAIL, код виходу `0`.

- Що знайшлось під час перевірки скіла (до коміту `04e8b58`):
  - **Стан модуля не спільний для Route Handler і сторінки.** У продакшн-збірці Next.js 16.3.5
    (Turbopack) колбек-роут зберіг `ready` у звичайному `Map` модуля, а RSC-сторінка
    `/quotes/[id]` показувала «not-found». Зі сховищем на `globalThis` сторінка показала
    `processing`, а після колбека — `ready`. `lib/db.ts` LeadDesk тримає дані саме в змінних
    модуля, тож фіча Task D на ньому не побачила б результату колбека. Скіл тепер вимагає тримати
    демо-сховища в пам'яті на `globalThis` (крок 8, пункт чекліста 10, `code-templates.md`,
    `callback-route.md`, `pitfalls.md`).
  - Два хибні спрацювання `check-contract.mjs`, виправлені до коміту: C1 ловив прозовий коментар у
    `.env.example` («never /webhook-test/») — тепер лише значення й закоментовані присвоєння; Route
    Handler, що сам викликає n8n (дозволено для не-React клієнтів), вважався колбек-роутом — тепер
    колбеком є роут під `app/api/n8n/` або з заголовками чи секретом колбека.
  - ESLint (`prefer-const`) на першій версії шаблону роуту — виправлено до копіювання в
    `code-templates.md`; шаблони в скілі байт-у-байт збігаються з кодом, який зібрали й прогнали.

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
