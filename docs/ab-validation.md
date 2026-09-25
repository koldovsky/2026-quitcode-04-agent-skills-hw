# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`, Task D. **A — без скіла, B — зі скілом.**
> Числа й цитати — із сесій (транскрипти `~/.claude/projects/-Users-mac1-leaddesk-ab-{a,b}/*.jsonl`) і журналів.

- **Інструмент і версія:** Claude Code 2.1.252 (десктоп-застосунок, вкладка Code)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** Claude Sonnet 5 (`claude-sonnet-5`), effort
  high; режим дозволів — manual (дії агента підтверджувала людина, однаково в обох; поза текою копії запитів не було)
- **Код:** BASE = `0d5a1d9` (три скіли, виправлення Task A, форма нотаток з Task B; ще без `/quotes` і змін у виклику
  n8n) · скіл `integrating-n8n-webhooks` для копії B — з HEAD `1cc70b4` (скіл той самий, що в `0d5a1d9`, v0.2.0)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`); у кожній —
  коміт `start` з тегом `base` (A: `7b3da6a`, B: `958fb4a`). `node_modules` — APFS-клон (`cp -cR`) з робочого
  репозиторію: той самий `package-lock.json`, без мережі й install-скриптів (замість `npm install`)
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/` і всі скіли
  (у B повернуто лише `integrating-n8n-webhooks`). Перевірено: `find … -name SKILL.md` — рівно один рядок
  (`../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`); `ls -A | grep …` — «no hints - ok»;
  `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a` — «no contract - ok»
- **Особисті копії скіла** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`): перевірено —
  порожньо (особистий `find-skills` перенесено ще в Task A)
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін; сесії: A — `local_9cb99f85…`
  (транскрипт `0ec80489…`), B — `local_c8154bdc…` (транскрипт `2bdddce4…`)
- **Перша спроба A відкинута:** у першій сесії A (`local_8de38250…`) людина випадково поставила прогін на паузу
  (37 кроків, без читань поза копією); копію скинуто до `base` (`git reset --hard base && git clean -fd`), прогін A
  зроблено наново в новій сесії — він і пішов у звіт
- **Відповідь на уточнення, однакова в обох:** агент не питав (запитань 0 в обох прогонах)
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  (без `--callback-url`). `.env.local` у копії — з `.env.example` агента, секрети замінено згенерованими значеннями
  (у A — `N8N_CALLBACK_SECRET` + додано `N8N_WEBHOOK_TOKEN` для мока; у B — обидва `change-me-…`); значень ніхто не друкував
- **Як міряли час форми:** у вбудованому браузері Claude Code — скрипт на сторінці: `performance.now()` від кліку
  «Надіслати» до зміни URL на `/quotes/<id>` (не DevTools → Network). Журнали мока в звіті скорочено: час — `HH:MM:SS`
  UTC замість повного ISO, sha256 тіла прибрано; повні рядки — у терміналах під час прогонів.
- **Видимі скіли** (окремий `claude -p "/context"` у теці копії, не в сесії прогону): A — жодного проєктного чи
  особистого (лише вбудовані Claude Code); B — `integrating-n8n-webhooks | Project | ~290`
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): в обох — 6 PASS,
  8 FAIL (C1, C3–C9: старий виклик n8n у `submitLead` і `.env.example`) — це старий код, в оцінку прогонів він не йде

## A — без скіла

- Які скіли бачив агент: жодного проєктного; сам перевірив `ls .claude/skills/` і шукав теку `tools` — нічого.
- Що зробив агент: публічна форма `/quotes/new` (Server Action `requestQuote` в `app/quotes/new/actions.ts`), сторінка
  `/quotes/[id]` з клієнтським опитуванням `GET /api/quotes/[id]` кожні 4 с, колбек `POST /api/quotes/[id]/callback`,
  сховище `quotes` у `lib/db.ts`. Server Action **синхронно** чекає `fetch(process.env.N8N_QUOTE_WEBHOOK_URL)` (без
  таймауту й заголовків авторизації, тіло — запис цілком з `callbackUrl`), потім `redirect`. Статус «failed» ставиться
  лише на мережевий виняток — відповідь 404/403/5xx не перевіряється. Колбек: необов'язковий спільний секрет у
  заголовку `x-n8n-secret`, порівняння через `!==`, `request.json()`, без вікна часу й ідемпотентності.
  Протестував сам: власний stub-сервер у своєму scratchpad, `npm run dev` з `/webhook-test/…` URL і `curl` колбека.
- Звідки агент узяв домовленості: з наявного коду (`app/actions.ts` — старий `fetch` до `N8N_WEBHOOK_URL`,
  `lib/lead-form.ts`, `components/note-form.tsx`, `lib/db.ts`) і документації Next.js у `node_modules`
  (`15-route-handlers.md`, `after.md`). Контракту n8n (Header Auth, idempotency, підпис) у копії не було — і в коді теж.
  Читань поза текою копії — **0**.
- Запитання агента і фінальна відповідь (скорочено): запитань немає. «Added the quote-request feature, verified end-to-end
  in the browser … POSTs to n8n's `quote-request` webhook (`N8N_QUOTE_WEBHOOK_URL`) with a per-request `callbackUrl` …
  the endpoint n8n calls … optionally guarded by an `N8N_CALLBACK_SECRET` header … `npm run build` and `npm run lint` both pass.»
- Змінені файли (`git diff --cached --stat base`): 12 файлів, +465 −1 — `.env.example`, `app/api/quotes/[id]/callback/route.ts`,
  `app/api/quotes/[id]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/new/actions.ts`, `app/quotes/new/page.tsx`,
  `components/quote-form.tsx`, `components/quote-status.tsx`, `lib/data.ts`, `lib/db.ts`, `lib/quote-form.ts`, `lib/types.ts`;
  діф: [`docs/ab/a-without-skill.diff`](ab/a-without-skill.diff)
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL` (у `.env.example` — `http://127.0.0.1:5678/webhook-test/quote-request`),
  `N8N_CALLBACK_SECRET` (порожнє — «Leave unset locally to skip the check»); старий `N8N_WEBHOOK_URL` лишився
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` — лише код прогону:
  ```
