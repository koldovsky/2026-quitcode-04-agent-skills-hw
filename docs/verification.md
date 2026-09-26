# Перевірка (Task A–C)

> Прогони A/B і фіча «запит на кошторис» — в окремому звіті [`docs/ab-validation.md`](ab-validation.md) (Task D).

- **Інструмент і версія, модель:** Claude Code 2.1.283 · Opus 5.5 (`claude-opus-5-5[1m]`)
- **ОС і термінал, Node:** macOS (Darwin 24.6) · zsh · Node 22.20.0

## Скіли видно у свіжій сесії

- Як перевіряли: `claude -p "/context"` з кореня репозиторію (нова сесія) → розділ Skills.

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | ~120 токенів опису; видно одразу після встановлення (коміт `6ed80cc`) |
| `building-client-form` | Project | спрацював на звичайний запит (Task B нижче) |
| `integrating-n8n-webhooks` | Project | у копії B (Task D) — єдиний проєктний скіл, ~300 токенів |

- Особисті скіли, які теж видно: `~/.claude/skills/synced/…` — синхронізовані з claude.ai (`docs`, `docx`,
  `google-workspace`, `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`, `xlsx`) + вбудовані Claude Code
  (`dataviz`, `code-review`, `simplify`, `run`…). Жоден не про n8n, форми чи продуктивність React; у прогонах A і B
  вони однакові, тож на порівняння не впливають. Особистих копій наших трьох скілів у `~/.claude/skills`,
  `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills` немає.

## Task A — виправлення за скілом Vercel

**Як міряли:** продакшн-збірка (`npm run build && npm start`), сервер перезапускали після кожного виправлення
(перевіряли, що порт 3000 слухає процес саме з нової збірки). Cookie `leaddesk_session=demo-u_olena`,
`U=http://localhost:3000/dashboard`. Один прогрівальний `curl`, далі 3 прогони
`curl -w "TTFB %{time_starttransfer}s, total %{time_total}s"`; розмір — `curl -s … | wc -c` (HTML) і
`curl -sL -H "RSC: 1" … | wc -c` (RSC); лічильники `db:<запит>` — приріст у журналі `npm start` за один
запит; клієнтський JS — сума всіх `/_next/static/**.js`, на які посилається HTML `/dashboard` (сирі байти й gzip).

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `a8134ca` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` — `Promise.all` замість трьох послідовних `await` | TTFB 2,253 / 2,245 / 2,243 с | TTFB 1,429 / 1,427 / 1,435 с | `curl` ×3, TTFB |
| `server-cache-react` | `7e66882` | `lib/data.ts`, 4 виклики | `getCurrentUser` у `cache()`; `getWorkspace(slug)` з примітивом замість inline-об'єкта | 3× `db:getUserBySession`, 3× `db:getWorkspace` на запит | 1× і 1× | лічильники `db:` за один `curl` |
| `server-serialization` | `9fcc046` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у Client Component `LeadsTable` — лише 5 полів (`LeadRow`) замість повного `Lead` | HTML 424 592 Б, RSC 315 197 Б; `rawPayload`/`ipAddress`/`internalNotes` у HTML — по 172 рази | HTML 111 377 Б, RSC 31 257 Б; 0 / 0 / 0 | `curl … \| wc -c`, `grep -o` |
| `bundle-conditional` | `59e2374` | `components/leads-toolbar.tsx` | `exceljs` — `await import("exceljs")` у обробнику «Експорт» | початковий JS 1 871 692 Б (gzip 538 252) | 941 001 Б (gzip 282 762); exceljs — окремий чанк 930 904 Б, вантажиться на клік | сума JS з HTML |
| `bundle-dynamic-imports` | `a73589a` | `components/leads-toolbar.tsx` | графік `recharts` — `next/dynamic(..., { ssr: false })` у Client Component | 941 001 Б (gzip 282 762) | 587 212 Б (gzip 181 721) | сума JS з HTML |
| `server-auth-actions` | `8763b3a` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` перевіряють сесію, workspace ліда і валідний статус | (без заміру продуктивності) | (без заміру) | — див. нижче |

