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

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- **Що лишили в `SKILL.md`, а що винесли в `references/`.** У `SKILL.md` (132 рядки) — схема двох
  сторін, контракт у 8 пунктах (env, один модуль з `server-only`, запит і заголовки, таймаут і
  повтори, хто чекає, 10 кроків колбека одним абзацом, журнали, заборона `edge`), чекліст із 10
  пунктів, правила зупинки, Verify і перелік файлів. «Чому» й деталі — у `references/`, по одному
  рівню з прямими посиланнями:
  `contract.md` (env, запит, конверт, таймаут, повтори, test vs production URL, ідемпотентність,
  реєстр), `response-modes.md` (режими й правило 100 с / 524), `callback.md` (порядок обробки й
  чому, таблиця кодів), `logging-and-limits.md`, `code-templates.md` (готові `lib/n8n/client.ts`,
  Server Action з `after()`, `app/api/n8n/[event]/route.ts`, сховище ключів, `.env.example`),
  `n8n-setup.md` (налаштування n8n текстом для клієнта), `pitfalls.md` (401 vs 403, «got/was
  started», Crypto v2, приклад Next.js з `?token=`). Записку не копіювали дослівно: переписано
  англійською, стисло, під дії агента; правила Vercel `server-auth-actions` і
  `server-after-nonblocking` — лише за id.
- **Правила зупинки:** тестовий URL `/webhook-test/`; секрет у клієнтському коді,
  `NEXT_PUBLIC_`, query string, журналі, повідомленні про помилку чи git, або потреба побачити
  справжній секрет; синхронне очікування воркфлоу, довшого за кілька секунд чи невідомої
  тривалості; неможливо перевірити колбек (немає секрету, n8n змінює байти після підпису);
  воркфлоу потребує повний запис, зайві персональні дані чи файли замість посилань; прохання
  створити/змінити/експортувати воркфлоу чи писати код для вузла Code; потреба в `runtime = "edge"`,
  новій залежності чи несумісній зміні конверта.
- **Скрипти:** `scripts/check-contract.mjs` (13 перевірок C1–C13, `--root`, `--changed-since`,
  `--help`, код виходу 1 при FAIL і 2 при помилці аргументів), `scripts/send-signed-callback.mjs`
  (матриця з 12 колбеків проти запущеного роуту: неправильний/відсутній підпис, прострочений і
  майбутній час, переформатоване тіло, content-type, невідома подія, ключ ≠ тіло, битий JSON,
  > 64 КБ, повтор), `scripts/mock-n8n.mjs` (копія `tools/mock-n8n.mjs`).
- SHA коміту зі скілом (BASE для Task D): _див. нижче, «BASE»_.
- Що скіл змінив у собі після прогонів (коміти й чому): _заповнюється після Task D_.

**`check-contract.mjs` на коді `main`** (`git archive main | tar -x -C ../leaddesk-main`):

```
check-contract — root: ../leaddesk-main
C1   FAIL  no test webhook URL (/webhook-test/) in code or .env.example
       .env.example:6  N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   FAIL  n8n is called and N8N_WEBHOOK_* is read only inside lib/n8n/
       app/actions.ts:54  fetch to n8n outside lib/n8n/: await fetch(process.env.N8N_WEBHOOK_URL!, {
C4   FAIL  lib/n8n/ modules start with import "server-only"
       app/actions.ts:54  n8n is used but there is no lib/n8n/ client module
C5   FAIL  every fetch to n8n has signal: AbortSignal.timeout(...)
       app/actions.ts:54  fetch without AbortSignal.timeout: await fetch(process.env.N8N_WEBHOOK_URL!, {
C6   PASS  callback route reads the raw body and parses it only after the signature check
C7   PASS  callback signature compared with timingSafeEqual, never === / !==
C8   PASS  no export const runtime = "edge"
C9   PASS  no bodies, form data, personal data or secrets in console.* calls
C10  FAIL  .env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key
       .env.example:-  missing N8N_WEBHOOK_BASE_URL
       .env.example:-  missing N8N_WEBHOOK_TOKEN
       .env.example:-  missing N8N_CALLBACK_SECRET
       .env.example:-  missing APP_BASE_URL
       .env.example:6  legacy N8N_WEBHOOK_URL (use N8N_WEBHOOK_BASE_URL + event path)
C11  FAIL  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
       app/actions.ts:54  fetch to n8n without x-n8n-token, idempotency-key, x-correlation-id
C12  FAIL  Server Actions trigger n8n inside after()
       app/actions.ts:54  n8n called outside after(): await fetch(process.env.N8N_WEBHOOK_URL!, {
C13  PASS  callback route deduplicates by the idempotency-key header

6 PASS, 7 FAIL
exit=1
```