n8n contract check — root: ../leaddesk-ab-a
scope: changed since base (12 file(s)); 39 code file(s), 1 .env example(s)

C1   FAIL  no /webhook-test/ URL in code or .env*.example
       - .env.example:10  test webhook URL (works only 120 s after 'Listen for test event')
C2   PASS  no NEXT_PUBLIC_ prefix on N8N_* variables
C3   FAIL  n8n webhook calls only from lib/n8n/client.ts
       - app/quotes/new/actions.ts:29  calls n8n outside lib/n8n/client.ts
C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
       - app/quotes/new/actions.ts:29  n8n is called but lib/n8n/client.ts does not exist
C5   FAIL  every fetch to n8n has a timeout (AbortSignal.timeout)
       - app/quotes/new/actions.ts:29  fetch to n8n without signal: AbortSignal.timeout(...)
C6   FAIL  outgoing n8n request sets x-n8n-token, idempotency-key, x-correlation-id
       - app/quotes/new/actions.ts:29  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  request body is the envelope { version: 1, event, data }
       - app/quotes/new/actions.ts:29  body is not the { version: 1, event, data } envelope
C8   FAIL  .env.example follows the contract variables
       - .env.example:1  N8N_WEBHOOK_BASE_URL is missing
       - .env.example:1  N8N_WEBHOOK_TOKEN is missing
       - .env.example:1  APP_BASE_URL is missing
       - .env.example:14  N8N_CALLBACK_SECRET must be a change-me-... placeholder
C9   FAIL  Server Actions start n8n workflows inside after()
       - app/quotes/new/actions.ts:29  Server Action waits for n8n: move the call into after() and return { status, id }
C10  FAIL  callback reads the raw body; no req.json()/JSON.parse before the signature check
       - app/api/quotes/[id]/callback/route.ts:19  req.json() re-serializes the body: read req.text() and verify first
       - app/api/quotes/[id]/callback/route.ts:1  raw body is not read with req.text()
