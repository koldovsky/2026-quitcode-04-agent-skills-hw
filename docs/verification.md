# Перевірка (Task A–C, бонус E3)

> Скопіюйте в `docs/verification.md` і заповніть. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Учасник:** Maria Vorobets · mvorobets@quitcode.com
- **Інструмент і версія, модель:** Claude Code 2.1.252 · Opus 5.5
- **ОС і термінал, Node:** macOS 15 (Darwin 24.6) · zsh · Node 24.21

## Скіли видно у свіжій сесії

- Як перевіряли: нова сесія без історії — `claude -p "/context"` з кореня репозиторію → таблиця Skills (24.09.2026, після коміту `c044d5b`). `/context` — локальна команда, моделі не викликає, тож працює й без входу
  в CLI; рев'ю коду зі скілом (нижче) потребує моделі — тому воно запускалось окремо

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів опису; видно одразу після встановлення |
| `building-client-form` | Project | ~300 токенів опису; видно у свіжій сесії після коміту `151802a` (`claude -p "/context"` і сесія «Review Task B») |
| `integrating-n8n-webhooks` | | |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки: `find-skills` (User) —
  з'явився в `~/.claude/skills/find-skills/` під час `npx skills@1.7.0 add` (до того тека була порожня). Його інструкції
  пропонують агенту самому шукати й ставити скіли (`npx skills add … -g -y`), а прогін A в Task D мав би його бачити —
  тож для перевірок він шкідливий. Рішення: перенесли в `~/skills-disabled/find-skills` (поза будь-якою текою скілів);
  повторний `claude -p "/context"` — особистих скілів немає, з проєктних видно лише `vercel-react-best-practices`.

## Task A — виправлення за скілом Vercel

Щонайменше 2 виправлення (досить двох); для **одного** (на ваш вибір) — числа до/після, для решти
досить id правила й пояснення.

**Як міряли (для виправлення з числами):** продакшн-збірка (`npm run build && npm start`), macOS, localhost.
Cookie демо-користувача Olena (`leaddesk_session=demo-u_olena`); один прогрівальний запит, далі 3 прогони
`curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" http://localhost:3000/dashboard`.
Лічильники `db:<запит>` — з журналу `npm start` (приріст за один запит сторінки). Після кожної зміни — новий `npm run build`
і перезапуск `npm start`.

Базова лінія (код застосунку як у `main`; гілка на коміті `59acfcd`, до виправлень): TTFB 2.239 / 2.239 / 2.233 с (сер. **2.24 с**); HTML 424 592 Б; RSC 315 197 Б;
на один запит `/dashboard`: `getUserBySession` ×3, `getWorkspace` ×3, `getLeads` / `getLeadStats` / `getSourceBreakdown` ×1.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `95498a0` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` залежать лише від `workspace.id` — тепер один `Promise.all` замість трьох послідовних `await` | TTFB 2.239 / 2.239 / 2.233 с (сер. 2.24 с) | TTFB 1.425 / 1.432 / 1.428 с (сер. **1.43 с**, −36 %) | `curl`, 3 прогони після прогріву (див. вище) |
| `server-cache-react` | `f823608` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` обгорнуто в `cache()`; `getWorkspace` приймає рядок `slug` замість об'єкта `{ slug }` (з об'єктом `cache()` завжди промахувався — порівняння за `Object.is`) | (без заміру часу) 3× `getUserBySession`, 3× `getWorkspace` на запит | (без заміру часу) 1× і 1× на запит | — (лічильники `db:` у журналі `npm start`) |

- Чому обрали для заміру саме це виправлення: у `lib/db.ts` видно, що сторінка — водоспад із 5 запитів
  (100 + 100 + 400 + 1200 + 400 мс ≈ 2.2 с) — саме «понад 2 секунди» зі скарги клієнта. Паралельний запуск трьох незалежних
  запитів має зрізати ~800 мс (400 + 400), що й підтвердили заміри: 2.24 → 1.43 с. Далі час упирається в найповільніший запит
  (`getLeadStats`, 1200 мс) плюс ланцюжок user → workspace (200 мс), які залежать один від одного.
