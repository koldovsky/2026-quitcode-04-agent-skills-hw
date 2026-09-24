# Перевірка (Task A–C, бонус E3)

> Скопіюйте в `docs/verification.md` і заповніть. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code 2.1.252 · Opus 5.5
- **ОС і термінал, Node:** macOS 15 (Darwin 24.6) · zsh · Node 24.21

## Скіли видно у свіжій сесії

- Як перевіряли: нова сесія без історії — `claude -p "/context"` з кореня репозиторію → таблиця Skills (24.09.2026, після коміту `599de78`). `/context` — локальна команда, моделі не викликає, тож працює й без входу
  в CLI; рев'ю коду зі скілом (нижче) потребує моделі — тому воно запускалось окремо

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів опису; видно одразу після встановлення |
| `building-client-form` | Project | ~300 токенів опису; видно у свіжій сесії після коміту `c603b92` (`claude -p "/context"` і сесія «Review Task B») |
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

Базова лінія (код застосунку як у `main`; гілка на коміті `1e1eb37`, до виправлень): TTFB 2.239 / 2.239 / 2.233 с (сер. **2.24 с**); HTML 424 592 Б; RSC 315 197 Б;
на один запит `/dashboard`: `getUserBySession` ×3, `getWorkspace` ×3, `getLeads` / `getLeadStats` / `getSourceBreakdown` ×1.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `b440292` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` залежать лише від `workspace.id` — тепер один `Promise.all` замість трьох послідовних `await` | TTFB 2.239 / 2.239 / 2.233 с (сер. 2.24 с) | TTFB 1.425 / 1.432 / 1.428 с (сер. **1.43 с**, −36 %) | `curl`, 3 прогони після прогріву (див. вище) |
| `server-cache-react` | `08cdf0c` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` обгорнуто в `cache()`; `getWorkspace` приймає рядок `slug` замість об'єкта `{ slug }` (з об'єктом `cache()` завжди промахувався — порівняння за `Object.is`) | (без заміру часу) 3× `getUserBySession`, 3× `getWorkspace` на запит | (без заміру часу) 1× і 1× на запит | — (лічильники `db:` у журналі `npm start`) |

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
  тож виправлення `b440292` і `08cdf0c` робили за правилами `rules/<id>.md`, прочитаними в робочій сесії. Після цього
  рев'ю повторили як вимагає інструкція — **нова інтерактивна сесія** Claude Code у десктоп-застосунку (сесія «Review task A»,
  24.09.2026, код на коміті `8ba3f4e`, тобто вже з двома виправленнями) — див. розділ нижче.

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

- Що з цього зроблено: у свіжій сесії рев'ю вже бачило виправлення з `b440292` і `08cdf0c` і відзначило їх як правильні
  («`lib/data.ts` уже кешує користувача й робочий простір через `React.cache`, на сторінці дашборда є `Promise.all`»).
  Решта знахідок у межах Task A не застосовувалась (досить двох виправлень). `server-auth-actions` — діра в безпеці, а не
  продуктивність: варто виправити окремо; `server-after-nonblocking` — у Task D разом із викликом n8n.

## Task B — `building-client-form`

- Скіл: `.claude/skills/building-client-form/SKILL.md` (коміт `c603b92`) — лише `SKILL.md`, 120 рядків; `name` = назва теки;
  `description` — 866 символів (перевірено `node -e`), з «що», «Use when…», фразами-тригерами і «Не для…». Правила
  Vercel — лише за id (`server-auth-actions`, `server-serialization`, `server-after-nonblocking`); перевірка «жоден рядок
  ≥ 30 символів зі скіла не збігається з `rules/*.md`» — 0 збігів.
- Запит у свіжій сесії (нова інтерактивна сесія Claude Code «Review Task B», 24.09.2026; скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів;
  > нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл і як це видно: **так, з першої спроби.** Перед запитом сесія на «які skills тобі доступні?» назвала
  `building-client-form` серед скілів проєкту. У транскрипті сесії — виклик інструмента `Skill`, результат якого
  починається з `Base directory for this skill: …/.claude/skills/building-client-form`; сесія сама написала «пишу три
  файли форми за скілом `building-client-form`» і пройшла його розділ Verify.
- Якщо не з першого разу: — (спрацював з першого разу, `description` не змінювали).
- Що зроблено (файли; коміт `67a76c2`):
  - `lib/note-form.ts` — `parseNoteForm`: `trim`, порожнє → помилка, > 500 символів → помилка (ліміт на сервері,
    `maxLength` у полі — лише підказка); повертає `values` для повторного показу;
  - `app/actions.ts` — `addLeadNote(prevState, formData)`: `getCurrentUser()` → `getWorkspace` + `getLead` і перевірка
    `lead.workspaceId === workspace.id` → валідація → `db.appendLeadNote` → `revalidatePath`; аудит `lead.note_added` —
    в `after()`; повертає лише `{ status, errors?, values?, message? }`;
  - `components/note-form.tsx` — `useActionState`, `<form action>`, `label htmlFor`, `aria-invalid`, `aria-describedby`,
    `role="alert"` / `role="status"`, `defaultValue` з `values` + `key` для повторного монтування;
  - `lib/db.ts` — `appendLeadNote`; `app/dashboard/leads/[id]/page.tsx` — форма під нотатками, `whitespace-pre-line`.
  - Окремо (`0a04307`): у `next.config.ts` — `logging: { serverFunctions: false }`. Під час Verify сесія помітила, що
    `npm run dev` у Next.js 16 за замовчуванням друкує аргументи кожної Server Function (тобто текст нотатки, а для форми
    заявки — email і телефон). Код скіла нічого не логує; сесія за правилом зупинки не змінювала конфіг сама, а спитала —
    рішення людини: вимкнути (`01-app/03-api-reference/05-config/01-next-config-js/logging.md`).
- Пункти Verify зі скіла — результат кожного:
  - `npm run lint`, `npm run build` — без помилок (і після `0a04307`).
  - Порожня відправка — над формою `role="alert"` «Перевірте поля: текст нотатки.», в полі `aria-invalid="true"`,
    `aria-describedby="text-error"` → «Напишіть текст нотатки» (перевірено в браузері й через DOM).
  - Після помилки введене лишилось — 520 символів в обхід `maxLength`: сервер відхилив («520 із 500 символів»), текст
    лишився в полі.
  - Без JavaScript — сесія перевірила звичайним POST форми з HTML сервера (як браузер без JS): і збереження, і помилки
    працюють.
  - Дія без сесії — редірект на `/login`, нотатку не збережено.
  - Журнал сервера — після `0a04307` відправили нотатку з маркером `PII-MARKER-7731`: у журналі `npm run dev` маркера
    немає, лише `db:<запит>` і `POST /dashboard/leads/lead_0023 200`.
  - Повільне після відповіді — `db:insertAuditEntry` з'являється в журналі **після** рядка `POST … 200`: аудит (250 мс)
    виконується в `after()`, відповідь його не чекає.
- Поза задачею: та ж сесія, як і рев'ю в Task A, відзначила, що `updateLeadStatus` і `deleteLead` не перевіряють сесію
  (`server-auth-actions`) — записано як окрему задачу.

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
