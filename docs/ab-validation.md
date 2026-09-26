# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code 2.1.283, headless (`claude -p`, `--output-format stream-json --verbose`)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-5-5` (`--model claude-opus-5-5`), `--effort high`
- **Дозволи, однакові в обох:** `--permission-mode acceptEdits --allowedTools "Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(ls:*),Bash(git status),Bash(git diff:*)"`.
  Усе інше (запуск сервера, мока, `node`, `npx tsc`, `python3`) у headless-режимі автоматично відхилялось —
  у кожному прогоні по 5 відхилених викликів (журнали `run-a.jsonl` / `run-b.jsonl`).
- **Код:** BASE = `e41feb5` (коміт після Task C: три скіли й виправлення Task A, ще без `/quotes` і змін у
  виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з того самого `e41feb5` (HEAD на момент копіювання)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`);
  у кожній — `git init`, коміт `start` з тегом `base`, `npm install`
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і всі скіли (у B повернуто лише `integrating-n8n-webhooks`). Перевірено: `find … -name SKILL.md` → рівно
  `../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`; `ls -A … | grep …` → «no hints - ok»;
  `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a` → «no contract - ok».
- **Особисті копії скіла** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`): немає.
  У `~/.claude/skills/synced/` лише синхронізовані з claude.ai скіли (docx, pdf, pptx, xlsx, docs…) — однакові в
  обох прогонах, до n8n не стосуються.
- **Запит:** текст між лініями з `materials/ab-task.md` без змін (файл `ab-prompt.txt`, UTF-8, `claude -p < ab-prompt.txt`),
  нова сесія на кожен прогін; обидва прогони стартували одночасно (13:52:48 і 13:52:51).
- **Відповідь на уточнення, однакова в обох:** агент не питав (headless-режим; питання для людини обидва агенти
  лишили у фінальній відповіді).
- **Спроби вийти за межі копії:** не було. Жоден агент не читав `../2026-quitcode-04-agent-skills-hw`. Агент A
  записав власний мок у `/tmp/mock-n8n-quote.mjs` і спробував його запустити — запуск відхилено (як і `next start` в обох).
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  (Header Auth увімкнено `N8N_WEBHOOK_TOKEN`, підписаний колбек — `N8N_CALLBACK_SECRET`; `--callback-url` не
  знадобився: обидва застосунки передають `callbackUrl`). Застосунок — `npm run build && npm start` з копії.
  Форму відправляли як браузер без JS (multipart POST з прихованими полями форми), час — від POST до відповіді.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): 3 PASS, 7 FAIL
  (C1, C3, C4, C5, C7, C8, C15 — старий виклик `lead-created` у `app/actions.ts:54` і `.env.example`), 5 N/A — старий
  код, в оцінку прогонів не йде.

## A — без скіла

- Які скіли бачив агент (окремий запуск `claude -p "/context"` у теці копії): жодного проєктного; лише
  вбудовані Claude Code і synced з claude.ai (у `init` сесії теж немає жодного n8n-скіла).
- Що зробив агент: сторінку `/quotes/new` з формою (`useActionState`, валідація в `lib/quote-form.ts`),
  Server Action `requestQuote` зберігає запит `queued` і робить `redirect("/quotes/<uuid>")`, виклик n8n — в
  `after()` через `lib/quote-workflow.ts` (`fetch` з `AbortSignal.timeout(15_000)`, без повторів). Колбек —
  `POST /api/quotes/[id]/callback` з **власною схемою**: `Authorization: Bearer <callbackToken>` (випадковий
  токен на запит, передається в n8n у тілі; порівняння через `timingSafeEqual`), тіло `{status, pdfUrl}`,
  `request.json()`. Сторінка `/quotes/[id]` з автооновленням кожні 5 с. У `.env.example` — **нові** ключі
  `N8N_QUOTE_WEBHOOK_URL`, `APP_URL`; старий `N8N_WEBHOOK_URL=…/webhook-test/lead-created` і старий виклик
  `lead-created` не чіпав.