- Друге виправлення — що і чому змінили, як переконались, що не зламали: layout, header і сторінка кожен окремо викликали
  `getCurrentUser()` і `getWorkspace()`, тож за один запит база отримувала по 3 однакові запити. Після `cache()` — по одному
  (лічильники `db:` після 1 і після 4 запитів: 1/1 і 4/4). Час сторінки не змінився (1.43 с): ці дублікати виконувались
  паралельно в різних сегментах, тож це економія навантаження на базу, а не латентності. Перевірили: `/dashboard` → 200,
  сторінка ліда `/dashboard/leads/lead_0023` → 200 з іменем ліда, без cookie і з невідомою сесією → 307 на `/login`.
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували або змінили — і чому:
  - `bundle-dynamic-imports`: приклад скіла — `dynamic(..., { ssr: false })` без застережень. У Next.js 16
    (`01-app/02-guides/lazy-loading.md`) `ssr: false` заборонено в Server Components, а автоматичний code splitting не працює,
    коли Server Component динамічно імпортує Client Component. Тобто застосовувати можна лише всередині клієнтського
    `components/leads-toolbar.tsx` (графік `recharts`) і через `await import("exceljs")` в обробнику експорту. У межах Task A
    не робили (досить двох виправлень) — лишається кандидатом.
  - `server-serialization`: у RSC-відповіді `/dashboard` 172 входження `rawPayload` — клієнтський `LeadsTable` отримує повні
    об'єкти лідів (email, телефон, IP, сирий payload), хоча показує 5 полів. Правило доречне, але не застосовували в Task A —
    лишається кандидатом.
  - `server-after-nonblocking` (форма чекає n8n і журнал аудиту в `app/actions.ts`) свідомо не чіпали: цей виклик у Task D
    замінюється результатом прогону B.
- Якщо виміряне виправлення не змінило чисел — чому: змінило (2.24 → 1.43 с).
- `npm run lint`, `npm run build` після виправлень: обидва без помилок після кожного коміту.
- Рев'ю зі скілом у свіжій сесії: headless `claude -p` для рев'ю не підійшов (CLI не залогінений — «Not logged in»),
  тож виправлення `95498a0` і `f823608` робили за правилами `rules/<id>.md`, прочитаними в робочій сесії. Після цього
  рев'ю повторили як вимагає інструкція — **нова інтерактивна сесія** Claude Code у десктоп-застосунку (сесія «Review task A»,
  24.09.2026, код на коміті `22133ab`, тобто вже з двома виправленнями) — див. розділ нижче.

### Рев'ю зі скілом у новій сесії

- Скіли, які бачила нова сесія (запит «які skills тобі доступні? не відкривай файлів»): з проєкту — лише
  `vercel-react-best-practices` (`.claude/skills/`); особистих (`~/.claude/skills/`) — немає; решта — плагін `anthropic-skills`
  (docs, docx/pptx/xlsx/pdf, skill-creator, schedule…) і вбудовані Claude Code (code-review, simplify, run…) — жоден не про
  продуктивність React.
- Запит (скіл названо, як у кроці 5.1 інструкції):
  > Зроби рев'ю app/, components/, lib/ за скілом vercel-react-best-practices. Для кожної проблеми — рядок таблиці:
  > файл:рядок | id правила | що не так | виправлення для Next.js 16. Файли не змінюй.
- Чи спрацював скіл: так — перший крок сесії — виклик `Skill` з `vercel-react-best-practices` (завантажено `SKILL.md`
  з `.claude/skills/vercel-react-best-practices`), далі читання правил і коду; файлів не змінювала.
- Результат — 15 знахідок (стисло; повна таблиця — у транскрипті сесії):