**Що скрипт побачив на навмисно поганому коді.** Тимчасова тека з колбек-роутом, який читає
`request.json()`, порівнює підпис через `!==`, має `runtime = "edge"` і `console.log(body)`, та з
Server Action, що шле `Object.fromEntries(formData)` на `NEXT_PUBLIC_N8N_URL/webhook-test/…`
без таймауту й заголовків; `.env.example` зі справжнім на вигляд токеном. Після перевірки теку
видалено:

```
check-contract — root: ../bad-callback-fixture
C1   FAIL  no test webhook URL (/webhook-test/) in code or .env.example
       lib/quotes.ts:3  const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook-test/quote-request`, { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) })
       .env.example:1  N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook-test
C2   FAIL  no NEXT_PUBLIC_N8N_* variables
       lib/quotes.ts:3  const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook-test/quote-request`, { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) })
C3   FAIL  n8n is called and N8N_WEBHOOK_* is read only inside lib/n8n/
       lib/quotes.ts:3  fetch to n8n outside lib/n8n/: const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook-test/quote-request`, { method: "POST", body: JSON.stringify(O
C4   FAIL  lib/n8n/ modules start with import "server-only"
       lib/quotes.ts:3  n8n is used but there is no lib/n8n/ client module
C5   FAIL  every fetch to n8n has signal: AbortSignal.timeout(...)
       lib/quotes.ts:3  fetch without AbortSignal.timeout: const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook-test/quote-request`, { method: "POST", body: JSON.stringi
C6   FAIL  callback route reads the raw body and parses it only after the signature check
       app/api/n8n/[event]/route.ts:6  request body parsed with .json(): const body = await request.json();
       app/api/n8n/[event]/route.ts:5  body is not read as raw text (req.text())
C7   FAIL  callback signature compared with timingSafeEqual, never === / !==
       app/api/n8n/[event]/route.ts:10  signature compared with ===/!==: if (signature !== expected) return new Response("bad", { status: 401 });
       app/api/n8n/[event]/route.ts:1  no crypto.timingSafeEqual in the callback route
C8   FAIL  no export const runtime = "edge"
       app/api/n8n/[event]/route.ts:3  export const runtime = "edge";
C9   FAIL  no bodies, form data, personal data or secrets in console.* calls
       app/api/n8n/[event]/route.ts:7  console.log("callback body", body);
C10  FAIL  .env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key
       .env.example:2  N8N_WEBHOOK_TOKEN must be a change-me-… placeholder
       .env.example:1  N8N_WEBHOOK_BASE_URL must end with /webhook
C11  FAIL  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
       lib/quotes.ts:3  fetch to n8n without x-n8n-token, idempotency-key, x-correlation-id
C12  FAIL  Server Actions trigger n8n inside after()
       lib/quotes.ts:3  n8n called outside after(): const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook-test/quote-request`, { method: "POST", body: JSON.stringify(Obje
C13  FAIL  callback route deduplicates by the idempotency-key header
       app/api/n8n/[event]/route.ts:1  callback route never reads idempotency-key

0 PASS, 13 FAIL
exit=1
```

Окремо: роут, що читає `req.text()` і робить `JSON.parse(raw)` **до** `timingSafeEqual`, дає
`C6 FAIL … JSON.parse before the signature check` (решта PASS). І зворотний контроль — тека, зібрана
з шаблонів `references/code-templates.md`, дає 0 FAIL (перевірка не «завжди червона»); на ній же
знайшли й виправили хибне спрацювання C1 на захисному рядку `base.includes("/webhook-test")`:

```
check-contract — root: ../good-fixture-tmp
C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   PASS  n8n is called and N8N_WEBHOOK_* is read only inside lib/n8n/
C4   PASS  lib/n8n/ modules start with import "server-only"
C5   PASS  every fetch to n8n has signal: AbortSignal.timeout(...)
C6   PASS  callback route reads the raw body and parses it only after the signature check
C7   PASS  callback signature compared with timingSafeEqual, never === / !==
C8   PASS  no export const runtime = "edge"
C9   PASS  no bodies, form data, personal data or secrets in console.* calls
C10  PASS  .env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key
C11  PASS  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
C12  PASS  Server Actions trigger n8n inside after()
C13  PASS  callback route deduplicates by the idempotency-key header

13 PASS, 0 FAIL
exit=0
```

`--changed-since`: на копії `main` з новим хорошим `lib/n8n/` і новим поганим роутом (тег `base`
на старті) скрипт показав лише 5 FAIL нового роуту (C6–C9, C13) і не показав старі порушення з
`app/actions.ts` і `.env.example`; невідомий ref → код 2.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

_(заповнюється в Task D)_
