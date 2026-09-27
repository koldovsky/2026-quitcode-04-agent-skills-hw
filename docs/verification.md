# Перевірка (Task A–C, бонус E3)

> Сюди — лише те, що справді сталося: цитати, числа, імена файлів, SHA комітів.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code (розширення VS Code) · Opus 5.5 (`claude-opus-5-5`)
- **ОС і термінал, Node:** Windows 10 Pro 19045 · Git Bash (Git 2.54) · Node 24.16.0, npm 11.13.0

## Скіли видно у свіжій сесії

- Як перевіряли: 27.09.2026, **нова** сесія Claude Code у теці проєкту (після коміту `5ad1deb`), запит
  «які skills тобі доступні? не відкривай файлів». Відповідь агента (скорочено): «Скіл проєкту (з
  .claude/skills/): vercel-react-best-practices — поради Vercel щодо продуктивності React і Next.js…
  До цього проєкту безпосередньо стосується лише vercel-react-best-practices. Решта скілів вбудовані
  або глобальні.»

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project (`.claude/skills/`) | видно у свіжій сесії, файли не відкривались |
| `building-client-form` | | Task B |
| `integrating-n8n-webhooks` | | Task C |

- Інші скіли, які теж видно в тій сесії: вбудовані в Claude Code (`code-review`, `simplify`,
  `security-review`, `run`, `init`, `claude-api`, `update-config`, `keybindings-help`,
  `fewer-permission-prompts`, `loop`, `schedule`, `workflow-authoring`, `artifact-*`, `dataviz`) і
  особисті/синхронізовані `anthropic-skills` з `~/.claude/skills/synced/…`
  (`docs`, `docx`, `google-workspace`, `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`,
  `xlsx`). Жоден не стосується React-продуктивності, форм чи n8n, тож на перевірки Task A–C не впливає.
  `~/.cursor/skills`, `~/.agents/skills` — немає; `~/.codex/skills` — порожня. Для Task D це врахуємо
  окремо (див. `docs/ab-validation.md`).

## Спостереження на `main` (крок 0)

Відправка публічної форми з `.env.local` = копія `.env.example`, мок запущено без параметрів.
Форма показала «Дякуємо! Заявку отримано.», а в журналі мока:

```
[mock-n8n] 2026-09-27T12:58:47.128Z POST /webhook-test/lead-created -> 404 in 6 ms  | headers: accept,accept-language,content-type,user-agent | body 1236 B sha256=96dafe84578d5cd606610daaa8672cd87334bdaa5e62d7e62fcae9d8ced477f6
```

Тобто «воркфлоу» не запускався (тестовий URL, 404), код на відповідь не дивиться, заголовка
автентифікації немає, у тілі — увесь рядок ліда (1236 B). Не виправлялось: контракт пакуємо в скіл
(Task C), а виклик приводимо до нього в Task D.

## Task A — виправлення за скілом Vercel

### Рев'ю застосунку за скілом

Скіл викликано в сесії (інструмент `Skill` → `vercel-react-best-practices`) із запитом: «Review app/,
components/, lib/ … For each issue: file:line | rule id | problem | fix for Next.js 16. Don't change
files yet.» Знахідки (номери рядків — на коді `main`):

| Файл:рядок | id правила | Що не так | Виправлення для Next.js 16 | Статус |
|---|---|---|---|---|
| `app/dashboard/page.tsx:16-18` | `async-parallel` | `getLeads` (400 мс), `getLeadStats` (1200 мс), `getSourceBreakdown` (400 мс) — незалежні, але йдуть послідовно | `Promise.all` | ✅ `d083a4b` |
| `lib/data.ts:7` | `server-cache-react` | `getCurrentUser` без `cache()` — викликають layout, header і page: 3× `db:getUserBySession` на запит | `cache(async () => …)` | ✅ `48e6f31` |
| `lib/data.ts:19` + 4 виклики | `server-cache-react` | `getWorkspace` у `cache()`, але аргумент — inline-об'єкт `{ slug }` → щоразу промах: 3× `db:getWorkspace` | примітивний аргумент `getWorkspace(slug)` | ✅ `48e6f31` |
| `app/dashboard/page.tsx:32` → `components/leads-table.tsx:12` | `server-serialization` | У Client Component іде повний `Lead` (IP, user-agent, `rawPayload`, внутрішні нотатки) для 172 лідів, а таблиця показує 5 полів | передавати `Pick<Lead, …>` з 5 полів | ✅ `3fda988` |
| `app/actions.ts:68,74` | `server-auth-actions` | `updateLeadStatus`, `deleteLead` — публічні ендпоінти без перевірки сесії й належності ліда до workspace | перевірка всередині дії | ✅ `325b8a2` |
| `app/actions.ts:54-63` | `server-after-nonblocking` | Форма чекає на `fetch` до n8n і `logAudit` (250 мс) перед відповіддю | `after()` | ⏭ Task D (частина контракту n8n) |
| `components/leads-toolbar.tsx:4` | `bundle-conditional` / `bundle-dynamic-imports` | `exceljs` імпортується статично, хоча потрібен лише після кліку «Експорт» | `await import("exceljs")` у обробнику | не застосовано (достатньо 4 виправлень) |
| `components/lead-search.tsx:5` | `bundle-barrel-imports` | `import { debounce } from "lodash"` — `lodash` (не `lodash-es`) **не** в списку `optimizePackageImports` Next 16 | `lodash/debounce` або власний debounce | не застосовано |
| `components/lead-search.tsx:20-24` | `client-swr-dedup` / `server-dedup-props` | Після гідрації ще раз тягне `/api/leads` — ті самі ліди, що вже є на сторінці | передати рядки для пошуку з сервера | не застосовано |
| `components/lead-search.tsx:26-45` | `rerender-derived-state-no-effect` | Відфільтрований список — стан, що оновлюється в ефекті | обчислювати під час рендеру (+ `useDeferredValue`) | не застосовано |
| `app/dashboard/page.tsx` | `async-suspense-boundaries` | Уся сторінка чекає `getLeadStats` (1,2 с) | `<Suspense>` навколо статистики | не застосовано |