C11  FAIL  callback signature: length check + timingSafeEqual, never === / !==
       - app/api/quotes/[id]/callback/route.ts:1  signature is never checked with crypto.timingSafeEqual (directly or via a helper)
C12  FAIL  callback checks a 300 s timestamp window and an idempotency-key
       - app/api/quotes/[id]/callback/route.ts:1  no 300 s window check on x-n8n-timestamp
       - app/api/quotes/[id]/callback/route.ts:1  idempotency-key is not checked
C13  PASS  no runtime = "edge"
C14  PASS  no request bodies, form data or personal data in logs of n8n-related code

14 checks: 3 PASS, 11 FAIL
exit=1
  ```
- Журнал мока (форма → колбек → `/quotes/<id>`), дві відправки — з вбудованого браузера й людиною:
  ```
  [mock-n8n] 10:53:13 header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 10:53:13 callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  [mock-n8n] 10:55:16 POST /webhook-test/quote-request -> 404 in 3 ms  | headers: accept,accept-language,content-type,user-agent | body 242 B
  [mock-n8n] 10:56:05 POST /webhook-test/quote-request -> 404 in 1 ms  | headers: accept,accept-language,content-type,user-agent | body 191 B
  ```
  Тестовий URL (`/webhook-test/`) → 404; заголовків `x-n8n-token`, `idempotency-key`, `x-correlation-id` немає; воркфлоу не
  запустився, **колбека не було**.
- Час від «Надіслати» до відповіді форми: **325 мс** (клік → перехід на `/quotes/quote_0001`, виміряно в браузері).
  Швидко лише тому, що мок відповів 404 за 3 мс: дія чекає n8n синхронно, без таймауту.
- Що показала `/quotes/<id>`: «Готуємо кошторис… сторінка оновиться автоматично» — **назавжди**: 404 не вважається
  збоєм, тож запис лишається `pending`, а сторінка опитує сервер кожні 4 с.
- Журнал сервера: `db:insertQuoteRequest`, далі лише `db:getQuoteRequest` (опитування) — тіл, email, телефонів, токенів чи
  підписів немає.

## B — зі скілом

- Які скіли бачив агент: `integrating-n8n-webhooks` (Project).
- **Чи викликав агент скіл:** так, першою ж дією — `Skill {"skill":"integrating-n8n-webhooks"}` о 11:01:59 (запит —
  11:01:56), далі прочитав усі 5 файлів `references/` (`contract.md`, `callback.md`, `code-templates.md`,
  `operations.md`, `n8n-setup.md`) і користувався `scripts/`: `check-contract.mjs` (3 рази — спершу побачив 8 FAIL
  базової лінії, в кінці 14 PASS), `mock-n8n.mjs` (власний прогін сценарію), `send-signed-callback.mjs`.
- Що зробив агент: `lib/n8n/client.ts` (`server-only`, конверт, `x-n8n-token`, `idempotency-key`, `x-correlation-id`,
  таймаут 10 с, повтори), `lib/n8n/signature.ts`, `lib/n8n/store.ts` (демо-сховище ключів), колбек
  `app/api/n8n/[event]/route.ts` (кроки контракту по черзі), Server Action `app/quotes/actions.ts` (запис `queued` →
  `{ status, id }`, виклик n8n в `after()`), `/quotes/new`, `/quotes/[id]` з опитуванням, `.env.example` на 4 змінні
  контракту, `docs/n8n-integrations.md`. **Сам переніс і старий виклик `lead-created`** у `app/actions.ts` на той самий
  клієнт — «since the contract requires *all* n8n calls to go through one module».
  Матриця колбеків: перший запуск — 9/11 (`valid`/`duplicate` → 404, бо скрипт надсилає випадковий ключ, а роут шукає
  запис за `requestIdempotencyKey`); агент прочитав `--help`, перезапустив з `--request-key` реального запиту → 202 і
  200 duplicate. Після матриці двічі виправив `lib/n8n/client.ts`.
  Побічно: власний `.env.local` (git-ignored, у діф не потрапив) і `.claude/launch.json`.
- Запитання агента і фінальна відповідь (скорочено): запитань немає. «Added a full quote-request flow following the
  integrating-n8n-webhooks contract … Server Action: saves the request as `queued`, returns `{status, id}` immediately,
  and triggers the `quote-request` n8n workflow inside `after()` … callback endpoint: raw-body HMAC check, 300s replay window,
  idempotency dedup, all in the exact order the contract requires … also migrated the existing `lead-created` call …
  Verified: `check-contract.mjs` 14/14 PASS, `npm run lint` and `npm run build` clean, and a real end-to-end run against
  the skill's offline n8n mock … signed-callback test matrix (11/11 cases …).»
- Змінені файли (`git diff --cached --stat base`): 16 файлів, +638 −13 — `.claude/launch.json`, `.env.example`,
  `app/actions.ts`, `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`,
  `app/quotes/new/page.tsx`, `components/quote-form.tsx`, `components/quote-status-poller.tsx`, `docs/n8n-integrations.md`,
  `lib/db.ts`, `lib/n8n/client.ts`, `lib/n8n/signature.ts`, `lib/n8n/store.ts`, `lib/quote-form.ts`, `lib/types.ts`;
  діф: [`docs/ab/b-with-skill.diff`](ab/b-with-skill.diff)
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; старий `N8N_WEBHOOK_URL` з тестовим URL прибрав
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base` — лише код прогону:
  ```
n8n contract check — root: ../leaddesk-ab-b
scope: changed since base (16 file(s)); 41 code file(s), 1 .env example(s)

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
  Без `--changed-since` (увесь код копії) — теж 14 PASS / 0 FAIL: агент виправив і старий код базової лінії.
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] 11:21:01 header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 11:22:59 POST /webhook/quote-request -> 202 in 5 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 285 B
  [mock-n8n] 11:22:59 workflow bc9cfcf1-… running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 11:23:04 callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 113 ms (try 1/3) event=quote-request.completed body 382 B
  ```
