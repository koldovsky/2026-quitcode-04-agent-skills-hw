# Перевірка (Task A–C, бонус E3)

> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code (desktop app, вкладка Code) · Claude Opus 5.5
- **ОС і термінал, Node:** Windows 11 Pro 10.0.26200 · Git Bash · Node 23.4.0

## Скіли видно у свіжій сесії

- Як перевіряли: окремий неінтерактивний запуск `MSYS_NO_PATHCONV=1 claude -p "/context"` (Claude Code CLI 2.1.281) з теки `hw4` → розділ Skills. Паралельно — `/context` у новій сесії desktop-застосунку: Skills 4,9k токенів.

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів в індексі; встановлено в `.claude/skills/`, коміт `c8d53ce` |
| `building-client-form` | | Task B |
| `integrating-n8n-webhooks` | | Task C |

- Особисті скіли, які теж видно: `find-skills` (Source: User, `~/.claude/skills/find-skills/SKILL.md`, створено 27.09.2026 о 20:44 — разом із запуском `npx skills@1.7.0`). Решта — вбудовані скіли Claude Code (`code-review`, `simplify`, `init`, …). Для Task A–C не заважає; перед Task D `find-skills` треба прибрати з `~/.claude/skills/`, бо за протоколом у копії A не має бути жодного скіла, а в копії B — лише `integrating-n8n-webhooks`.

## Task A — виправлення за скілом Vercel

Рев'ю застосунку зроблено за правилами скіла (`.claude/skills/vercel-react-best-practices/rules/*.md`)
з лічильниками `db:<запит>` у журналі сервера. Знахідки, з яких обрано виправлення:

| Файл:рядок | id правила | Що не так |
|---|---|---|
| `app/dashboard/page.tsx:16-18` | `async-parallel` | `getLeads` (400 мс) → `getLeadStats` (1200 мс) → `getSourceBreakdown` (400 мс) по черзі, хоча незалежні |
| `lib/data.ts:7`, `lib/data.ts:18` | `server-cache-react` | `getCurrentUser` без `cache()`; `getWorkspace` у `cache()`, але з inline-об'єктом `{ slug }` — промах кешу на кожен виклик; layout, header і page → по 3 запити до БД |
| `components/leads-table.tsx:12` | `server-serialization` | Client Component отримує повні `Lead` з `rawPayload`, `internalNotes`, `ipAddress`, `userAgent` (у HTML — 172 входження `rawPayload`, 424 КБ) |
| `components/leads-toolbar.tsx:4`, `:5` | `bundle-dynamic-imports` / `bundle-conditional` | `exceljs` і `recharts` у клієнтському бандлі одразу, хоча потрібні лише після кліку |

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

- Чому обрали для заміру `async-parallel`: ефект прямо передбачуваний із затримок у `lib/db.ts` (400 + 1200 + 400 → max 1200 мс, тобто −800 мс) і видно одним `curl`. Отримали −810…−840 мс.
- `server-cache-react`: layout, `DashboardHeader` і page кожен викликали `getCurrentUser()` і `getWorkspace()`. У `getWorkspace` `cache()` вже був, але аргумент-об'єкт створювався заново, а `React.cache` порівнює аргументи через `Object.is` — саме цей антипатерн описано в правилі. Перевірили, що не зламали: `/dashboard` без cookie → 307 на `/login`, з невідомою сесією → 307, `/dashboard/leads/lead_0001` → 200; `npm run build` проходить (типи всіх викликів `getWorkspace` оновлено).
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували: `bundle-barrel-imports` радить додати бібліотеки в `experimental.optimizePackageImports`. У Next.js 16.3.5 `recharts` уже в списку «optimized by default» (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`) — додавати його в конфіг зайве. `lodash` (CommonJS) у тому списку немає (є лише `lodash-es`), тож для нього допомогла б не конфігурація, а прямий імпорт `lodash/debounce`. Не застосовували: не входить у два виправлення, ефект на час відкриття дашборду незначний.
- Виміряне виправлення змінило числа: TTFB −35 %. `server-cache-react` на TTFB не вплинув, бо layout і page Next.js рендерить паралельно — дублікати йшли одночасно; ефект — утричі менше запитів до БД на відкриття сторінки.
- `server-serialization`: `LeadsTable` — Client Component, тож усі 25+ полів кожного з 172 лідів серіалізувались у HTML і RSC, включно з `rawPayload` (IP, user-agent, UTM), внутрішніми нотатками менеджерів, телефонами й email — хоча таблиця показує лише ім'я, компанію, статус і дату. Це і вага сторінки, і витік персональних даних у браузер (документація Next.js 16 `data-security.md` радить те саме: «safe, minimal DTOs»). Перевірили в браузері: 172 рядки, сортування за компанією — правильне, клік по рядку відкриває `/dashboard/leads/<id>`.
- `npm run lint`, `npm run build` після кожного виправлення: без помилок.

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо):
  > <запит>
- Чи спрацював скіл і як це видно: <виклик `Skill` з `building-client-form` / читання `SKILL.md` / ні>
- Якщо не з першого разу — що змінили в `description`, і результат другої спроби: <…>
- Що зроблено (файли): <…>
- Пункти Verify зі скіла — результат кожного: <…>

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
