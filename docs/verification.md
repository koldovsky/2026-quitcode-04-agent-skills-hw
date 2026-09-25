# Перевірка (Task A–C)

> Сюди — лише те, що справді сталося: цитати, числа, імена файлів, SHA комітів.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code 2.1.280 (десктоп-застосунок, вкладка Code) · Opus 5.5 (`claude-opus-5-5`)
- **ОС і термінал, Node:** Windows 10 Pro 19045 · Git Bash (команди агента) і PowerShell (встановлення скіла людиною) · Node 24.18.0

## Скіли видно у свіжій сесії

- Як перевіряли: _заповнюється після свіжої сесії (S2): `/context` → розділ Skills_

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | | |
| `building-client-form` | | |
| `integrating-n8n-webhooks` | | |

- Особисті скіли: `~/.claude/skills/` не існує. Є `~/.agents/skills/handoff` і
  `~/.codex/skills/{handoff,n8n-rag-workflows,stop-slop}` — Claude Code ці теки не читає (їх читають
  Cursor/Codex), тож на перевірки в Claude Code вони не впливають.

## Task A — виправлення за скілом Vercel

Скіл: `.claude/skills/vercel-react-best-practices/` (коміт `26b0a11`, тег
`agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278`, 75 файлів, `skills-lock.json`). Рев'ю до
встановлення — `docs/skill-review.md` (коміт `12c04f6`, раніше за встановлення).

### Рев'ю застосунку за скілом

Зроблено агентом за правилами скіла (читання `rules/<id>.md`) для `app/`, `components/`, `lib/`; кожну
пораду звірено з `node_modules/next/dist/docs/` (Next.js 16.3.5). Рядки — для коду `main` (`01a7dd4`).

| Файл:рядок | id правила | Що не так | Виправлення для Next.js 16 | Статус |
|---|---|---|---|---|
| `app/dashboard/page.tsx:16-18` | `async-parallel` | `getLeads` (400 мс), `getLeadStats` (1200 мс), `getSourceBreakdown` (400 мс) незалежні, але чекаються по черзі | `Promise.all` | ✅ `9be2047` |
| `lib/data.ts:7`, `lib/data.ts:18` + 4 місця виклику | `server-cache-react` | `getCurrentUser()` без `cache()` — викликається в layout, header і page; `getWorkspace` у `cache()`, але з інлайн-об'єктом `{ slug }` — `Object.is` дає промах щоразу | `cache()` для `getCurrentUser`, `getWorkspace(slug: string)` | ✅ `bece8c3` |
| `app/dashboard/page.tsx:32` → `components/leads-table.tsx:12` | `server-serialization` | Client Component отримує повні записи лідів (email, телефон, IP, `rawPayload`, внутрішні нотатки), а показує 5 полів | тип `LeadListItem` і вибір полів у `lib/data.ts` | ✅ `3e19f11` |
| `app/dashboard/page.tsx:17` (`getLeadStats`, 1200 мс) | `async-suspense-boundaries` | найповільніший запит тримає всю сторінку | статистику — окремим async-компонентом за `<Suspense>` | не робили |
| `app/actions.ts:68-77` | `server-auth-actions` | `updateLeadStatus` і `deleteLead` — публічні POST-ендпоінти без перевірки сесії й належності ліда до workspace | перевірка сесії й workspace всередині дії | не робили (див. нижче) |
| `app/actions.ts:53-63` | `server-after-nonblocking` | форма чекає виклик n8n і `logAudit` (250 мс) перед відповіддю | повільне — в `after()` | не робили: виклик n8n змінюємо лише в Task D |
| `components/leads-toolbar.tsx:4` | `bundle-conditional` | `exceljs` вантажиться з дашбордом, хоча потрібен лише після «Експорт в Excel» | `await import("exceljs")` в обробнику кліку | не робили |
| `components/leads-toolbar.tsx:6` | `bundle-dynamic-imports` | графік з `recharts` у бандлі сторінки, хоча за замовчуванням прихований | `next/dynamic` для `SourcesChart` | не робили |
| `components/lead-search.tsx:20-24` | `client-swr-dedup` | після рендеру ще раз тягне `/api/leads` (усі ліди з email і телефоном), хоча сторінка їх уже має | отримувати рядки з сервера пропсом | не робили |
| `components/lead-search.tsx:43-45` | `rerender-derived-state-no-effect` | результати пошуку — у `useState`, що оновлюється з `useEffect` | обчислювати під час рендеру | не робили |
| `components/lead-search.tsx:5` | `bundle-barrel-imports` | `import { debounce } from "lodash"` — `lodash` (не `lodash-es`) не входить у пакети, які Next.js 16 оптимізує за замовчуванням | `import debounce from "lodash/debounce"` | не робили |

### Виправлення

**Як міряли:** продакшн-збірка `npm run build && npm start` на `http://localhost:3000` (перед кожним
заміром — перевірка, що відповідає саме LeadDesk: `X-Powered-By: Next.js`, `<title>LeadDesk`);
cookie демо-користувачки Olena `leaddesk_session=demo-u_olena`; один прогрівальний запит, далі 3 прогони:

