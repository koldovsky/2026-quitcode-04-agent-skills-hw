# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`, Task D. **A — без скіла, B — зі
> скілом.** Числа й цитати — із журналів сесій (`stream-json`), мока й сервера.

- **Інструмент і версія:** Claude Code CLI 2.1.168, свіжі headless-сесії `claude -p` (оркестрував прогони
  Claude Code desktop, Opus 5.5 — у самих прогонах він не брав участі)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-4-8`, `--effort high`
  (CLI 2.1.168 не підтримує Opus 5.5; обидва прогони — однаковий скрипт `run-arm.sh`, відрізняється лише тека)
- **Однакові прапорці:** `--output-format stream-json --verbose --permission-mode acceptEdits
  --allowedTools "Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc:*),Bash(node:*),Bash(ls:*)"`;
  решта Bash-команд у `-p` автоматично відхиляється (див. «Відхилені дозволи»)
- **Код:** BASE = `0d9556c` (три скіли, виправлення Task A, документи; без `/quotes` і без змін у виклику n8n) ·
  скіл `integrating-n8n-webhooks` для копії B — з того самого `0d9556c` (HEAD на момент копіювання)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`);
  у кожній — `git init`, коміт `start` з тегом `base`
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks`). Перевірено: `find … -name SKILL.md` →
  рівно один рядок `../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`; `ls -A` → «no hints - ok»;
  `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a` → «no contract - ok».
  В обох лишився `skills-lock.json` (лише запис про скіл Vercel, однаковий у копіях).
- **Особисті копії скіла:** `~/.claude/skills` порожня (особистий `review-task` на час прогонів перенесено в
  `~/.claude/skills-disabled/`), `~/.cursor/skills`, `~/.agents/skills` немає, `~/.codex/skills` порожня
- **Запит:** текст між лініями з `materials/ab-task.md`, без змін (той самий файл `prompt-ab.txt` для обох прогонів), нова сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** агенти не питали, як діяти; обидва закінчили роботу й лише
  запропонували наступний крок у фінальній відповіді (на це не відповідали)
- **Звернення поза теку копії:** 0 в обох прогонах (жодного `Read`/`Bash` з шляхом поза копією)
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  — `N8N_WEBHOOK_TOKEN` у `.env.local` вмикає Header Auth, `N8N_CALLBACK_SECRET` — підписаний колбек;
  `--callback-url` не знадобився: обидва застосунки передають `callbackUrl`
- **Сценарій:** `npm run build && npm start` у копії → `/quotes/new` у браузері (форма заповнена тими самими
  значеннями, відправка `form.requestSubmit()`) → час POST Server Action з Performance API → колбек у журналі
  мока → `/quotes/<id>`
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): 7 PASS, 7 FAIL
  (C1, C3, C4, C5, C10, C11, C12 — усі в старому `app/actions.ts:54` і `.env.example`) — старий код, в оцінку
  прогонів не йде:
  ```