| файл:рядок | id правила | що не так | виправлення для Next.js 16 |
|---|---|---|---|
| `app/actions.ts:68`, `:74` | `server-auth-actions` | `updateLeadStatus`, `deleteLead` не перевіряють сесію й належність ліда робочому простору | на початку дії — `getCurrentUser()` + перевірка `lead.workspaceId`, валідація статусу |
| `app/actions.ts:53-63` | `server-after-nonblocking` | відповідь форми чекає вебхук n8n і `logAudit` | `after()` з `next/server` |
| `app/dashboard/leads/[id]/page.tsx:12-16` | `async-parallel` | `getLead(id)` стартує лише після `getCurrentUser()` | `Promise.all([getCurrentUser().then(…getWorkspace), getLead(id)])` |
| `app/dashboard/layout.tsx:6-7`, `components/dashboard-header.tsx:5-6` | `async-suspense-boundaries` | каркас дашборда чекає даних | `<Suspense>` / `loading.tsx` |
| `components/leads-toolbar.tsx:4` | `bundle-conditional` | `exceljs` статично в клієнтському бандлі | `await import("exceljs")` в `handleExport` |
| `components/leads-toolbar.tsx:6` | `bundle-dynamic-imports` | `recharts` у бандлі, хоча графік схований | `next/dynamic` з `ssr: false` — можна, бо файл клієнтський |
| `components/lead-search.tsx:5` | `bundle-barrel-imports` | `import { debounce } from "lodash"` тягне весь пакет | `lodash/debounce` або прибрати debounce |
| `app/dashboard/page.tsx:34` | `server-serialization` | у `LeadsTable` — повні `Lead[]` з `rawPayload`, IP, нотатками | передавати 5 потрібних полів |
| `components/lead-search.tsx:20-24` | `client-swr-dedup` | повторний `fetch("/api/leads")` після гідрації | передати рядки пропом або SWR |
| `components/lead-search.tsx:18`, `:43-45` | `rerender-derived-state-no-effect` / `rerender-use-deferred-value` | `filtered` у state через ефект + debounce | фільтр під час рендеру з `useDeferredValue` |
| `components/leads-table.tsx:17-20` | `js-tosorted-immutable` | сортування на кожен рендер, `localeCompare` для ISO-дат | `useMemo` + `toSorted`, дати — порівнянням рядків |
| `components/leads-table.tsx:24` | `rerender-functional-setstate` | `setDescending(!descending)` | `setDescending(d => !d)` |
| `components/leads-toolbar.tsx:72` | `rerender-functional-setstate` | `setShowChart(!showChart)` | `setShowChart(v => !v)` |
| `components/leads-table.tsx:58` | `bundle-preload` | перехід через `router.push` в `onClick`, без префетчу | `<Link>` на імені ліда |
| `components/lead-actions.tsx:17-18` | (поруч із `rerender-transitions`) | `router.refresh()` після дії, що вже робить `revalidatePath` | прибрати `router.refresh()` |

- Що з цього зроблено: у свіжій сесії рев'ю вже бачило виправлення з `95498a0` і `f823608` і відзначило їх як правильні
  («`lib/data.ts` уже кешує користувача й робочий простір через `React.cache`, на сторінці дашборда є `Promise.all`»).
  Решта знахідок у межах Task A не застосовувалась (досить двох виправлень). `server-auth-actions` — діра в безпеці, а не
  продуктивність: варто виправити окремо; `server-after-nonblocking` — у Task D разом із викликом n8n.

## Task B — `building-client-form`

- Скіл: `.claude/skills/building-client-form/SKILL.md` (коміт `151802a`) — лише `SKILL.md`, 120 рядків; `name` = назва теки;
  `description` — 866 символів (перевірено `node -e`), з «що», «Use when…», фразами-тригерами і «Не для…». Правила
  Vercel — лише за id (`server-auth-actions`, `server-serialization`, `server-after-nonblocking`); перевірка «жоден рядок
  ≥ 30 символів зі скіла не збігається з `rules/*.md`» — 0 збігів.