**Разом по `/dashboard`:** TTFB 2,25 → 1,42 с (−37 %), HTML 425 → 111 КБ, RSC 315 → 31 КБ, початковий JS
1,87 МБ → 0,59 МБ (gzip 538 → 182 КБ), запитів до БД на сторінку 9 → 5.

- **Чому для заміру обрали `async-parallel`:** найбільший і найпростіше відтворюваний ефект на скаргу клієнта
  («дашборд > 2 с»). У `lib/db.ts` затримки детерміновані (100+100 → 400 → 1200 → 400 мс), тож очікування
  «2,2 с → 1,4 с» (сесія + workspace + найдовший запит 1200 мс) збіглося з заміром до сотих.
- **`server-cache-react` не змінив TTFB — і це очікувано:** layout, header і page Next.js рендерить паралельно,
  тож три однакові запити йшли одночасно. Виграш — навантаження на БД (6 → 2 запити), не час.
  Заразом знахідка: `getWorkspace` уже був у `cache()`, але приймав `{ slug }` — inline-об'єкт щоразу
  новий, кеш ніколи не спрацьовував (саме цей антипатерн описує правило).
- **`server-serialization`** — це ще й безпека: до браузера доходили IP, user agent, сирий payload форми й
  внутрішні нотатки менеджерів для всіх 172 лідів.
- **`server-auth-actions`** — як переконались: викликали дію напряму (`POST` з заголовком `Next-Action`,
  id дії з `.next/server/server-reference-manifest.json`) на лід `lead_0007` іншого workspace.
  До виправлення: з підробленою cookie `demo-intruder` → HTTP 200, статус чужого ліда змінився на «Новий».
  Після: `demo-intruder` і `demo-u_olena` (чужий workspace) → HTTP 500, статус без змін; власник (`demo-u_marta`) → 200.
  Причина: `proxy.ts` перевіряє лише **наявність** cookie, не її дійсність.