- Час від «Надіслати» до відповіді форми: **304 мс** (клік → `/quotes/quote_0001`); виклик n8n — в `after()`, тож час
  не залежить від n8n.
- Що показала `/quotes/<id>`: одразу «очікує», через ~5 с — **«Кошторис готовий»** з посиланням «Завантажити кошторис (PDF)».
- Журнал сервера: `db:insertQuoteRequest`, `n8n out event=quote-request corr=1076abd9-… attempt=1 status=202 ms=50`,
  `db:saveQuoteJobResult`, `n8n in event=quote-request job=bc9cfcf1-… corr=1076abd9-… status=202` — лише подія, id,
  correlation id, статус і тривалість; тіл, email, токенів чи підписів немає.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, першим кроком (`Skill`), + усі 5 `references/`, `check-contract.mjs`, мок, матриця |
| `check-contract.mjs` на коді прогону (`--changed-since base`): FAIL (id) | **11 FAIL**: C1, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12 | **0 FAIL** (14 PASS) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook-test/quote-request` → 404 | `/webhook/quote-request` → 202 |
| `auth=` / `idempotency=` у журналі мока | не дійшло (404 до перевірки); заголовків `x-n8n-token` / `idempotency-key` немає | `auth=ok idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні (воркфлоу не запустився); колбек-роут чекає `x-n8n-secret`, а не підпис — підписаний колбек мока він би відхилив | так, `202` за 113 мс |
| Час відповіді форми | 325 мс (але дія чекає n8n синхронно, без таймауту) | 304 мс (n8n — в `after()`) |
| `/quotes/<id>` | вічне «Готуємо кошторис…» | «Кошторис готовий» + PDF |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Змінених файлів | 12 (+465 −1) | 16 (+638 −13), з них 1 — `.claude/launch.json` |
| Запитання агента | 0 | 0 |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way --exclude='.claude/launch.json' docs/ab/b-with-skill.diff` у корені робочого
  репозиторію (гілка на коді BASE + лише документи). 15 файлів застосовано чисто («Falling back to direct application»
  для нових файлів — норма). Коміт **`b723df3`** `feat(quotes): request-a-quote feature from A/B run B (integrating-n8n-webhooks)`.
  `.claude/launch.json` не переносили (локальний конфіг браузерної панелі; у робочому репо він у `.git/info/exclude`),
  `.env.local` і `node_modules` — теж ні; нових залежностей агент не додавав (`package.json` не змінений).
- Що довелось доробити руками після перенесення: **для контракту n8n — нічого**: `check-contract.mjs` на всьому коді
  гілки одразу дав 0 FAIL, бо агент B сам переніс старий виклик `lead-created` і `.env.example` на контракт; руками —
  лише `.env.local` гілки (4 ключі, секрети згенеровано скриптом). Але незалежне рев'ю фічі (окремий агент) знайшло
  три вади коду прогону B, яких не ловить ні скіл, ні `check-contract.mjs` — виправлено окремими комітами:
  1. `ebb8de1` — **витік даних:** id запитів були послідовні (`quote_0001`…), а `/quotes/[id]` публічна й показує компанію,
     email, задачу й бюджет — будь-хто міг перебрати чужі запити. Тепер `quote_<randomUUID>`; перевірено: старий
     `/quotes/quote_0001` → 404.
  2. `0df23ed` — **форма без JavaScript:** перехід на `/quotes/<id>` робив `router.push` у клієнтському ефекті, тож без JS
     користувач не бачив свого запиту. Тепер `redirect()` з Server Action; перевірено нативною відправкою форми (без
     обробників React) — перехід на `/quotes/quote_c351fdfb-…`.
  3. `3639daa` — **вічне опитування:** без колбека сторінка оновлювалась кожні 5 с назавжди. Тепер межа 5 хв і повідомлення
     «відповіді ще немає»; посилання на документ — лише `http(s)`.
  Після виправлень: `check-contract.mjs` — 0 FAIL, lint і build без помилок; сценарій з моком — форма 303 мс,
  `POST /webhook/quote-request -> 202 … auth=ok idempotency=new`, колбек `-> 202`, «Кошторис готовий»; у журналах немає
  тестових email і назв компаній. Урок — у скіл: `f6f10c3` (v0.2.2) додав до кроку «Статус» і чекліста вимоги
  «неможливий для вгадування id, межа опитування, `redirect()` з дії». Раніше `56948a4` (v0.2.1) — підказка в
  `send-signed-callback.mjs` і прибране попередження eslint (див. `docs/verification.md` → Task C).
- **Після рев'ю CodeRabbit у PR** (10/11 кастомних перевірок PASS; попередження Task D + 9 inline-коментарів) —
  виправлено окремими комітами, скіли оновлено:
  - `fb76c69` — колбек: тіло читається **потоком з лімітом 64 КБ** (спершу `content-length`) замість `request.text()`
    (CWE-770: необмежене читання до перевірки розміру); після підпису — **перевірка форми під час виконання** в
    `lib/n8n/callback-body.ts`: невалідний JSON чи форма → **400** (було 500), `data.status` мусить дорівнювати суфіксу
    `event`, обов'язковий `requestIdempotencyKey`, `documentUrl`/`error.code` — рядки; ключ звільняється при кожній невдачі;
  - `4ff2614` — `markQuoteRequestFailed` змінює лише `queued`; результат `ready` колбек не понижує;
  - `bb56486` — форма кошторису: введене зберігається після помилки валідації, помилки прив'язані до полів
    (`aria-invalid`, `aria-describedby`), підсумок у `role="alert"`;
  - `3dc8fe3` — форма нотатки (Task B): `required`, текст зберігається й після помилки збереження;
  - `fdb0534` / `6c35603` — скіли `building-client-form` v0.1.1 і `integrating-n8n-webhooks` v0.2.3 (шаблони, `callback.md`,
    посилений `check-contract.mjs`: C6/C7/C12 — лише код без коментарів, справжні читання заголовків і порівняння з 300);
  - `a7226ab` — власник у `docs/n8n-integrations.md`: Maria Vorobets.

  Перевірка після виправлень (продакшн-збірка + мок `--mode respond-202 --delay 5000`): матриця
  `send-signed-callback.mjs` — 9/9 перевірюваних випадків PASS (`valid`/`duplicate` без `--request-key` → 404, як і пояснює
  підказка скрипта; справжній `valid` — колбек мока нижче); додаткові підписані випадки — невалідний JSON, `status` не
  збігається з подією, `documentUrl` не рядок, без `requestIdempotencyKey` — усі **400**; форма з помилками зберегла всі
  4 значення, `role="alert"` «Перевірте поля: email, опис задачі.», `aria-invalid="true"` + `aria-describedby`; валідна
  відправка — 283 мс, `POST /webhook/quote-request -> 202 … auth=ok idempotency=new`, колбек `-> 202`, «Кошторис готовий»;
  у журналах немає тестового email і назви компанії. `check-contract.mjs` — 0 FAIL; ті самі фікстури з поганим кодом —
  ті самі FAIL, а «обхід коментарем» (заголовки й `300` лише в коментарях) тепер дає FAIL у C6, C7, C12.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; рядка з `/webhook-test/` немає.
- `npm run lint`, `npm run build` на гілці: без помилок (одне попередження eslint було в `check-contract.mjs` скіла —
  прибрано в `56948a4`); у збірці — `○ /quotes/new` (статична), `ƒ /quotes/[id]`, `ƒ /api/n8n/[event]`.
- `check-contract.mjs` на фінальному коді (увесь проєкт, без `--changed-since`):
  ```