- Запит у свіжій сесії (нова інтерактивна сесія Claude Code «Review Task B», 24.09.2026; скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів;
  > нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл і як це видно: **так, в обох спробах.** Доказ — виклик інструмента `Skill` у транскриптах сесій
  (`~/.claude/projects/-Users-mac1-2026-quitcode-04-agent-skills-hw/<session-id>.jsonl`):

  | Спроба | Сесія | Що було до запиту | Запит (UTC) | Виклик `Skill` (UTC) | Результат |
  |---|---|---|---|---|---|
  | 1 | `c76cf774-bdbb-4046-97af-8f5f31295a19` («Review Task B») | питання «які skills тобі доступні? не відкривай файлів» (20:45:10) — модель перелічила скіли, серед них `building-client-form` | 20:46:00 | 20:46:02 — `Skill {"skill":"building-client-form"}`, перший інструмент після запиту | сесія написала форму за скілом і пройшла його Verify (код — `a3ecf29`) |
  | 2 | `43631cb1-dd2a-4898-a2f6-99f3a9ab49ad` | **нічого** — запит був першим повідомленням сесії | 21:00:46 | 21:00:49 — `Skill {"skill":"building-client-form"}`, **перший інструмент сесії**, до читання будь-якого файлу | форма вже була в гілці (`a3ecf29`), тож сесія лише звірила наявний код зі скілом, розбіжностей не знайшла, файлів не змінювала |

  Спробу 2 зробили, бо в спробі 1 скіл згадувався до запиту (відповідь на питання про скіли). У спробі 2 модель бачила
  лише те, що бачить кожна сесія, — `description` скіла в контексті — і сама вирішила його завантажити на звичайний запит.
  Фрагмент транскрипту спроби 2 (по одному рядку на подію):
  ```
  2026-09-24T21:00:46.665Z USER: На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: …
  2026-09-24T21:00:49.698Z TOOL#1 Skill {"skill":"building-client-form"}
  2026-09-24T21:00:49.713Z Base directory for this skill: /Users/mac1/2026-quitcode-04-agent-skills-hw/.claude/skills/building-client-form
  2026-09-24T21:00:51.085Z TOOL#2 Bash git show --stat HEAD~2 && ls -R app/dashboard lib
  ```
- Якщо не з першого разу: — (спрацював в обох спробах, `description` не змінювали).
- Що зроблено (файли; коміт `a3ecf29`):
  - `lib/note-form.ts` — `parseNoteForm`: `trim`, порожнє → помилка, > 500 символів → помилка (ліміт на сервері,
    `maxLength` у полі — лише підказка); повертає `values` для повторного показу;
  - `app/actions.ts` — `addLeadNote(prevState, formData)`: `getCurrentUser()` → `getWorkspace` + `getLead` і перевірка
    `lead.workspaceId === workspace.id` → валідація → `db.appendLeadNote` → `revalidatePath`; аудит `lead.note_added` —
    в `after()`; повертає лише `{ status, errors?, values?, message? }`;
  - `components/note-form.tsx` — `useActionState`, `<form action>`, `label htmlFor`, `aria-invalid`, `aria-describedby`,
    `role="alert"` / `role="status"`, `defaultValue` з `values` + `key` для повторного монтування;
  - `lib/db.ts` — `appendLeadNote`; `app/dashboard/leads/[id]/page.tsx` — форма під нотатками, `whitespace-pre-line`.
  - Окремо (`dec2e80`): у `next.config.ts` — `logging: { serverFunctions: false }`. Під час Verify сесія помітила, що
    `npm run dev` у Next.js 16 за замовчуванням друкує аргументи кожної Server Function (тобто текст нотатки, а для форми
    заявки — email і телефон). Код скіла нічого не логує; сесія за правилом зупинки не змінювала конфіг сама, а спитала —
    рішення людини: вимкнути (`01-app/03-api-reference/05-config/01-next-config-js/logging.md`).
- Пункти Verify зі скіла — результат кожного:
  - `npm run lint`, `npm run build` — без помилок (і після `dec2e80`).
  - Порожня відправка — над формою `role="alert"` «Перевірте поля: текст нотатки.», в полі `aria-invalid="true"`,
    `aria-describedby="text-error"` → «Напишіть текст нотатки» (перевірено в браузері й через DOM).
  - Після помилки введене лишилось — 520 символів в обхід `maxLength`: сервер відхилив («520 із 500 символів»), текст
    лишився в полі.
  - Без JavaScript — сесія перевірила звичайним POST форми з HTML сервера (як браузер без JS): і збереження, і помилки
    працюють.
  - Дія без сесії — редірект на `/login`, нотатку не збережено.
  - Журнал сервера — після `dec2e80` відправили нотатку з маркером `PII-MARKER-7731`: у журналі `npm run dev` маркера
    немає, лише `db:<запит>` і `POST /dashboard/leads/lead_0023 200`.
  - Повільне після відповіді — `db:insertAuditEntry` з'являється в журналі **після** рядка `POST … 200`: аудит (250 мс)
    виконується в `after()`, відповідь його не чекає.
- Поза задачею: та ж сесія, як і рев'ю в Task A, відзначила, що `updateLeadStatus` і `deleteLead` не перевіряють сесію
  (`server-auth-actions`) — записано як окрему задачу.

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому): у `SKILL.md` (117 рядків) — те, що агент мусить
  зробити й не порушити: таблиця «Контракт коротко» (змінні, де живе код, заголовки й конверт, таймаут і повтори,
  202 + колбек, лише `/webhook/`, формат підпису й порядок колбека, журнали), 7 кроків «Як робимо» з прямими
  посиланнями, чекліст з 11 пунктів, правила зупинки, Verify. У `references/` — те, що потрібно лише на конкретному
  кроці: `contract.md` (змінні, запит, повтори, режими відповіді, test vs production URL), `callback.md` (заголовки
  й тіло колбека, 10 кроків з кодами відповіді, «чому», сховище ключів), `code-templates.md` (шаблони
  `lib/n8n/client.ts`, `lib/n8n/signature.ts`, роуту колбека, Server Action, `.env.example`), `n8n-setup.md`
  (налаштування вузлів n8n словами для людини), `operations.md` (журнали, ліміти, мок, відомі пастки, реєстр).
  Кожен файл `references/` — пряме посилання з `SKILL.md`, без посилань між собою; жодних посилань на `materials/`,
  `docs/` чи `tools/` — у копії прогону B їх не буде. Записку не копіювали: спільні із запискою рядки ≥ 30 символів —
  лише літерали контракту (JSON-приклади, вирази n8n, назви опцій), які мають збігатися дослівно. Правила Vercel —
  за id (`server-auth-actions`, `server-after-nonblocking`).