- Звідки агент узяв домовленості: загальні знання + документація Next.js у `node_modules` (читав `after.md`,
  шукав `RouteContext`, `connection`, `forbidden`) + наявний код (форма ліда як зразок). Про Header Auth,
  `idempotency-key`, HMAC-підпис, вікно часу, конверт — нічого: у копії їх ніде немає.
- Фінальна відповідь (скорочено): «Сторінки, Server Action і callback-ендпоінт готові… **Наживо я цей потік не
  запускав**… Вузол Webhook має відповідати одразу (режим „Respond: Immediately“)… n8n отримує `quoteId`,
  `company`, `email`, `description`, `budget`, `callbackUrl` і `callbackToken`… n8n має надіслати `POST` на
  `callbackUrl` із `Authorization: Bearer <callbackToken>`… Потрібно від вас: додати у `.env.local`
  `N8N_QUOTE_WEBHOOK_URL`, `APP_URL`». Питань не ставив, лише пропозиції.
- Змінені файли (`git diff --cached --stat base`): 11 файлів, +508 / −1 — `.env.example`,
  `app/api/quotes/[id]/callback/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/new/{actions.ts,page.tsx}`,
  `components/{quote-form,quote-status-refresher}.tsx`, `lib/{db,quote-form,quote-workflow,types}.ts`;
  діф: [`docs/ab/a-without-skill.diff`](ab/a-without-skill.diff)
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL`, `APP_URL` (у `.env.local` копії для мока:
  `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request`, `APP_URL=http://127.0.0.1:3000` + змінні мока
  `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, які код A не читає).
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` — лише код прогону (скрипт після виправлення
  `8c9cb02`, див. «Що змінили в скілі»):
  ```
  C1   PASS  no test webhook URL (/webhook-test/) in code or .env.example
  C2   PASS  no N8N_* variable with NEXT_PUBLIC_ prefix
  C3   FAIL  n8n is called only from lib/n8n/client.ts
        lib/quote-workflow.ts:17  const webhookUrl = process.env.N8N_QUOTE_WEBHOOK_URL;
  C4   FAIL  lib/n8n/client.ts exists and starts with import "server-only"
        lib/quote-workflow.ts:17  n8n is called here, but lib/n8n/client.ts does not exist
  C5   PASS  every fetch() to n8n has a timeout signal
  C6   N/A   n8n client sends x-n8n-token, idempotency-key, x-correlation-id
  C7   FAIL  .env.example lists the contract keys with safe values
        .env.example  missing N8N_WEBHOOK_BASE_URL
        .env.example  missing N8N_WEBHOOK_TOKEN
        .env.example  missing N8N_CALLBACK_SECRET
        .env.example  missing APP_BASE_URL
  C8   PASS  Server Actions do not wait for n8n (call runs inside after())
  C9   FAIL  callback reads the raw body; no .json()/JSON.parse before the signature check
        app/api/quotes/[id]/callback/route.ts:35  request.json() — read await req.text() and verify first
        app/api/quotes/[id]/callback/route.ts  body is not read as raw text (await req.text())
  C10  PASS  callback signature compared with crypto.timingSafeEqual, not ===
  C11  FAIL  callback rejects x-n8n-timestamp outside a 300 s window
        app/api/quotes/[id]/callback/route.ts  x-n8n-timestamp is never read
  C12  FAIL  callback deduplicates by idempotency-key
        app/api/quotes/[id]/callback/route.ts  idempotency-key header is never read
        app/api/quotes/[id]/callback/route.ts  no {"duplicate": true} response for a repeated key
  C13  PASS  no runtime = "edge"
  C14  PASS  n8n code does not log bodies, headers, secrets or personal data
  C15  FAIL  request body is the envelope {version, event, data}, not a whole DB row
        lib/quote-workflow.ts:23  request body has no envelope version/event

  7 PASS, 7 FAIL, 1 N/A
  exit=1
  ```
  (C6 N/A — клієнтського модуля немає, це вже покриває C4. C10 PASS — A порівнює свій Bearer-токен через
  `timingSafeEqual`, підпису як такого немає.) На всьому коді копії A: 4 PASS, 10 FAIL.
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] 11:00:25.168Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 11:00:25.791Z POST /webhook/quote-request -> 403 in 2 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 439 B sha256=5afbcf51…
  ```
  Колбека немає: воркфлоу не запустився (403). Навіть якби запустився, підписаний колбек n8n (без `Authorization:
  Bearer`, з тілом `{version, event, data}`) роут A відхилив би як 404 — схеми несумісні.
- Час від «Надіслати» до відповіді форми: **173 мс** (`POST 303`, `location=/quotes/c6deb987-…`)
- Що показала `/quotes/<id>`: одразу й через 9 с — «Не вдалося підготувати кошторис. Не вдалося запустити
  підготовку кошторису. Спробуйте ще раз трохи згодом.» (після 403 агентський код ставить `failed` — і це
  хороша поведінка: сторінка не «висить»).
- Журнал сервера: `Failed to start quote-request workflow for quote c6deb987-… Error: n8n responded with 403`
  + стек. Тіл, email, телефонів, токенів, підписів — 0 (`grep -ciE 'olena.test@|Nova Dental|онлайн-записом|sha256=|x-n8n-token'` → 0).
  Але в n8n **пішов email клієнта** (`email` у тілі, 439 Б) — PDF-кошторису він не потрібен.

## B — зі скілом

- Які скіли бачив агент (окремий запуск `/context`): `integrating-n8n-webhooks` (Project, ~300 токенів) + ті самі
  вбудовані й synced, що в A.
- **Чи викликав агент скіл:** так — **першим же кроком** інструмент `Skill` з `integrating-n8n-webhooks` (у
  журналі `"skill":"integrating-n8n-webhooks"`), далі прочитав усі чотири `references/*.md`, код
  `scripts/send-signed-callback.mjs`, `scripts/mock-n8n.mjs` і (двічі) `scripts/check-contract.mjs`; тричі
  пробував запустити `check-contract.mjs` — відхилено дозволами, тому «пройшов перевірку контракту вручну за кодом
  скрипта» і сам виправив одне порушення C14 у своєму колбек-роуті.
- Що зробив агент: `lib/n8n/client.ts` за шаблоном скіла (`server-only`, конверт, 3 заголовки, таймаут 10 с,
  2 повтори лише на мережу/5xx); `/quotes/new` + Server Action (запис `queued` з `idempotencyKey`/`correlationId`,
  повертає `{ status: "queued", id }`, виклик n8n в `after()`, результат виклику → `processing`/`failed`);
  колбек `app/api/n8n/[event]/route.ts` рівно за 10 кроками (404/415 → `req.text()` → 413 → 300 с → HMAC +
  `timingSafeEqual` → застовпити ключ / `duplicate` → парсинг + звірка ключа з тілом → запис до відповіді → 202);
  `/quotes/[id]` з автооновленням; **переробив старий `lead-created`** на той самий клієнт (мінімум даних, без
  контактів/IP); `.env.example` — 4 ключі контракту; `docs/n8n-integrations.md` — реєстр і текст налаштувань n8n.
- Фінальна відповідь (скорочено): «…Решту перевірок я не запустив: скрипт перевірки контракту, сервер і мок
  n8n потребують вашого дозволу… **Я змінив наявну відправку лідів у n8n (`lead-created`).** Цього вимагає скіл…
  **Воркфлоу клієнта для лідів треба оновити до злиття цієї зміни**… `.env.local` треба оновити вручну. Я його не
  відкривав… Обмеження демо: запити й оброблені колбеки в пам'яті… публічна форма без захисту від спаму». Питань
  не ставив; попередження про ламку зміну `lead-created` — правильне, це рішення людини.
- Змінені файли (`git diff --cached --stat base`): 13 файлів, +699 / −13 — `.env.example`, `app/actions.ts`,
  `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/new/{actions.ts,page.tsx}`,
  `components/{quote-form,quote-status-refresher}.tsx`, `docs/n8n-integrations.md`,
  `lib/{db,n8n/client,quote-form,types}.ts`; діф: [`docs/ab/b-with-skill.diff`](ab/b-with-skill.diff)
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`,
  `APP_BASE_URL` (замість `N8N_WEBHOOK_URL`) — імена збіглися зі змінними мока, окремих не знадобилось.
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base` — лише код прогону:
  ```
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
  На всьому коді копії B (без прапорця) — теж 15 PASS, 0 FAIL: агент прибрав і старі порушення базової лінії.
  (Першим запуском версія скрипта з BASE дала тут хибний C1 FAIL на коментарі `.env.example` — див. нижче.)
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] 11:00:51.006Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 11:00:51.657Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 355 B sha256=cccf8e6c…
  [mock-n8n] 11:00:51.657Z workflow 03ab3aaa-… running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 11:00:56.927Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 268 ms (try 1/3) event=quote-request.completed body 382 B sha256=776321a6…
  ```
- Час від «Надіслати» до відповіді форми: **233 мс** (`POST 200`, у відповіді посилання `/quotes/q_09d40eef-…`)
- Що показала `/quotes/<id>`: одразу — «Готуємо кошторис»; через 9 с — «Готово. Кошторис підготовлено.» і кнопка
  «Завантажити PDF» (`https://files.example.test/n8n/03ab3aaa-….pdf`).
- Журнал сервера: `n8n.webhook { event: 'quote-request', correlationId: '6795f63e-…', status: 202, attempt: 1, ms: 19 }`,
  `n8n.callback { event: 'quote-request.completed', correlationId: '6795f63e-…', status: 'completed', bytes: 382 }`.
  Тіл, email, телефонів, токенів, підписів — 0. Email клієнта в n8n **не йде** (у `data` лише `quoteId`, `company`,
  `description`, `budget`).
- Матриця колбеків (`send-signed-callback.mjs` проти роуту B): valid 202, repeat 200 `duplicate=true`,
  bad-signature 401, stale-timestamp 401, reformatted-body 401, key-mismatch 400, wrong-type 415, unknown-event 404,
  too-large 413 — **9/9 OK**.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, першим кроком; прочитано 4 `references/` і 3 скрипти |
| `check-contract.mjs --changed-since base`: FAIL (id) | **7 FAIL**: C3, C4, C7, C9, C11, C12, C15 | **0 FAIL** (15 PASS) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request` (новий), старий `/webhook-test/lead-created` лишився | `/webhook/<event>` для обох подій |
| `auth=` / `idempotency=` у журналі мока | `auth=missing`, `idempotency` — немає заголовка | `auth=ok idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні — воркфлоу не запущено (403); схема колбека A (Bearer + `{status,pdfUrl}`) з n8n команди несумісна | так, `-> 202` з першої спроби |
| Час відповіді форми | 173 мс (n8n в `after()`) | 233 мс (n8n в `after()`) |
| Що показала `/quotes/<id>` | «Не вдалося запустити підготовку кошторису» | «Готово» + PDF |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Персональні дані, що йдуть у n8n | email клієнта | немає (мінімум `data`) |
| Змінених файлів | 11 (+508/−1) | 13 (+699/−13) |
| Запитання агента | немає (попередження про спам і пам'ять) | немає (попередження про ламку зміну `lead-created`) |
| Час / кроки / вартість прогону | 4 хв 37 с, 45 кроків, $1,42 | 5 хв 17 с, 62 кроки, $1,81 |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` (застосувався чисто, без конфліктів) → окремий коміт
  **без змін** `a93ce31` «feat(quotes): quote request via n8n — transferred from A/B run B». `.env.local` і
  `node_modules/` не переносили; `package.json`/`package-lock.json` агент не змінював.
- Що довелось доробити руками після перенесення (окремими комітами):
  - `f428c74` — коментар у `.env.example` містив рядок «never /webhook-test»; переписали без цього літерала
    (DoD: жодного `/webhook-test/` у `.env.example`, навіть у коментарі).
  - `3ef1f82` `fix(server-after-nonblocking)` — у старому `submitLead` агент переніс n8n в `after()`, але лишив
    `await logAudit("lead.created")` (250 мс) перед відповіддю; перенесли в `after()`. Скіл n8n цього не дав, бо
    аудит — не n8n; це правило скіла форм і Vercel.
  - Код прогону B більше не чіпали: `check-contract.mjs` одразу після перенесення дав 0 FAIL на всьому коді.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає. У `.env.local` — ті самі ключі, секрети згенеровано
  `crypto.randomBytes(32)` прямо у файл (значення ніде не друкувались). `git ls-files ".env*"` → лише `.env.example`.
- `npm run lint`, `npm run build` на гілці: без помилок (`/api/n8n/[event]`, `/quotes/[id]`, `/quotes/new` у збірці).
- `check-contract.mjs` на фінальному коді (0 FAIL, код виходу 0):
  ```
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
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці (`node --env-file=.env.local tools/mock-n8n.mjs
  --mode respond-202 --delay 5000`): форма **265 мс**; мок `POST /webhook/quote-request -> 202 auth=ok
  idempotency=new`, через 5 с `callback POST …/api/n8n/quote-request -> 202 (try 1/3)`; `/quotes/q_8736a434-…`:
  «Готуємо кошторис» → «Готово» + «Завантажити PDF». Матриця колбеків на гілці — 9/9 OK. Форма ліда на `/`:
  159 мс, мок `POST /webhook/lead-created -> 202 auth=ok idempotency=new`, тіло 112 Б (раніше — весь рядок ліда на
  тестовий URL без токена). У журналі сервера персональних даних — 0.
- Рядок у `docs/n8n-integrations.md`: є — його створив агент у прогоні B (реєстр `lead-created` і `quote-request` +
  текст налаштувань n8n для клієнта); поле «власник» лишилось заповнити команді.

### Що змінили в скілі після прогонів

Коміт `8c9cb02` `fix(skill): check-contract detects non-contract n8n names, ignores comments` — скіл «пережив
перший бій» і виявив два власні недоліки:

1. **Прогалина на коді A.** Агент без скіла назвав змінну `N8N_QUOTE_WEBHOOK_URL`, а колбек поклав у
   `app/api/quotes/[id]/callback/route.ts`. Скрипт шукав лише імена з контракту (`N8N_WEBHOOK*`, `/api/n8n/`), тож
   першим запуском показав для A лише C7 FAIL, а C3–C15 — «PASS»/N/A порожньо. Тепер будь-яка `process.env.N8N_*`
   (крім секрету колбека) вважається викликом n8n, а колбеком — будь-який route із `callback` у шляху чи згадкою
   n8n; C4 звітує по кожному файлу з викликом. Результат на `main` не змінився (7 FAIL), на A стало 7 FAIL.
   Урок: перевірка, що ловить лише «правильні» імена, не бачить коду, написаного без скіла, — а саме його й треба ловити.
2. **Хибний FAIL на коді B.** C1 спрацьовував на коментар `.env.example` «never /webhook-test». Тепер коментарі
   (`#`, `//`, `*`) не рахуються.

Спостереження без зміни скіла: в обох прогонах агент хотів запустити перевірки (B — `check-contract.mjs`, A — власний
мок), але headless-дозволи цього не дали; Verify довелось проганяти людині. У звичайній інтерактивній сесії це
питання одного «так».

## Висновок

Скіл змінив результат суттєво і вимірювано: однаковий запит, та сама модель — A дав 7 FAIL контракту й **не працює з
n8n команди** (мок відповів `403 auth=missing`, колбека не було, сторінка показала «не вдалося»), B — 0 FAIL, колбек
прийнято з першої спроби, 9/9 випадків матриці, «Готово» з PDF. Без скіла агент узяв з загальних знань і документації
Next.js саме ті частини, що в них є (`after()`, таймаут, `timingSafeEqual` для власного Bearer-токена, публічний UUID),
але всю командну домовленість — Header Auth `x-n8n-token`, `idempotency-key`, HMAC-підпис із вікном 300 с, конверт,
мінімум даних (email у n8n не шлемо), один `lib/n8n/client.ts`, реєстр — вигадав по-своєму або пропустив. Після
перенесення B довелось доробити руками лише дві дрібниці поза n8n (коментар `.env.example`, аудит в `after()`); у скілі
ж виправили `check-contract.mjs`, бо він «не бачив» коду з нестандартними іменами.