n8n contract check — root: .
scope: whole project; 42 code file(s), 1 .env example(s)

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
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці (`npm run build && npm start` +
  `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`; форму заповнювала людина):
  ```
  [mock-n8n] 11:36:15 POST /webhook/quote-request -> 202 in 4 ms auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token | body 239 B
  [mock-n8n] 11:36:20 callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 126 ms (try 1/3) event=quote-request.completed body 382 B
  [mock-n8n] 11:37:31 POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token | body 146 B
  ```
  Журнал сервера: `n8n out event=quote-request … status=202 ms=55`, `db:saveQuoteJobResult`, `n8n in event=quote-request …
  status=202`, `db:insertLead`, `n8n out event=lead-created … status=202 ms=7` — без персональних даних. Сторінка
  `/quotes/<id>` — «Кошторис готовий» з посиланням на PDF. Форма заявки на `/` тепер іде на `/webhook/lead-created`
  з Header Auth і тілом 146 Б (на `main` — `/webhook-test/` → 404, тіло 1429 Б із цілим лідом).
- Рядок у `docs/n8n-integrations.md`: так — `lead-created` (Immediately) і `quote-request` (Respond to Webhook 202 +
  колбек `/api/n8n/quote-request`), додав агент B.

## Висновок

Скіл змінив результат принципово: з тим самим запитом, моделлю й effort агент без скіла (A) зробив робочу на вигляд
фічу, але з 11 порушеннями контракту з 14 — тестовий URL, жодної авторизації й ідемпотентності, синхронне очікування
n8n, колбек без підпису; у сценарії з налаштованим «як у клієнта» моком воркфлоу не запустився (404), а сторінка
статусу вічно «готує кошторис». Домовленості A взяв з наявного коду (старий `fetch` у `app/actions.ts`) і документації
Next.js — тобто відтворив і розширив те, що було не так у стартовому коді. Агент зі скілом (B) викликав його першим
кроком, прочитав усі довідки, сам перевірив себе `check-contract.mjs`, моком і матрицею колбеків і дав 0 FAIL — разом
зі старим кодом, який не просили чіпати. Межа скіла проявилась поза контрактом n8n: рев'ю фічі B знайшло
послідовні id на публічній сторінці статусу (витік персональних даних), перехід без JS і вічне опитування — три
доробки руками після перенесення; їх додано в скіл (v0.2.2). Також після прогону в
скілі змінили `send-signed-callback.mjs` (пояснення, чому `valid`/`duplicate` дають 404 без `--request-key`, — на цьому
агент B втратив одну ітерацію) і прибрали попередження eslint у `check-contract.mjs`.