- Правила зупинки — перелік: (1) просять використати тестовий URL `/webhook-test/`; (2) секрет чи токен мав би
  потрапити в Client Component, `NEXT_PUBLIC_*`, query string, журнал чи відповідь; (3) просять синхронно чекати
  воркфлоу ≥ 100 с / невідомої тривалості чи «підняти таймаут»; (4) бракує значення секрету чи URL — не вигадувати;
  (5) колбек без перевірки підпису, вікна часу чи ідемпотентності — навіть тимчасово; (6) зміна контракту
  (заголовки, підпис, `version`, шляхи); (7) зміна, експорт чи імпорт воркфлоу клієнта; (8) зміни в `tools/`,
  `materials/`, `.env*` (крім `.env.example`). Без винятків «якщо задача потребує».
- Скрипти: `scripts/check-contract.mjs` (14 перевірок C1–C14, лише вбудовані модулі Node, `--root`,
  `--changed-since <ref>`, `--help`; код виходу 1 при FAIL, 2 при помилці аргументів; значень секретів і вмісту
  файлів не друкує), `scripts/mock-n8n.mjs` (копія `tools/mock-n8n.mjs`, `diff` — ідентична),
  `scripts/send-signed-callback.mjs` (матриця з 11 колбеків з очікуваними кодами).
- SHA коміту зі скілом (BASE для Task D): **`0d5a1d9`** (skill v0.2.0). Перша версія — `16a8abf`; після
  незалежного рев'ю (окремий агент перевіряв Task C за README, walkthrough і `.coderabbit.yaml`) скіл виправили
  **до** Task D — див. «Виправлення після рев'ю» нижче. У BASE — виправлення Task A, форма нотаток з Task B, три
  скіли; `/quotes` немає, виклик n8n у `app/actions.ts` не змінений. Свіжа сесія (`claude -p "/context"`) бачить
  `integrating-n8n-webhooks` як Project.
- Що скіл змінив у собі після прогонів (коміти й чому): `56948a4` (v0.2.1) — (1) `send-signed-callback.mjs`: у `--help`
  і підказці після запуску пояснено, чому `valid`/`duplicate` дають 404 без `--request-key` (агент B у прогоні втратив на
  цьому ітерацію: перший запуск матриці — 9/11, після `--request-key` реального запиту — 11/11); (2) `check-contract.mjs`:
  прибрано невикористану змінну (попередження eslint). `f6f10c3` (v0.2.2) — після рев'ю фічі B: у крок «Статус» і
  чекліст додано вимоги для публічної сторінки статусу (id — `randomUUID`, межа опитування, `redirect()` з дії), бо
  прогін B зробив послідовні id (витік даних), вічне опитування й перехід лише з JS (виправлено в `ebb8de1`, `0df23ed`,
  `3639daa`). Контракт n8n і перевірки `check-contract.mjs` не змінювались. Деталі A/B — `docs/ab-validation.md`.

**`check-contract.mjs` на коді `main`** (`git archive main | tar -x -C ../leaddesk-main`; id + PASS/FAIL, код виходу):

```
n8n contract check — root: ../leaddesk-main
scope: whole project; 28 code file(s), 1 .env example(s)

C1   FAIL  no /webhook-test/ URL in code or .env*.example
       - .env.example:6  test webhook URL (works only 120 s after 'Listen for test event')
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   FAIL  n8n webhook calls only from lib/n8n/client.ts
       - app/actions.ts:54  calls n8n outside lib/n8n/client.ts
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
       - app/actions.ts:54  n8n is called but lib/n8n/client.ts does not exist
C5   FAIL  every fetch to n8n has a timeout (AbortSignal.timeout)
       - app/actions.ts:54  fetch to n8n without signal: AbortSignal.timeout(...)
C6   FAIL  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
       - app/actions.ts:54  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  request body is the envelope { version: 1, event, data }
       - app/actions.ts:54  body is not the { version: 1, event, data } envelope
C8   FAIL  .env.example follows the contract variables
       - .env.example:1  N8N_WEBHOOK_BASE_URL is missing
       - .env.example:1  N8N_WEBHOOK_TOKEN is missing
       - .env.example:1  N8N_CALLBACK_SECRET is missing
       - .env.example:1  APP_BASE_URL is missing
       - .env.example:6  legacy N8N_WEBHOOK_URL: use N8N_WEBHOOK_BASE_URL + /<event>
C9   FAIL  Server Actions start n8n workflows inside after()
       - app/actions.ts:54  Server Action waits for n8n: move the call into after() and return { status, id }
C10  PASS  callback reads the raw body; no req.json()/JSON.parse before the signature check (n/a: no n8n callback route)
C11  PASS  callback signature: length check + timingSafeEqual, never === / !== (n/a: no n8n callback route)
C12  PASS  callback checks a 300 s timestamp window and an idempotency-key (n/a: no n8n callback route)
C13  PASS  no runtime = "edge"
C14  PASS  no request bodies, form data or personal data in logs of n8n-related code

14 checks: 6 PASS, 8 FAIL
exit=1
```