- **Поради, звірені з документацією Next.js 16 і змінені/не застосовані:**
  - `bundle-dynamic-imports` радить `next/dynamic(..., { ssr: false })` — у Next.js 16 це **помилка збірки**
    у Server Component (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:94`). Застосували лише
    всередині Client Component `LeadsToolbar`; для exceljs узяли простіший `await import()` на клік (`bundle-conditional`).
  - `bundle-barrel-imports` радить додати бібліотеки в `experimental.optimizePackageImports` — `recharts`
    Next.js 16 уже оптимізує за замовчуванням (`optimizePackageImports.md`), тож для нього порада зайва.
    `lodash` (CJS) у списку немає; `lodash.debounce` у пошуку лишили як є — це клієнтський пошук поза
    критичним шляхом, окремого заміру не робили.
  - `async-suspense-boundaries` (стрімінг статистики через `<Suspense>`) — не застосовували: після
    `Promise.all` найдовший запит (1200 мс) і так визначає TTFB, а стрімінг змінив би UX (скелетони) — це
    рішення з клієнтом, а не механічне виправлення.
- `npm run lint`, `npm run build` після кожного виправлення: без помилок.

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо), `claude -p --output-format stream-json --verbose --permission-mode acceptEdits`
  з кореня репозиторію, Opus 5.5:
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до
  > 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- **Чи спрацював скіл:** так, з першої спроби — у журналі сесії (`run.jsonl`) виклик інструмента `Skill` з
  `"skill":"building-client-form"` (`grep -o '"skill":"[^"]*"'` → 2 збіги: виклик і результат). Фінальна
  відповідь агента: «built with the project's `building-client-form` pattern». `description` не змінювали.
- Що зроблено (коміт `c4b72cf`): `lib/note-form.ts` (чиста валідація: trim, не порожня, ≤ 500, повертає
  `values`), `app/dashboard/leads/[id]/actions.ts` (Server Action `addNote`: сесія → валідація → лід належить
  workspace → запис → `after(logAudit)` → `{ status }`), `components/note-form.tsx` (`useActionState`, label,
  `aria-invalid`/`aria-describedby`, `role="alert"`, `defaultValue` з `values`, «Надсилаємо…»),
  `lib/db.ts` (`appendLeadNote`), сторінка ліда (форма + `whitespace-pre-line` для нотаток).
  Агент сам помітив, що `updateLeadStatus`/`deleteLead` без перевірки сесії, і запропонував виправити — це
  стало виправленням `server-auth-actions` у Task A.
- Пункти Verify (перевіряли самі, прод-збірка; форму відправляли **як браузер без JS** — multipart POST з
  прихованими полями `$ACTION_REF_1`, `$ACTION_1:*`, `$ACTION_KEY` з HTML сторінки):

  | Пункт Verify | Результат |
  |---|---|
  | `npm run lint`, `npm run build` | ✅ без помилок |
  | Порожня відправка | ✅ 200; «Напишіть текст нотатки», `aria-invalid="true"`, `role="alert"` «Перевірте поле нотатки» |
  | Помилка не стирає введене | ✅ 501 символ → «Не більше 500 символів (зараз 501)», текст лишився в `<textarea>` |
  | Відправка без JS | ✅ валідна нотатка → 200 «Нотатку додано.», нотатка на сторінці ліда |
  | Дія без сесії | ✅ без cookie — `proxy.ts` → 307; **з підробленою cookie** (`demo-intruder`, proxy її пропускає) дія відхилила, нотатка не збереглась |
  | Чужий запис | ✅ `leadId=lead_0007` (workspace brightline) від Olena → «Лід не знайдено або він недоступний.», у лід не записано |
  | Журнал сервера | ✅ лише `lead.note_added { leadId: 'lead_0002' }`; тексту нотатки, email, телефону — 0 збігів |
  | Час відповіді | ✅ ~0,5 с (сесія 100 + лід 80 + запис 80 мс); аудит (250 мс) — в `after()` |

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал мока й час
відповіді форми — у [`docs/ab-validation.md`](ab-validation.md).

- **Що лишили в `SKILL.md`, а що винесли в `references/`:** у `SKILL.md` (131 рядок) — схема двох сторін,
  контракт стисло (змінні, 5 правил виклику, режим, 10 кроків колбека одним абзацом, журнали), порядок роботи
  агента, чекліст із прив'язкою до id перевірок C1–C15, правила зупинки, Verify. У `references/` — те, що
  потрібно лише під час написання коду: `outbound-webhook.md` (таблиця змінних, заголовки, конверт, повтори,
  **шаблони** `lib/n8n/client.ts` і Server Action), `callback-route.md` (таблиця 10 кроків з кодами відповідей
  і «чому», шаблон роуту), `response-modes.md` (режими, 100 с, test vs prod URL, ліміти, журнали, пастки),
  `n8n-setup.md` (налаштування вузлів текстом для клієнта, мок, реєстр). Посилання з `SKILL.md` — прямі, один рівень.
  Правила Vercel `server-auth-actions` і `server-after-nonblocking` — посиланням за id, не копією.
- **Правила зупинки:** тестовий URL або «поки без токена/підпису»; секрет у клієнтському коді / `NEXT_PUBLIC_*` /
  query string / журналі / git; синхронне очікування довгого воркфлоу; зміна воркфлоу в n8n, JSON чи код для
  вузла Code; випадок поза контрактом (інша схема підпису чи auth, колбек без підпису, файли замість посилань,
  > 64 КБ); нова залежність. Без винятків «якщо задача цього потребує».
- **Скрипти:** `check-contract.mjs` (15 перевірок C1–C15, `--root`, `--changed-since`, `--json`, `--help`,
  коди виходу 0/1/2, лише `node:` модулі), `send-signed-callback.mjs` (матриця з 9 колбеків з очікуваними
  кодами), `mock-n8n.mjs` (копія `tools/mock-n8n.mjs`).
- Під час написання скрипт сам себе «зловив» на недоліках, виправлено до коміту: хибний FAIL на правильному
  `signatureBuf.length !== expected.length` перед `timingSafeEqual`; C14 не бачив `console.log(process.env.N8N_WEBHOOK_TOKEN)`.
  Одну деталь довідки перевірили й виправили: пакет `server-only` у Next.js 16 **не треба** встановлювати
  (`05-server-and-client-components.md`: «optional»), Next.js аліасить його сам.
- **SHA коміту зі скілом (BASE для Task D):** `e41feb5`
- **Що скіл змінив у собі після прогонів:** коміт `8c9cb02` — `check-contract.mjs` (1) рахує будь-яку
  `process.env.N8N_*` (крім секрету колбека) викликом n8n і будь-який route з `callback` у шляху чи згадкою n8n —
  колбеком: без цього код прогону A (`N8N_QUOTE_WEBHOOK_URL`, `app/api/quotes/[id]/callback`) проходив C3–C15 порожньо;
  (2) не рахує коментарі в C1 — хибний FAIL на коментарі `.env.example` прогону B; (3) C4 звітує по кожному файлу з
  викликом n8n. Деталі — `docs/ab-validation.md`, «Що змінили в скілі».

**`check-contract.mjs` на коді `main`** (`git archive main | tar -x -C ../leaddesk-main`):

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ../leaddesk-main; echo "exit=$?"
check-contract: ../leaddesk-main
scope: whole project

C1   FAIL  no test webhook URL (/webhook-test/) in code or .env.example
      .env.example:6  N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2   PASS  no N8N_* variable with NEXT_PUBLIC_ prefix
C3   FAIL  n8n is called only from lib/n8n/client.ts
      app/actions.ts:54  await fetch(process.env.N8N_WEBHOOK_URL!, {
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
      app/actions.ts:54  n8n is called here, but lib/n8n/client.ts does not exist
C5   FAIL  every fetch() to n8n has a timeout signal
      app/actions.ts:54  fetch() without signal: AbortSignal.timeout(10_000)
C6   N/A   n8n client sends x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  .env.example lists the contract keys with safe values
      .env.example  missing N8N_WEBHOOK_BASE_URL
      .env.example  missing N8N_WEBHOOK_TOKEN
      .env.example  missing N8N_CALLBACK_SECRET
      .env.example  missing APP_BASE_URL
      .env.example:6  legacy N8N_WEBHOOK_URL — use N8N_WEBHOOK_BASE_URL + event path
C8   FAIL  Server Actions do not wait for n8n (call runs inside after())
      app/actions.ts:54  Server Action reaches n8n without after(): the user waits for the webhook
C9   N/A   callback reads the raw body; no .json()/JSON.parse before the signature check
C10  N/A   callback signature compared with crypto.timingSafeEqual, not ===
C11  N/A   callback rejects x-n8n-timestamp outside a 300 s window
C12  N/A   callback deduplicates by idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  n8n code does not log bodies, headers, secrets or personal data
C15  FAIL  request body is the envelope {version, event, data}, not a whole DB row
      app/actions.ts:54  body is JSON.stringify(lead) — send { version, event, data } with minimal data

3 PASS, 7 FAIL, 5 N/A
exit=1
```

Це й пояснює «перша знахідка» з налаштування: форма шле в n8n весь рядок ліда (з IP, user agent, сирими даними
форми) на тестовий URL без токена й таймауту, чекаючи відповідь синхронно, а помилку ковтає — тому мок пише
`404`, а форма каже «Дякуємо».

**Що скрипт побачив на навмисно поганому коді** (тимчасова тека `../leaddesk-bad`: колбек-роут з `req.json()`,
`!==` для підпису, `runtime = "edge"`, `console.log(body)`; клієнт без `server-only`, таймауту й заголовків;
компонент з `NEXT_PUBLIC_N8N_WEBHOOK_URL` і `/webhook-test/`; `.env.example` зі справжнім на вигляд токеном):

```
C1   FAIL  … components/quote.tsx:2  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ?? "http://127.0.0.1:5678/webhook-test/quote-request";
C2   FAIL  … components/quote.tsx:2
C3   FAIL  … components/quote.tsx:2
C4   FAIL  … lib/n8n/client.ts:1  first statement is not import "server-only"
C5   FAIL  … lib/n8n/client.ts:2  fetch() without signal: AbortSignal.timeout(10_000)
C6   FAIL  … lib/n8n/client.ts  header "x-n8n-token" / "idempotency-key" / "x-correlation-id" is never set
C7   FAIL  … .env.example:2  N8N_WEBHOOK_TOKEN must be a change-me-… placeholder
C8   N/A
C9   FAIL  … app/api/n8n/[event]/route.ts:4  request.json() — read await req.text() and verify first
C10  FAIL  … route.ts  no crypto.timingSafeEqual in callback code
           … route.ts:8  if (signature !== `sha256=${expected}`) return new Response("bad", { status: 401 });
C11  FAIL  … route.ts  x-n8n-timestamp is never read
C12  FAIL  … route.ts  idempotency-key header is never read / no {"duplicate": true} response
C13  FAIL  … route.ts:2  export const runtime = "edge";
C14  FAIL  … route.ts:9  console.log("n8n callback", body);
C15  FAIL  … lib/n8n/client.ts:2  body is JSON.stringify(data) — send { version, event, data } with minimal data
0 PASS, 14 FAIL, 1 N/A   exit=1
```

Друга версія поганого коду (роут з `req.text()`, `timingSafeEqual`, вікном 300 с і `duplicate`, але
`JSON.parse` **до** перевірки підпису; Server Action, що `await`-ить клієнт без `after()`):

```
C8   FAIL  app/quotes/actions.ts:2  Server Action reaches n8n without after(): the user waits for the webhook
C9   FAIL  app/api/n8n/[event]/route.ts:4  JSON.parse before the signature is verified
C10  PASS  (a.length !== b.length || !crypto.timingSafeEqual(a, b) — порівняння довжин не вважається помилкою)
C11  PASS · C12 PASS
```

`--changed-since base` на тій самій теці після двох змін (рядок у `lib/n8n/client.ts`, новий `lib/new-file.ts`)
показав лише FAIL на нових рядках (C3 `lib/new-file.ts:1`, C5 `lib/n8n/client.ts:10`, C6, C14), а старі FAIL
(C4 на рядку 1, що не змінювався) — відсік. Неіснуючий ref → `exit=2` з поясненням.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs; echo "exit=$?"
check-contract: .
scope: whole project

C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no N8N_* variable with NEXT_PUBLIC_ prefix
C3   PASS  n8n is called only from lib/n8n/client.ts
C4   PASS  lib/n8n/client.ts exists and starts with import "server-only"
C5   PASS  every fetch() to n8n has a timeout signal
C6   PASS  n8n client sends x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  .env.example lists the contract keys with safe values
C8   PASS  Server Actions do not wait for n8n (call runs inside after())
C9   PASS  callback reads the raw body; no .json()/JSON.parse before the signature check
C10  PASS  callback signature compared with crypto.timingSafeEqual, not ===
C11  PASS  callback rejects x-n8n-timestamp outside a 300 s window
C12  PASS  callback deduplicates by idempotency-key
C13  PASS  no runtime = "edge"
C14  PASS  n8n code does not log bodies, headers, secrets or personal data
C15  PASS  request body is the envelope {version, event, data}, not a whole DB row

15 PASS, 0 FAIL, 0 N/A
exit=0
```

**Матриця колбеків** (`send-signed-callback.mjs` проти `app/api/n8n/[event]/route.ts` на гілці, прод-збірка):

| Випадок | Очікуваний код | Отриманий |
|---|---|---|
| valid | 202 | 202 |
| repeat (ті самі байти й ключ) | 200 `{"duplicate":true}` | 200, duplicate=true |
| bad-signature | 401 | 401 |
| stale-timestamp (−600 с) | 401 | 401 |
| reformatted-body (переформатоване після підпису) | 401 | 401 |
| key-mismatch (ключ ≠ `jobId:event`) | 400 | 400 |
| wrong-type (`text/plain`) | 415 | 415 |
| unknown-event | 404 | 404 |
| too-large (> 64 КБ) | 413 | 413 |

## Task E2 (бонус) — тест спрацювання

Обрано E2 для `integrating-n8n-webhooks`: 10 запитів, кожен у новій сесії, **10/10** за очікуванням (5 мають
спрацювати, 5 схожих — ні). Таблиця й висновки — [`docs/trigger-evals.md`](trigger-evals.md).