check-contract — root: ../leaddesk-ab-a
C1   FAIL  no test webhook URL (/webhook-test/) in code or .env.example
       .env.example:6  N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   FAIL  n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/
       app/actions.ts:54  fetch to n8n outside lib/n8n/: await fetch(process.env.N8N_WEBHOOK_URL!, {
       app/quotes/actions.ts:34  fetch to n8n outside lib/n8n/: const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C4   FAIL  lib/n8n/ modules start with import "server-only"
       app/actions.ts:54  n8n is used but there is no lib/n8n/ client module
C5   FAIL  every fetch to n8n has signal: AbortSignal.timeout(...)
       app/actions.ts:54  fetch without AbortSignal.timeout: await fetch(process.env.N8N_WEBHOOK_URL!, {
       app/quotes/actions.ts:34  fetch without AbortSignal.timeout: const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C6   FAIL  callback route reads the raw body and parses it only after the signature check
       app/api/quotes/[id]/callback/route.ts:29  request body parsed with .json(): body = await request.json();
       app/api/quotes/[id]/callback/route.ts:20  body is not read as raw text (req.text())
C7   FAIL  callback signature compared with timingSafeEqual, never === / !==
       app/api/quotes/[id]/callback/route.ts:17  signature compared with ===/!==: return header === expected;
       app/api/quotes/[id]/callback/route.ts:1  no crypto.timingSafeEqual in the callback route
C8   PASS  no export const runtime = "edge"
C9   PASS  no bodies, form data, personal data or secrets in console.* calls
C10  FAIL  .env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key
       .env.example:-  missing N8N_WEBHOOK_BASE_URL
       .env.example:-  missing N8N_WEBHOOK_TOKEN
       .env.example:-  missing APP_BASE_URL
       .env.example:15  N8N_CALLBACK_SECRET must be a change-me-… placeholder
       .env.example:6  legacy N8N_WEBHOOK_URL (use N8N_WEBHOOK_BASE_URL + event path)
C11  FAIL  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
       app/actions.ts:54  fetch to n8n without x-n8n-token, idempotency-key, x-correlation-id
       app/quotes/actions.ts:34  fetch to n8n without x-n8n-token, idempotency-key, x-correlation-id
C12  FAIL  Server Actions trigger n8n inside after()
       app/actions.ts:54  n8n called outside after(): await fetch(process.env.N8N_WEBHOOK_URL!, {
       app/quotes/actions.ts:34  n8n called outside after(): const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C13  FAIL  callback route deduplicates by the idempotency-key header
       app/api/quotes/[id]/callback/route.ts:1  callback route never reads idempotency-key
C14  FAIL  N8N_CALLBACK_SECRET is used only in callback routes
       app/quotes/actions.ts:44  callback secret used outside the callback route: callbackSecret: process.env.N8N_CALLBACK_SECRET,

3 PASS, 11 FAIL
  ```

## A — без скіла

- Які скіли бачив агент (`claude -p "/context"` у копії, окремий запуск): жодного проєктного; лише вбудовані (14)
- Що зробив агент: тип `Quote` і сховище в `lib/db.ts`; `/quotes/new` з формою на `useActionState`;
  Server Action `requestQuote`, який **синхронно** робить `fetch(process.env.N8N_QUOTE_WEBHOOK_URL!)` без
  таймауту й без токена, передає в тілі `callbackUrl`, зібраний із заголовка `host`, **і
  `callbackSecret: process.env.N8N_CALLBACK_SECRET`**, потім `redirect`; колбек
  `POST /api/quotes/[id]/callback`: порівнює заголовок `x-callback-secret` (або `Bearer`) з секретом через
  `===`, читає `request.json()`, без часового вікна й ідемпотентності; `/quotes/[id]` з автооновленням.
  Правильно вгадав головне: воркфлоу довгий → не чекати його, а приймати колбек.
- Звідки агент узяв домовленості: з наявного коду (`app/actions.ts`, `lib/lead-form.ts`, `components/lead-form.tsx`)
  і документації Next.js у `node_modules` (прочитав `03-file-conventions/route.md`); контракту n8n ніде не
  було — схему авторизації колбека («спільний секрет у заголовку») агент вигадав сам
- Фінальна відповідь (скорочено): «Server Action … POSTs to the published `quote-request` workflow
  (`N8N_QUOTE_WEBHOOK_URL`), passing … a `callbackUrl` … It does not block on the 40–90s run — the webhook
  trigger returns immediately… Auth: fail-closed — requires a shared secret (`x-callback-secret` header or
  `Authorization: Bearer`)… configure n8n to send it back as `x-callback-secret`.» Запитань не ставив
- Змінені файли (11, +479/−1): `.env.example`, `app/api/quotes/[id]/callback/route.ts`, `app/page.tsx`,
  `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`, `app/quotes/new/page.tsx`, `components/quote-form.tsx`,
  `components/quote-status-poller.tsx`, `lib/db.ts`, `lib/quote-form.ts`, `lib/types.ts`;
  діф: `docs/ab/a-without-skill.diff`
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL`, `N8N_CALLBACK_SECRET` (у `.env.example` —
  `change-me`, без дефіса-суфікса); у `.env.local` для мока додано ще `N8N_WEBHOOK_TOKEN`
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` — лише код прогону:
  ```
check-contract — root: ../leaddesk-ab-a, changed since base (11 file(s))
C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   FAIL  n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/
       app/quotes/actions.ts:34  fetch to n8n outside lib/n8n/: const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C4   PASS  lib/n8n/ modules start with import "server-only"
C5   FAIL  every fetch to n8n has signal: AbortSignal.timeout(...)
       app/quotes/actions.ts:34  fetch without AbortSignal.timeout: const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C6   FAIL  callback route reads the raw body and parses it only after the signature check
       app/api/quotes/[id]/callback/route.ts:29  request body parsed with .json(): body = await request.json();
       app/api/quotes/[id]/callback/route.ts:20  body is not read as raw text (req.text())
C7   FAIL  callback signature compared with timingSafeEqual, never === / !==
       app/api/quotes/[id]/callback/route.ts:17  signature compared with ===/!==: return header === expected;
       app/api/quotes/[id]/callback/route.ts:1  no crypto.timingSafeEqual in the callback route
C8   PASS  no export const runtime = "edge"
C9   PASS  no bodies, form data, personal data or secrets in console.* calls
C10  FAIL  .env.example: contract keys, change-me-… secrets, /webhook base URL, no legacy key
       .env.example:-  missing N8N_WEBHOOK_BASE_URL
       .env.example:-  missing N8N_WEBHOOK_TOKEN
       .env.example:-  missing APP_BASE_URL
       .env.example:15  N8N_CALLBACK_SECRET must be a change-me-… placeholder
C11  FAIL  requests to n8n send x-n8n-token, idempotency-key and x-correlation-id
       app/quotes/actions.ts:34  fetch to n8n without x-n8n-token, idempotency-key, x-correlation-id
C12  FAIL  Server Actions trigger n8n inside after()
       app/quotes/actions.ts:34  n8n called outside after(): const response = await fetch(process.env.N8N_QUOTE_WEBHOOK_URL!, {
C13  FAIL  callback route deduplicates by the idempotency-key header
       app/api/quotes/[id]/callback/route.ts:1  callback route never reads idempotency-key
C14  FAIL  N8N_CALLBACK_SECRET is used only in callback routes
       app/quotes/actions.ts:44  callback secret used outside the callback route: callbackSecret: process.env.N8N_CALLBACK_SECRET,

5 PASS, 9 FAIL
  ```
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
POST /webhook/quote-request -> 403 in 6 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 354 B sha256=6166e12ec432c4733fa43d5ae8f24573d30bf05ae50ffb8a4f9ffc2c9541511d
  ```
- Час від «Надіслати» до відповіді форми: **669 мс** (POST Server Action; сюди входить синхронний виклик
  n8n — тут швидкий лише тому, що мок одразу відповів 403)
- Що показала `/quotes/quote_0001`: «Не вдалося підготувати кошторис · Не вдалося запустити підготовку
  кошторису» — воркфлоу не запустився (403, токена немає), колбека не було
- Журнал сервера: персональних даних немає (`grep` email/компанії/опису → 0), але в журнал пішов стек
  помилки `Error: n8n responded 403 at j (.next/server/chunks/…)`:
  ```
db:insertQuote: 1
db:insertAuditEntry: 1
Failed to trigger quote workflow for quote_0001 Error: n8n responded 403
    at j (.next/server/chunks/ssr/_0j9s5_d._.js:1:1335)
db:updateQuoteResult: 1
db:getQuote: 1
db:getQuote: 2
  ```
- **Додатково (не основний сценарій):** той самий застосунок A з моком **без** Header Auth (лише
  `N8N_CALLBACK_SECRET`) — щоб побачити колбек. Форма 574 мс; воркфлоу запустився, але підписаний колбек
  n8n роут відхилив, і запит назавжди лишився «Готуємо кошторис…»:
  ```
POST /webhook/quote-request -> 202 in 6 ms auth=none idempotency=absent | headers: accept,accept-language,content-type,user-agent | body 354 B sha256=d0ec5091071882ff7c0aea3d37975aa325f3d018c02a59f443144fdbf4ea9725
workflow 9ef90a71-b4c3-43c0-841c-a174e9b544c5 running for 5000 ms, then callback event=quote-request.completed
callback POST http://localhost:3000/api/quotes/quote_0001/callback -> 401 in 54 ms (try 1/3) event=quote-request.completed body 314 B sha256=b399099dbd6e36da999efc5f2d242adfc43c76b55987dbb42acaf8bf9da436bc
stopping (SIGTERM)
  ```

## B — зі скілом

- Які скіли бачив агент (`claude -p "/context"` у копії, окремий запуск): `integrating-n8n-webhooks | Project`
  + вбудовані (14)
- **Чи викликав агент скіл:** так, першим же викликом інструмента — `Skill {"skill":"integrating-n8n-webhooks"}`;
  потім прочитав `references/code-templates.md`, `references/callback.md` і `scripts/check-contract.mjs`
  і в кінці сам запустив `check-contract.mjs --changed-since HEAD` → 13 PASS, 0 FAIL (версія скрипта в копії —
  до виправлення C14, див. нижче)
- Що зробив агент: `lib/n8n/client.ts` (`import "server-only"`, заголовки `x-n8n-token`, `idempotency-key`,
  `x-correlation-id`, `AbortSignal.timeout(10_000)`, повтори 1 с/3 с лише на мережу/таймаут/5xx), Server Action
  `requestQuote`: валідація → запис `queued` з `idempotencyKey`/`correlationId` → `triggerWorkflow` у `after()`
  з `withCallback` → `redirect`; колбек `app/api/n8n/[event]/route.ts` за 10 кроками (404 → 415 → `req.text()` →
  413 → вікно 300 с → HMAC + `timingSafeEqual` → claim ключа → `JSON.parse` і звірка події/ключа з тілом →
  запис до відповіді → 202); сховище ключів ідемпотентності в `lib/db.ts`; `/quotes/[id]` з автооновленням;
  `.env.example` з 4 ключами контракту; `docs/n8n-integrations.md` (реєстр). Старий виклик `lead-created`
  у `app/actions.ts` свідомо не чіпав («out of scope»), але прямо про нього сказав
- Фінальна відповідь (скорочено): «I added the full async quote-request flow, following the team's
  `integrating-n8n-webhooks` contract… Pre-existing lead flow is out of scope and non-compliant.
  `app/actions.ts` still posts leads directly to n8n via the legacy `N8N_WEBHOOK_URL` (a `/webhook-test/` URL)…
  I left it untouched… If you'd like, I can migrate the lead flow onto the same `lib/n8n/client.ts`.»
  Запитань не ставив; `.env.local` не створював («those are your secrets to fill in»)
- Змінені файли (14, +760/−1): `.env.example`, `app/api/n8n/[event]/route.ts`, `app/page.tsx`,
  `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`, `app/quotes/new/page.tsx`, `components/quote-form.tsx`,
  `components/quote-status-refresh.tsx`, `docs/n8n-integrations.md`, `lib/data.ts`, `lib/db.ts`,
  `lib/n8n/client.ts`, `lib/quote-form.ts`, `lib/types.ts`; діф: `docs/ab/b-with-skill.diff`
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`,
  `APP_BASE_URL` (у `.env.example` — `change-me-…` і локальні адреси)
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base` — лише код прогону:
  ```
check-contract — root: ../leaddesk-ab-b, changed since base (14 file(s))
C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   PASS  n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/
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
C14  PASS  N8N_CALLBACK_SECRET is used only in callback routes

14 PASS, 0 FAIL
  ```
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
POST /webhook/quote-request -> 202 in 5 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 265 B sha256=820dad5fd506793db42e935aac3d42a35e8d39f34287bfa543721ab395927e53
workflow 29fbec1c-134b-41a7-92c5-994262c92ab1 running for 5000 ms, then callback event=quote-request.completed
callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 130 ms (try 1/3) event=quote-request.completed body 382 B sha256=62b4c41276ef5d8d4343e6896b5b4352cb395eaca2d65875a3006fef6cf2e9cc
  ```
- Час від «Надіслати» до відповіді форми: **565 мс** (n8n викликається вже після відповіді; решту часу
  займають `insertQuote` 120 мс і `insertAuditEntry` 250 мс, які агент лишив до `redirect`, та рендер `/quotes/[id]`)
- Що показала `/quotes/quote_0001`: спершу «Кошторис формується», через ~5 с сама оновилась до «Кошторис
  готовий · Відкрити PDF-кошторис» (бюджет «Ще не визначились» — моя помилка заповнення: у формі B немає
  опції `1500`, на гілці перевірено з `5000`)
- Матриця колбеків зі скіла (`send-signed-callback.mjs`) проти роуту B — усі 10 перевірюваних випадків як у
  контракті (valid/replay пропущено, бо ключ запису не видно ззовні; valid покриває справжній колбек мока — 202):
  ```
callback matrix → http://127.0.0.1:3000/api/n8n/quote-request  event=quote-request.completed  (no --request-key: valid/replay skipped)
case                    expected  got   result
valid                   202       -     SKIP
replay                  200       -     SKIP
bad-signature           401       401    OK
missing-signature       401       401    OK
expired-timestamp       401       401    OK
future-timestamp        401       401    OK
reformatted-body        401       401    OK
wrong-content-type      415       415    OK
unknown-event           404       404    OK
key-not-matching-body   400       400    OK
malformed-json          400       400    OK
too-large               413       413    OK

all cases as expected
  ```
- Журнал сервера: ні тіл, ні email, ні імен, ні токенів чи підписів; лише подія, correlation id, статус, розмір:
  ```
db:insertQuote: 1
db:insertAuditEntry: 1
db:getQuote: 1
n8n out event=quote-request corr=77c6166e-11bb-48fa-8ff7-d6d05ad97e3a attempt=1 status=202 ms=13
db:getQuote: 2
db:updateQuote: 1
n8n callback event=quote-request.completed corr=77c6166e-11bb-48fa-8ff7-d6d05ad97e3a status=completed bytes=382
db:getQuote: 3
db:getQuote: 4
  ```

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, першим викликом (`Skill`), + `references/code-templates.md`, `callback.md`, `check-contract.mjs` |
| `check-contract.mjs --changed-since base`: FAIL (id) | **9 FAIL**: C3, C5, C6, C7, C10, C11, C12, C13, C14 | **0 FAIL** (14 PASS) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request` (окрема змінна `N8N_QUOTE_WEBHOOK_URL`) | `/webhook/quote-request` (`N8N_WEBHOOK_BASE_URL` + подія) |
| `auth=` / `idempotency=` у журналі мока | `auth=missing` → 403; заголовка ключа немає (без Header Auth: `idempotency=absent`) | `auth=ok`, `idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні (воркфлоу не запустився); без Header Auth — дійшов, **401** | так, **202** з першої спроби |
| Що в n8n у тілі | 354 Б: компанія, **email**, опис, бюджет, `callbackUrl` і **`callbackSecret`** | 265 Б: `quoteId`, компанія, бюджет, опис (без email) |
| Статус на `/quotes/<id>` | «Не вдалося запустити…» (без Header Auth — вічне «Готуємо…») | «Кошторис готовий» + посилання |
| Час відповіді форми | 669 мс (виклик n8n синхронний, у дії) | 565 мс (виклик n8n в `after()`) |
| Тіла чи персональні дані в журналі сервера | немає; є стек помилки | немає |
| Змінених файлів | 11 (+479) | 14 (+760) |
| Запитання агента | немає | немає |
| Ходів / час сесії | 51 / 6,0 хв | 53 / 7,2 хв |
| Відхилені дозволи (однаковий allowlist) | 8 (`ls tools/ …; cat`, `npx next typegen` ×4, `cat package.json`, `git status`) | 3 (`ls -la && find`, `node -e require(...)` з `cd`, `sed -n`) |

Щодо часу форми: різниця лише ~100 мс, бо мок відповідає миттєво. Важливіше, що в A час відповіді
**залежить** від n8n і нічим не обмежений (`fetch` без таймауту, прямо в дії), а в B відповідь форми від n8n
не залежить узагалі.

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` у корені робочого репозиторію на BASE-коді +
  виправлення скіла; застосувалось без конфліктів і закомічено **без змін** —
  `dd9d416 feat(quotes): port quote request feature from A/B run B`. `.env.local` і `node_modules/` не
  переносили, `package.json` агент не змінював.
- Що довелось доробити руками після перенесення (і чому скіл цього не дав) — окремими комітами:
  - `420a0b5 fix(n8n): send lead-created through lib/n8n/client.ts in after()` — старий виклик із публічної
    форми ліда (тестовий URL, увесь рядок ліда з IP/user agent/raw payload, без токена, таймауту й
    ідемпотентності, користувач чекав). Прогін B його бачив і назвав, але не чіпав, бо запит був лише про
    кошторис. Межа скіла: скіл не каже «приведи до контракту всі наявні виклики», а агент не розширює задачу сам.
  - `309c7ea fix(env): .env.example follows the n8n contract` — прибрано `N8N_WEBHOOK_URL=…/webhook-test/…`
    (та сама причина).
  - `60538cd docs: add lead-created to the n8n integration registry`.
  - Сам скіл виправлено до перенесення, після прогону A: `60f0f34 fix(skill): check-contract detects any N8N_* call
    site and leaked callback secret` — див. нижче.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає. У `.env.local` — ті самі ключі зі значеннями,
  згенерованими `randomBytes(32)` (значень не друкували).
- `npm run lint`, `npm run build` на гілці: без помилок.
- `check-contract.mjs` на фінальному коді (0 FAIL, код виходу 0):
  ```
check-contract — root: /Users/taras-vasylhaioshko/Claude COde/2026-quitcode-04-agent-skills-hw
C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS  no NEXT_PUBLIC_N8N_* variables
C3   PASS  n8n is called and N8N_* (except N8N_CALLBACK_SECRET) is read only inside lib/n8n/
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
C14  PASS  N8N_CALLBACK_SECRET is used only in callback routes

14 PASS, 0 FAIL
exit=0
  ```
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці (`node --env-file=.env.local tools/mock-n8n.mjs
  --mode respond-202 --delay 5000`): форма **556 мс**, сторінка «Кошторис формується» → через 5 с сама
  оновилась до «Кошторис готовий», бюджет «$1 000–5 000»; колбек `-> 202`. Плюс публічна форма ліда:
  «Дякуємо! Заявку отримано.» за **131 мс** (до виправлення — 457 мс), у n8n 144 Б замість 1267 Б:
  ```
POST /webhook/quote-request -> 202 in 5 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 265 B sha256=a356d3a8ccae2e400a19f5080a8a4255fad852165eeb9a1fc1e024a708fea839
workflow 0f00e264-f2b3-45fd-b0a4-b880ab769aab running for 5000 ms, then callback event=quote-request.completed
callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 129 ms (try 1/3) event=quote-request.completed body 382 B sha256=3df0ecb14ac5b50ca9db9548efa4d60df40f6df11f30a720f90e8d8a36f51dea
POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 144 B sha256=23321013aed14a6975ea6fcce0f9956d68fb7e4d7155b7f1bb9cbfca37d9dec6
  ```
  Журнал сервера на гілці:
  ```
db:insertQuote: 1
db:insertAuditEntry: 1
db:getQuote: 1
n8n out event=quote-request corr=9d382872-fbb0-4e1b-90f4-0a0cd96b584b attempt=1 status=202 ms=12
db:getQuote: 2
db:updateQuote: 1
n8n callback event=quote-request.completed corr=9d382872-fbb0-4e1b-90f4-0a0cd96b584b status=completed bytes=382
db:getQuote: 3
db:insertLead: 1
n8n out event=lead-created corr=3c24d74e-b819-4f1b-96cf-1cb38c2bb179 attempt=1 status=202 ms=3
db:insertAuditEntry: 2
  ```
  Матриця колбеків на гілці:
  ```
callback matrix → http://127.0.0.1:3000/api/n8n/quote-request  event=quote-request.completed  (no --request-key: valid/replay skipped)
case                    expected  got   result
valid                   202       -     SKIP
replay                  200       -     SKIP
bad-signature           401       401    OK
missing-signature       401       401    OK
expired-timestamp       401       401    OK
future-timestamp        401       401    OK
reformatted-body        401       401    OK
wrong-content-type      415       415    OK
unknown-event           404       404    OK
key-not-matching-body   400       400    OK
malformed-json          400       400    OK
too-large               413       413    OK

all cases as expected
  ```
- Рядок у `docs/n8n-integrations.md`: `quote-request` (його написав агент у прогоні B) і `lead-created` (дописано).

## Що скіл змінив у собі після прогонів

- `60f0f34` — **`check-contract.mjs` не бачив коду прогону A**: евристика шукала `N8N_WEBHOOK`, а агент назвав
  змінну `N8N_QUOTE_WEBHOOK_URL`, тож C3/C5/C11/C12 давали PASS на `fetch` без токена, таймауту й `after()`.
  Тепер викликом n8n вважається будь-яка `process.env.N8N_*`, крім секрету колбека. Нова перевірка **C14**:
  `N8N_CALLBACK_SECRET` лише в колбек-роуті — прогін A відправляв його в n8n у тілі запиту. Обидва прогони
  оцінено вже виправленим скриптом (у прогоні B агент сам запускав стару версію з копії — вона дала ті самі 0 FAIL).
- `SKILL.md`, розділ «Verify» — новий пункт: запустити `check-contract.mjs` на всьому проєкті, назвати людині
  старі виклики n8n поза контрактом і запропонувати міграцію окремим кроком. Причина: прогін B побачив старий
  `lead-created` і згадав його лише наприкінці; доводити його довелось руками.

## Висновок

Скіл змінив результат суттєво й вимірно: без скіла агент правильно здогадався, що 40–90-секундний воркфлоу
треба запускати асинхронно з колбеком, але вигадав власний контракт — і з n8n клієнта (Header Auth, HMAC-підпис)
його код не працює взагалі: запуск отримує 403, а навіть без авторизації підписаний колбек відхиляється 401
і запит зависає назавжди; до того ж секрет колбека йде в n8n у тілі, а виклик синхронний без таймауту
(9 FAIL на власному коді). Домовленості A — із загальних знань і наявного коду, документація Next.js дала лише
форму Route Handler. Зі скілом агент з першого кроку викликав його, узяв шаблони з `references/` і дав робочий
сценарій 202 → колбек 202 → «Кошторис готовий» з 0 FAIL; руками довелось доробити лише те, що лежало поза
запитом (старий виклик `lead-created` і `.env.example`). Сам скіл після бою посилено: `check-contract.mjs`
тепер ловить довільно названі `N8N_*` і витік секрету колбека, а в `SKILL.md` додано крок «знайди інші виклики
n8n поза контрактом, назви їх і запропонуй міграцію окремим кроком» (`check-contract.mjs` без `--changed-since`).