На поточній гілці до Task D — ті самі 8 FAIL (C1, C3–C9; рядок у `app/actions.ts` — 57 замість 54 через імпорти
форми нотаток). C9 спершу хибно давав PASS на гілці — бо у файлі вже був `after()` з Task B; перевірку переписали:
тепер вона перевіряє, що виклик n8n **всередині** `after(…)` (пошук парних дужок), і дає FAIL.

**Що скрипт побачив на навмисно поганому коді.** Колбек-роут, якого на `main` ще немає (`app/api/n8n/[event]/route.ts`
у тимчасовій теці: `req.json()` замість `req.text()`, підпис через `!==`, без вікна часу й ключа, `runtime = "edge"`,
`console.log(body)`):

```
n8n contract check — root: <scratch>/bad-fixture
scope: whole project; 1 code file(s), 0 .env example(s)

C1   PASS  no /webhook-test/ URL in code or .env*.example
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   PASS  n8n webhook calls only from lib/n8n/client.ts
C4   PASS  lib/n8n/client.ts exists and starts with import "server-only" (n/a: project does not call n8n)
C5   PASS  every fetch to n8n has a timeout (AbortSignal.timeout) (n/a: no fetch to n8n)
C6   PASS  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id (n/a: no fetch to n8n)
C7   PASS  request body is the envelope { version: 1, event, data } (n/a: no fetch to n8n)
C8   PASS  .env.example follows the contract variables (n/a: no .env.example and no n8n calls)
C9   PASS  Server Actions start n8n workflows inside after() (n/a: no Server Action calls n8n)
C10  FAIL  callback reads the raw body; no req.json()/JSON.parse before the signature check
       - app/api/n8n/[event]/route.ts:6  req.json() re-serializes the body: read req.text() and verify first
       - app/api/n8n/[event]/route.ts:1  raw body is not read with req.text()
C11  FAIL  callback signature: length check + timingSafeEqual, never === / !==
       - app/api/n8n/[event]/route.ts:1  no crypto.timingSafeEqual for the signature (route or lib/n8n/*)
       - app/api/n8n/[event]/route.ts:10  signature compared with ===/!== (timing leak): use timingSafeEqual
C12  FAIL  callback checks a 300 s timestamp window and an idempotency-key
       - app/api/n8n/[event]/route.ts:1  no 300 s window check on x-n8n-timestamp
       - app/api/n8n/[event]/route.ts:1  idempotency-key is not checked
C13  FAIL  no runtime = "edge"
       - app/api/n8n/[event]/route.ts:3  edge runtime: node:crypto is needed
C14  FAIL  no request bodies, form data or personal data in logs of n8n-related code
       - app/api/n8n/[event]/route.ts:7  log line may contain a body, form data, personal data or a secret

14 checks: 9 PASS, 5 FAIL
exit=1
```

Клієнт і дія (тимчасова тека: `lib/n8n/client.ts` без `server-only` і таймауту, `NEXT_PUBLIC_N8N_…`, лише один заголовок,
`console.log` з даними; Server Action чекає `triggerWorkflow` поза `after()`; `.env.example` з `/webhook-test` і
справжнім на вигляд токеном):