### Виправлення

**Як міряли:** продакшн-збірка (`npm run build`, потім `next start`), `curl` з cookie
`leaddesk_session=demo-u_olena`, 1 прогрів + **5 прогонів** TTFB/total; розмір HTML
(`curl … | wc -c`) і RSC (`curl -H "RSC: 1" … | wc -c`); лічильники `db:<запит>` — приріст у журналі
сервера за **один** запит `/dashboard`. Усі заміри одним скриптом, по черзі на кожному коміті;
базова лінія — на коді `5ad1deb` (застосунок як на `main`).

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `d083a4b` | `app/dashboard/page.tsx` | 3 незалежні запити даних — через `Promise.all` | TTFB 2,307 / 2,297 / 2,329 / 2,315 / 2,299 с (≈ **2,31 с**) | TTFB 1,482 / 1,475 / 1,482 / 1,482 / 1,489 с (≈ **1,48 с**, −36 %) | `curl -w "%{time_starttransfer}"`, 5 прогонів |
| `server-cache-react` | `48e6f31` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` у `cache()`; `getWorkspace(slug: string)` замість `({ slug })` | `db:getUserBySession` ×3, `db:getWorkspace` ×3 на запит | ×1 і ×1; TTFB без змін (≈ 1,47–1,50 с) | приріст лічильників у журналі `next start` за 1 запит |
| `server-serialization` | `3fda988` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у `LeadsTable` — лише `id, fullName, company, status, createdAt` | HTML 424 592 B, RSC 315 197 B; `rawPayload`/`internalNotes`/`ipAddress` — по 172 входження в HTML | HTML **111 377 B** (−74 %), RSC **31 257 B** (−90 %); 0 входжень | `curl … \| wc -c`, `grep -o '<поле>' \| wc -l` |
| `server-auth-actions` | `325b8a2` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` перевіряють сесію (`getCurrentUser`) і що лід з workspace користувача; статус — зі списку | прямий виклик дії з фейковою сесією `demo-u_none` і з сесією `demo-u_marta` (інший workspace) **змінив** `lead_0001` (Studio Nova) | обидва виклики відхилено (`Error: Lead not found` / redirect), `db:updateLeadStatus` не виконується; з `demo-u_olena` — працює | POST з заголовком `Next-Action: <id updateLeadStatus>` з `server-reference-manifest.json`, приріст `db:updateLeadStatus` у журналі |

- **Чому для заміру часу обрали `async-parallel`:** ефект видно прямо в TTFB, а на цій сторінці
  найбільша частина часу — саме послідовні запити (0,4 + 1,2 + 0,4 с). Очікування: 0,1 (user) +
  0,1 (workspace) + max(0,4; 1,2; 0,4) ≈ 1,4 с + рендер — збіглося з виміряними 1,48 с.
- **Решта виправлень** теж з числами (лічильники, байти, прямий виклик дії), хоча рубрика вимагає
  числа лише для одного:
  - `server-cache-react` — прибрали подвійні звернення до «БД»; переконались, що сторінки
    `/dashboard` і `/dashboard/leads/[id]` збираються й віддаються (заміри йшли на зібраному коді);
  - `server-serialization` — таблиця сортує й показує ті самі 5 полів; тип `LeadRow` не дає випадково
    передати зайве; збірка й lint чисті;
  - `server-auth-actions` — виправлення безпеки: власний lead працює як раніше, чужий і з фейковою
    сесією — ні. Виклик **без cookie** не запускав дію ні до, ні після виправлення (Next віддавав
    статичну `/`), тому як доказ його не рахуємо.
- **Порада скіла, яку звірили з документацією Next.js 16 і не застосували або змінили:**
  `bundle-barrel-imports` для `recharts` — у Next 16 уже оптимізований за замовчуванням
  (`optimizePackageImports.md`), у конфіг не додавали; `unauthorized()` з прикладу `server-auth-actions`
  у Next 16 експериментальний і потребує `experimental.authInterrupts` — натомість `redirect` +
  `throw`; `server-after-nonblocking` відкладено до Task D. Докладно — `docs/skill-review.md`, розділ 5.
- **Якщо виміряне виправлення не змінило чисел:** `async-parallel` змінило. `server-cache-react` не
  змінило TTFB — бо Next 16 рендерить layout і page паралельно, і дублікати запитів ішли одночасно;
  виграш — у кількості запитів до БД (3 → 1).
- **`npm run lint`, `npm run build` після виправлень:** після кожного коміту — lint без помилок і
  попереджень, build успішний (`✓ Compiled successfully`, TypeScript без помилок).
- **Ручна перевірка UI після всіх 4 виправлень** (людина, 27.09.2026, `npm run build` + `npm start`,
  вхід як Olena): `/dashboard` відкривається швидше; статистика, таблиця й сортування за колонками,
  пошук, «Експорт в Excel», графік джерел працюють; на сторінці ліда зміна статусу зберігається
  після оновлення сторінки; видалення ліда повертає на дашборд, і ліда в списку більше немає.
  Регресій не виявлено.

## Task B — `building-client-form`

_далі_

## Task C — `integrating-n8n-webhooks`

_далі_
