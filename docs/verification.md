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