```
n8n contract check — root: <scratch>/bad-fixture-2
scope: whole project; 2 code file(s), 1 .env example(s)

C1   FAIL  no /webhook-test/ URL in code or .env*.example
       - .env.example:1  test webhook URL (works only 120 s after 'Listen for test event')
C2   FAIL  no NEXT_PUBLIC_ prefix on N8N_* variables
       - lib/n8n/client.ts:3  N8N_* variable exposed to the client bundle
C3   PASS  n8n webhook calls only from lib/n8n/client.ts
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
       - lib/n8n/client.ts:2  first statement is not import "server-only"
C5   FAIL  every fetch to n8n has a timeout (AbortSignal.timeout)
       - lib/n8n/client.ts:3  fetch to n8n without signal: AbortSignal.timeout(...)
C6   FAIL  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
       - lib/n8n/client.ts:3  missing header(s): idempotency-key, x-correlation-id
C7   PASS  request body is the envelope { version: 1, event, data }
C8   FAIL  .env.example follows the contract variables
       - .env.example:1  N8N_WEBHOOK_BASE_URL must end with /webhook
       - .env.example:2  N8N_WEBHOOK_TOKEN must be a change-me-... placeholder
C9   FAIL  Server Actions start n8n workflows inside after()
       - app/actions.ts:7  Server Action waits for n8n: move the call into after() and return { status, id }
C10  PASS  callback reads the raw body; no req.json()/JSON.parse before the signature check (n/a: no callback route app/api/n8n/**/route.*)
C11  PASS  callback signature: length check + timingSafeEqual, never === / !== (n/a: no callback route app/api/n8n/**/route.*)
C12  PASS  callback checks a 300 s timestamp window and an idempotency-key (n/a: no callback route app/api/n8n/**/route.*)
C13  PASS  no runtime = "edge"
C14  FAIL  no request bodies, form data or personal data in logs of n8n-related code
       - lib/n8n/client.ts:8  log line may contain a body, form data, personal data or a secret

14 checks: 6 PASS, 8 FAIL
exit=1
```

**Шаблони скіла проти того самого скрипта (перевірка, що він не «завжди FAIL»).** Тимчасова копія гілки, у яку
вставили блоки коду з `references/code-templates.md` (дослівно, скриптом) + заглушку сховища ключів і переведений на
`triggerWorkflow` в `after()` виклик у формі заявки:

```
n8n contract check — root: <scratch>/good-fixture
scope: whole project; 35 code file(s), 1 .env example(s)

C1   PASS  no /webhook-test/ URL in code or .env*.example
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   PASS  n8n webhook calls only from lib/n8n/client.ts
C4   PASS  lib/n8n/client.ts exists and starts with import "server-only"
C5   PASS  every fetch to n8n has a timeout (AbortSignal.timeout)
C6   PASS  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  request body is the envelope { version: 1, event, data }
C8   PASS  .env.example follows the contract variables
C9   PASS  Server Actions start n8n workflows inside after()
C10  PASS  callback reads the raw body; no req.json()/JSON.parse before the signature check
C11  PASS  callback signature: length check + timingSafeEqual, never === / !==
C12  PASS  callback checks a 300 s timestamp window and an idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  no request bodies, form data or personal data in logs of n8n-related code

14 checks: 14 PASS, 0 FAIL
exit=0
```

У тій самій копії: `next build` — ✓ (роут `ƒ /api/n8n/[event]`), `eslint` — без помилок; `--changed-since base` —
14 PASS; `send-signed-callback.mjs` проти роуту з шаблону — **усі 11 випадків PASS** (202, дублікат 200, 401 ×4,
400 ×2, 415, 404, 413); мок зі скіла (`--mode immediately`, з токеном) — `POST /webhook/lead-created -> 200 …
auth=ok idempotency=new`, заголовки `idempotency-key`, `x-correlation-id`, `x-n8n-token`, тіло 98 Б (на `main` — 1429 Б
цілого ліда), форма відповіла за 455 мс; ні email, ні текст заявки в журналах застосунку й мока не з'явились. Копію
видалено; у робочій гілці фічі й змін виклику n8n немає.

**Виправлення після рев'ю (`0d5a1d9`, до Task D).** Рев'ю знайшло, що перевірка шукала код n8n лише за «нашими» іменами
(`N8N_WEBHOOK_*`, роут у `app/api/n8n/`): код з власною змінною (`N8N_QUOTE_URL`) і колбеком в іншій теці майже весь
проходив — а саме такий код імовірно напише прогін A. Що змінили:

1. код, що викликає n8n, — за змістом: будь-яка змінна `N8N_*` (крім `N8N_CALLBACK_SECRET`) або `fetch`, у виклику
   якого є n8n / webhook;
2. колбек-роути — за шляхом **або** за змістом (`x-n8n-signature`, `x-n8n-timestamp`, `N8N_CALLBACK_SECRET`) будь-де в `app/`;
3. C11: FAIL на `===`/`!==` із заголовком підпису чи обчисленим HMAC; `timingSafeEqual` має реально викликатися
   на шляху роуту (напряму чи через хелпер), а не просто бути визначеним;