```bash
C="leaddesk_session=demo-u_olena"; U=http://localhost:3000/dashboard
curl -s -o /dev/null -b "$C" "$U"                                   # прогрів
for i in 1 2 3; do curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" "$U"; done
curl -s  -b "$C" "$U" | wc -c                                       # HTML, байти
curl -sL -b "$C" -H "RSC: 1" "$U" | wc -c                           # RSC, байти
```

Лічильники `db:<запит>` — рядки журналу `npm start`, що додались після **одного** `curl` сторінки.
Поля ліда в RSC — `curl -sL -b "$C" -H "RSC: 1" "$U" | grep -oE '"(email|phone|internalNotes|rawPayload|ipAddress)":' | sort | uniq -c`.
Сервер перезапускався після кожного виправлення (нова збірка). Кожен рядок нижче — окремий коміт
поверх попереднього.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `9be2047` | `app/dashboard/page.tsx` | три незалежні запити workspace — через `Promise.all` | TTFB 2,312 / 2,301 / 2,281 с | TTFB **1,478 / 1,480 / 1,480 с** | `curl` × 3 після прогріву |
| `server-cache-react` | `bece8c3` | `lib/data.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` у `cache()`; `getWorkspace(slug)` з примітивним ключем | за один `GET /dashboard`: `db:getUserBySession` **3**, `db:getWorkspace` **3** | `db:getUserBySession` **1**, `db:getWorkspace` **1** (TTFB 1,470 / 1,483 / 1,480 с — без змін) | лічильники в журналі `npm start` |
| `server-serialization` | `3e19f11` | `lib/types.ts`, `lib/data.ts`, `components/leads-table.tsx` | `LeadsTable` отримує `LeadListItem` (5 полів) замість повного `Lead` | HTML 424 592 Б, RSC 315 197 Б; у RSC `email` ×344, `phone` ×344, `internalNotes` ×172, `rawPayload` ×172, `ipAddress` ×172 | HTML **111 377 Б**, RSC **31 257 Б**; жодного з цих полів | `wc -c`, `grep -oE` по RSC |

- **Чому для заміру — `async-parallel`:** найпростіше видно в числах і саме він відповідає на скаргу
  клієнта «дашборд понад 2 секунди». Очікування — 100 + 100 + max(400, 1200, 400) ≈ 1,4 с замість
  100 + 100 + 400 + 1200 + 400 ≈ 2,2 с; виміряно 2,30 → 1,48 с. Решта ~80 мс — рендер 172 рядків.
- **`server-cache-react`:** на TTFB не вплинув — і не мав: layout і page у App Router рендеряться
  паралельно, тож зайві запити сесії й workspace не лежали на критичному шляху (довідка
  `06-fetching-data.md`, «Parallel data fetching»). Ефект — утричі менше запитів до «бази» на кожне
  відкриття дашборду. Перевірили, що не зламали: `/dashboard/leads/lead_0023` → 200 з іменем ліда;
  `/dashboard` без cookie → 307 на `/login`.
- **`server-serialization`:** разом з розміром зникли персональні дані, яких таблиця не показує, — це
  і продуктивність, і приватність (`02-guides/data-security.md`: віддавати лише те, що потрібно UI).
  Перевірили: у HTML 173 `<tr>` (заголовок + 172 ліди), жодного `@….example.test`; сортування
  працює з тими самими полями (`createdAt`, `fullName`, `company`) — `tsc` у `npm run build` це
  перевіряє.
- **Порада скіла, звірена з документацією Next.js 16 і не застосована:** `bundle-barrel-imports`
  радить додати пакет в `experimental.optimizePackageImports` — для `recharts` це вже зроблено в
  Next.js 16.3.5 за замовчуванням (`optimizePackageImports.md`, список «optimized by default»), тож
  конфіг не чіпали. `server-after-nonblocking` і `server-auth-actions` для `app/actions.ts` свідомо
  відклали: у цьому файлі живе виклик n8n, а зміни в ньому до BASE (Task D) дали б прогону A частину
  контракту задарма. Решта рядків «не робили» — поза «досить двох», залишено як знахідки рев'ю.
- **Чи змінили числа виміряні виправлення:** так — `async-parallel` TTFB −36 %,
  `server-cache-react` запити 3 → 1, `server-serialization` RSC у 10 разів менше.
- **Невдалий замір, який не пішов у таблицю:** перший замір після `async-parallel` показав TTFB
  0,24 с і HTML 72 Б — на `localhost:3000` тоді відповідав інший локальний застосунок
  (`X-Powered-By: Express`, `404 Cannot GET /dashboard`). Після того як порт звільнився, заміри
  повторили; відтоді перед кожним заміром перевіряємо заголовок `X-Powered-By: Next.js`.
- **`npm run lint`, `npm run build` після кожного виправлення:** без помилок і попереджень
  (`✓ Compiled successfully`).

## Task B — `building-client-form`

_Заповнюється після Task B._

## Task C — `integrating-n8n-webhooks`

_Заповнюється після Task C._
