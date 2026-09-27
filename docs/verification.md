# Перевірка (Task A–C)

> Сюди — лише те, що справді сталося: цитати, числа, імена файлів, SHA комітів.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code desktop (Opus 5.5, `claude-opus-5-5`) — основна сесія; Claude Code CLI 2.1.168 — окремі свіжі сесії (`claude -p`)
- **ОС і термінал, Node:** macOS (Darwin 25.5) · zsh · Node v26.0.0

## Скіли видно у свіжій сесії

- Як перевіряли: `claude -p "/context"` з кореня репозиторію (нова сесія, розділ Skills).

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів у контексті (лише `description`); перевірено після коміту `e8cba4b` |
| `building-client-form` | | див. Task B |
| `integrating-n8n-webhooks` | | див. Task C |

- Особисті скіли: у `~/.claude/skills/` є `review-task`, але з `disable-model-invocation: true` — у
  `/context` його немає, модель його не бачить і сама не викличе. На час A/B (Task D) і тестів
  спрацювання його все одно тимчасово перенесено з `~/.claude/skills/` (див. `docs/ab-validation.md`).
- Встановлені файли збігаються з тими, що рев'ювали: `diff -r .claude/skills/vercel-react-best-practices ../review-agent-skills/skills/react-best-practices`
  → єдина різниця `Only in ../review-agent-skills/…: metadata.json` (CLI його не копіює); 75 файлів, `.agents/` немає.

## Task A — виправлення за скілом Vercel

**Як міряли:** продакшн-збірка (`npm run build && npm start`) після кожного коміту; cookie
`leaddesk_session=demo-u_olena`; `curl` на `http://localhost:3000/dashboard`: один прогрів, потім
один запит, по якому рахуємо рядки `db:<запит>`, які дописав у журнал `npm start`, потім 3 прогони
`-w "TTFB %{time_starttransfer}s, total %{time_total}s"`; розмір HTML `curl … | wc -c` і RSC
`curl -sL … -H "RSC: 1" | wc -c`; поля ліда в HTML — `grep -o '<поле>' | wc -l`. Сервер
перезапускався на кожен замір.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `4c74dfb` | `app/dashboard/page.tsx` | `getLeads` (400 мс), `getLeadStats` (1200 мс), `getSourceBreakdown` (400 мс) — з трьох послідовних `await` в один `Promise.all` | TTFB 2,246 / 2,240 / 2,239 с | TTFB 1,431 / 1,432 / 1,427 с (**−0,81 с, −36 %**) | curl, 3 прогони |
| `server-cache-react` | `dda2a7e` | `lib/data.ts`, `app/dashboard/{page,layout}.tsx`, `components/dashboard-header.tsx`, `app/dashboard/leads/[id]/page.tsx` | `getCurrentUser` обгорнуто в `cache()`; `getWorkspace` приймає `slug` рядком замість `{ slug }` | на запит `/dashboard`: `db:getUserBySession` ×3, `db:getWorkspace` ×3 | ×1 і ×1 | рядки `db:…` у журналі `npm start` за один `curl` |
| `server-serialization` | `868458e` | `app/dashboard/page.tsx`, `components/leads-table.tsx`, `lib/types.ts` | у Client Component `LeadsTable` — лише `id, fullName, company, status, createdAt` (тип `LeadRow`) замість цілого `Lead` | HTML 424 893 Б, RSC 315 197 Б; у HTML `rawPayload` ×172, `ipAddress` ×172, `userAgent` ×344 | HTML 111 678 Б (−74 %), RSC 31 257 Б (−90 %); `rawPayload`, `ipAddress`, `userAgent`, `email`, `phone`, `internalNotes` — 0 | `curl … \| wc -c`, `grep -o` |

- Чому обрали для заміру `async-parallel`: це найбільша затримка з тих, що бачить клієнт («дашборд понад
  2 секунди»), і ефект видно одразу в TTFB. Числа є й для двох інших виправлень — вони дешеві в
  замірі тим самим скриптом.
- `server-cache-react`: layout, page і `DashboardHeader` кожен кликали `getCurrentUser` і
  `getWorkspace`. `getWorkspace` уже був у `cache()`, але з inline-об'єктом `{ slug }` — `cache()`
  порівнює аргументи через `Object.is`, тож кожен виклик був промахом (саме цей випадок описано в
  правилі в розділі «Avoid inline objects as arguments»). TTFB не змінився (1,43 с): layout і page
  рендеряться паралельно, тож дублікати не лежали на критичному шляху — виграш у навантаженні на
  БД (3 → 1 запит на кожну функцію). Не зламали: `/dashboard/leads/<id>` → 200, `/dashboard` без
  cookie → 307 на `/login`.
- `server-serialization`: таблиця використовує 5 полів, а отримувала всі поля ліда, разом з
  IP, user agent, сирим тілом форми й внутрішніми нотатками. Крім розміру, це виправлення
  безпеки: `data-security.md` вимагає передавати в Client Component мінімальні DTO. Сортування й
  перехід на сторінку ліда працюють (ті самі поля `fullName`, `company`, `createdAt`, `id`).
- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували або змінили:
  `bundle-barrel-imports` радить `experimental.optimizePackageImports`, але в Next 16.3.5 опція досі
  experimental, а `recharts` у списку тих, що оптимізуються за замовчуванням, — для нас порада нічого
  не дає. `async-dependencies` і `server-cache-lru` вимагають нових залежностей (`better-all`,
  `lru-cache`), для кешу між запитами в Next 16 є `'use cache'` — не застосовували. Деталі — у
  `docs/skill-review.md`, розділ 5.
- Якщо виміряне виправлення не змінило чисел: `async-parallel` змінило; `server-cache-react` не
  змінило TTFB — пояснення вище.
- `npm run lint`, `npm run build` після кожного виправлення: без помилок.
- Виклик n8n у `app/actions.ts` (форма ліда) у Task A свідомо не чіпали: це частина контракту n8n,
  яку приводимо до ладу в Task D, інакше BASE для A/B уже містив би шматок контракту.

## Task B — `building-client-form`

_(заповнюється в Task B)_

## Task C — `integrating-n8n-webhooks`

_(заповнюється в Task C)_