4. імпорти `@/lib/n8n` (barrel) і з перейменуванням (`as start`) рахуються як виклики n8n у C9;
5. шаблон Server Action: `triggerWorkflow` в `after()` загорнуто в `try/catch` → запис не зависає в `queued`;
6. правило зупинки: відсутність значень у `.env.local` — не привід зупинятись (код читає `process.env`, людині —
   список змінних); зупинка — лише якщо пропонують вписати чи вигадати значення в коді.

Ще одна знахідка під час перевірки: коментар `// … timingSafeEqual (у verifySignature)` у шаблоні рахувався як
виклик — пошук тепер ігнорує коментарі.

Фікстура рев'ю (власна змінна `N8N_QUOTE_URL`, синхронний `fetch` без таймауту й заголовків у Server Action,
колбек `app/api/quotes/callback/route.ts` з `req.json()`, `!==` і `console.log(body)`): стара версія скрипта —
`14 checks: 14 PASS, 0 FAIL`; нова:

```
n8n contract check — root: <scratch>/fn/fn1
scope: whole project; 2 code file(s), 0 .env example(s)

C1   PASS  no /webhook-test/ URL in code or .env*.example
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   FAIL  n8n webhook calls only from lib/n8n/client.ts
       - app/quotes/new/actions.ts:3  calls n8n outside lib/n8n/client.ts
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
       - app/quotes/new/actions.ts:3  n8n is called but lib/n8n/client.ts does not exist
C5   FAIL  every fetch to n8n has a timeout (AbortSignal.timeout)
       - app/quotes/new/actions.ts:3  fetch to n8n without signal: AbortSignal.timeout(...)
C6   FAIL  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
       - app/quotes/new/actions.ts:3  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  request body is the envelope { version: 1, event, data }
       - app/quotes/new/actions.ts:3  body is not the { version: 1, event, data } envelope
C8   FAIL  .env.example follows the contract variables
       - .env.example:1  .env.example is missing
C9   FAIL  Server Actions start n8n workflows inside after()
       - app/quotes/new/actions.ts:3  Server Action waits for n8n: move the call into after() and return { status, id }
C10  FAIL  callback reads the raw body; no req.json()/JSON.parse before the signature check
       - app/api/quotes/callback/route.ts:3  req.json() re-serializes the body: read req.text() and verify first
       - app/api/quotes/callback/route.ts:1  raw body is not read with req.text()
C11  FAIL  callback signature: length check + timingSafeEqual, never === / !==
       - app/api/quotes/callback/route.ts:6  signature is never checked with crypto.timingSafeEqual (directly or via a helper)
       - app/api/quotes/callback/route.ts:7  signature compared with ===/!== (timing leak): use timingSafeEqual
C12  FAIL  callback checks a 300 s timestamp window and an idempotency-key
       - app/api/quotes/callback/route.ts:1  no 300 s window check on x-n8n-timestamp
       - app/api/quotes/callback/route.ts:1  idempotency-key is not checked
C13  PASS  no runtime = "edge"
C14  FAIL  no request bodies, form data or personal data in logs of n8n-related code
       - app/api/quotes/callback/route.ts:4  log line may contain a body, form data, personal data or a secret

14 checks: 3 PASS, 11 FAIL
exit=1
```

Після виправлень: `main` — ті самі 8 FAIL; обидві погані фікстури — ті самі FAIL; шаблони в копії гілки —
14 PASS / 0 FAIL, `next build` ✓; фікстура «хелпер з `timingSafeEqual` є, але заголовок порівнюється через `!==`» —
C11 FAIL, а той самий роут, що викликає хелпер, — 14 PASS; barrel-імпорт `@/lib/n8n` з `await` поза `after()` — C9 FAIL.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — `b723df3` — і виправлень `ebb8de1`…`3639daa`; увесь
проєкт, без `--changed-since`):

```
n8n contract check — root: .
scope: whole project; 41 code file(s), 1 .env example(s)

C1   PASS  no /webhook-test/ URL in code or .env*.example
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   PASS  n8n webhook calls only from lib/n8n/client.ts
C4   PASS  lib/n8n/client.ts exists and starts with import "server-only"
C5   PASS  every fetch to n8n has a timeout (AbortSignal.timeout)
C6   PASS  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  request body is the envelope { version: 1, event, data }
C8   PASS  .env.example follows the contract variables
C9   PASS  Server Actions start n8n workflows inside after()
C10  PASS  callback reads the raw body; no req.json()/JSON.parse before the signature check
C11  PASS  callback signature: length check + timingSafeEqual, never === / !==
C12  PASS  callback checks a 300 s timestamp window and an idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  no request bodies, form data or personal data in logs of n8n-related code

14 checks: 14 PASS, 0 FAIL
exit=0
```

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
