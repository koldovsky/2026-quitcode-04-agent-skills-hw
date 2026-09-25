# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code 2.1.280, десктоп-застосунок (вкладка Code), Windows 10 Pro
- **Модель і рівень міркування (effort), однакові в обох прогонах:** Opus 5.5 (`claude-opus-5-5[1m]`) · High
- **Код:** BASE = `4baf4e7` (коміт після Task C: виправлення Task A, форма нотаток з Task B, три скіли; ще
  без `/quotes` і без змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з `4baf4e7`
  (скіл закомічено в `82bef87`, далі до прогонів не змінювався)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`);
  у кожній — власний `git init`, коміт `start` з тегом `base`, `npm install` з `package-lock.json`
  (після встановлення `git status` — 0 змін)
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks` — `git archive HEAD .claude/skills/integrating-n8n-webhooks`).
  Перевірено:
  - `find ../leaddesk-ab-a ../leaddesk-ab-b -name SKILL.md -not -path "*/node_modules/*"` → рівно один рядок,
    `../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`;
  - `ls -A … | grep -xE 'tools|materials|docs|README.md|.coderabbit.yaml|.github'` → «no hints - ok»;
  - `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a --exclude-dir=node_modules` →
    «no contract - ok» (у коді BASE контракту немає: виклик `lead-created` до Task D не чіпали);
  - `git ls-files` копій відрізняється рівно 9 файлами скіла.
- **Особисті копії скіла:** `~/.claude/skills` містить лише порожню службову теку `synced` (без жодного
  `SKILL.md`). `~/.agents/skills` і `~/.codex/skills` мають сторонні скіли (`handoff`, `n8n-rag-workflows`,
  `stop-slop`), але Claude Code ці теки не читає — `/context` нижче їх не показує.
- **Обмеження, однакове для обох:** `/context` показує скіли з джерелом «claude.ai sync» (`anthropic-skills:docs`,
  `pdf`, `skill-creator`, `morning`, `import-memory`; у знімку A ще `xlsx`, `pptx`, `docx` — синхронізація
  облікового запису ще тривала). Вони приходять з облікового запису, не з проєкту, стосуються документів, а не
  n8n чи форм, і в жодному прогоні не викликались.
- **Запит:** текст між лініями з `materials/ab-task.md` без змін, нова сесія на кожен прогін
- **Відповідь на уточнення:** агент не питав в обох прогонах (запити дозволів на читання файлів копії, `lint`,
  `build`, запуск перевірок — дозволено однаково в обох). Поза теку копії жоден агент не просився.
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії; так налаштований n8n клієнта —
  Header Auth, 202, підписаний колбек):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  без `--callback-url`: обидва агенти передають `callbackUrl` у тілі.
- **`.env.local` копій:** змінні, які додав агент, зі значеннями для мока (URL вебхука — production
  `/webhook/<event>`, адреса застосунку — `http://127.0.0.1:3000`), плюс `N8N_WEBHOOK_TOKEN` і
  `N8N_CALLBACK_SECRET` для мока (той самий секрет, що в змінній агента). Секрети згенеровано скриптом, який
  значень не друкує; файли не відкривали.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`), однакова для A і
  B: **5 PASS, 6 FAIL** — C1 (`.env.example:6` `/webhook-test/`), C3/C6/C10 (`app/actions.ts:54` — `fetch` поза
  `lib/n8n`, без таймауту, без `x-n8n-token`/`idempotency-key`), C7 (`app/actions.ts:60` — цілий об'єкт помилки
  в журналі), C9 (ключі контракту в `.env.example`). Це старий код, в оцінку прогонів він не йде.
- **Версія перевірки:** обидва прогони оцінено тією самою версією `check-contract.mjs` після виправлення,
  знайденого на прогоні A (`7593db2`, див. нижче); до й після виправлення кількість FAIL не змінилась.

## A — без скіла

- **Які скіли бачив агент** (окремий запуск `MSYS_NO_PATHCONV=1 claude -p "/context"` у теці копії): жодного
  проєктного; лише Built-in і «claude.ai sync».
- **Час роботи:** 14:43–14:53 (10 хв).
- **Що зробив агент:** форма `/quotes/new` з валідацією (введене зберігається), Server Action створює запит
  `pending` і **синхронно** (з таймаутом 10 с) викликає вебхук, потім `redirect` на `/quotes/<id>`; при
  помилці — `failed`. Колбек — `app/api/quotes/[id]/callback/route.ts`, авторизація
  `Authorization: Bearer <N8N_CALLBACK_SECRET>` (порівняння через `timingSafeEqual` хешів), тіло
  `{status:"ready", pdfUrl}` через `request.json()`. Сторінка статусу оновлюється кожні 5 с, після 5 хв
  пише «довше, ніж зазвичай».
- **Звідки агент узяв домовленості:** загальні знання й наявний код. Сам сказав, що вивчив «форму лідів,
  `lib/db.ts` та патерни Server Actions» і документацію Next 16 у `node_modules` (route handlers, `after()`,
  `redirect`). З наявного коду — схема змінної: у `.env.example` був `N8N_WEBHOOK_URL=…/webhook-test/lead-created`,
  і агент додав поруч `N8N_QUOTE_WEBHOOK_URL=…/webhook-test/quote-request`. З загальних знань — таймаут,
  `after()` для аудиту, `timingSafeEqual`, «не будувати URL колбека з `Host`», «Respond: Immediately» в n8n.
  Рішень команди (HMAC-підпис колбека, `x-n8n-token`, `idempotency-key`, 202 + `job_id`, імена змінних,
  production URL) взяти не було звідки.
- **Запитання агента і фінальна відповідь (скорочено):** запитань не було. «Додав `/quotes/new`, Server Action,
  що запускає `quote-request`, callback-ендпоінт для n8n і сторінку статусу… Callback-ендпоінт приймає `POST`
  із заголовком `Authorization: Bearer <N8N_CALLBACK_SECRET>`… Що потрібно від вас: додати в `.env.local`
  `N8N_QUOTE_WEBHOOK_URL`, `N8N_CALLBACK_SECRET`, `APP_URL`; у Webhook-вузлі обрати Respond: Immediately…
  Виклик вебхука n8n, як і наявний вебхук для лідів, іде без автентифікації.»
- **Змінені файли** (`git diff --cached --stat base`): 11 файлів, +565 −1 — `.env.example`,
  `app/api/quotes/[id]/callback/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/new/actions.ts`,
  `app/quotes/new/page.tsx`, `components/quote-form.tsx`, `components/quote-status-poller.tsx`, `lib/db.ts`,
  `lib/quote-form.ts`, `lib/quote-workflow.ts`, `lib/types.ts`; діф: [`docs/ab/a-without-skill.diff`](ab/a-without-skill.diff)
- **Змінні середовища, які додав агент:** `N8N_QUOTE_WEBHOOK_URL` (у `.env.example` — `/webhook-test/`),
  `N8N_CALLBACK_SECRET` (порожнє значення), `APP_URL`.
- **`check-contract.mjs --root ../leaddesk-ab-a --changed-since base`** — лише код прогону:
  ```
  FAIL  C1   .env.example:10  test webhook URL in .env.example
  PASS  C2
  FAIL  C3   lib/quote-workflow.ts:28  fetch to n8n outside lib/n8n/* — use the n8n client module
  FAIL  C4   app/api/quotes/[id]/callback/route.ts:26  request.json() — read the raw text first; re-serialising breaks the signature
             app/api/quotes/[id]/callback/route.ts:1  raw body is never read (request.text())
  FAIL  C5   app/api/quotes/[id]/callback/route.ts:1  no HMAC-SHA256 over the raw body
  PASS  C6
  PASS  C7
  PASS  C8
  FAIL  C9   .env.example:1  missing N8N_WEBHOOK_BASE_URL · missing N8N_WEBHOOK_TOKEN · missing APP_BASE_URL
             .env.example:10  N8N_QUOTE_WEBHOOK_URL is not a contract key
             .env.example:13  N8N_CALLBACK_SECRET must be a change-me-… placeholder
  FAIL  C10  lib/quote-workflow.ts:28  fetch to n8n without x-n8n-token and idempotency-key
  FAIL  C11  app/api/quotes/[id]/callback/route.ts:1  no 415 · no 413 (64 KB) · x-n8n-timestamp is not checked · idempotency-key is not used

  4 PASS, 7 FAIL · 6 finding(s) outside the changed lines not shown
  exit=1
  ```
- **Журнал мока** (форма → колбек → `/quotes/<id>`):
  ```
  POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 317 B sha256=d7be6151…
  ```
  Далі нічого: на 403 «воркфлоу» не запускається, колбека немає. URL — `/webhook/` (у `.env.local` копії
  поставили production-адресу; у `.env.example` агента — `/webhook-test/`, з яким мок, як і n8n, відповів би
  404 без `--listen`). `idempotency` мок не записав, бо запит відхилено ще на Header Auth; заголовка
  `idempotency-key` у списку імен немає.
- **Додатково (поза основним сценарієм):** той самий мок **без** Header Auth (`N8N_WEBHOOK_TOKEN=` порожній) —
  чи прийме застосунок підписаний колбек:
  ```
  POST /webhook/quote-request -> 202 in 8 ms auth=none idempotency=absent | headers: accept,accept-language,content-type,user-agent | body 317 B
  workflow 5337df1e-… running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3000/api/quotes/quote_7fb380d2-…/callback -> 401 in 87 ms (try 1/3) event=quote-request.completed body 314 B
  ```
  Колбек n8n за контрактом (HMAC у `x-n8n-signature`) застосунок A відхиляє з 401 — він чекає
  `Authorization: Bearer`. Сторінка лишається на «Готуємо кошторис…».
- **Час від «Надіслати» до відповіді форми:** 322 мс (`POST /quotes/new` → 303, відправка як HTML-форма);
  у додатковому прогоні — 163 мс. Виклик n8n іде синхронно в дії, тож із повільним n8n форма чекала б до 10 с.
- **Що показала `/quotes/<id>`:** «Не вдалося підготувати кошторис» (запуск відхилено 403); у додатковому
  прогоні — «Готуємо кошторис…» назавжди.
- **Журнал сервера:** `Failed to start quote-request workflow for quote_c1af3d85-…: n8n responded with HTTP 403`.
  Тіл запитів, email, телефонів, токенів, підписів немає (пошук назви компанії, email і тексту опису — 0).

## B — зі скілом

- **Які скіли бачив агент** (окремий запуск `/context` у теці копії): `integrating-n8n-webhooks` (Project, ~320
  токенів) + Built-in і «claude.ai sync».
- **Час роботи:** 15:02–15:15 (13 хв).
- **Чи викликав агент скіл:** так, сам, першим кроком — у стрічці інструментів «Ran skill/integrating-n8n-webhooks»,
  «Launching skill: integrating-n8n-webhooks»; далі «Read contract and Next.js patterns references», «Read
  remaining skill references». Агент також запускав скрипти скіла: `check-contract.mjs` («11 з 11 пройшли»),
  `send-signed-callback.mjs` («11 з 11») і мок скіла `scripts/mock-n8n.mjs` зі значеннями-заглушками з
  `.env.example` (копія мока — частина скіла, не витік).
- **Що зробив агент:** `lib/n8n/client.ts`, `callback.ts`, `idempotency.ts` за шаблонами скіла; Server Action
  зберігає запит `queued`, одразу `redirect`, виклик n8n (202 + `job_id`, таймаут, повтори, той самий
  `idempotency-key`) — в `after()`; колбек `app/api/n8n/[event]/route.ts` з сирим тілом, HMAC +
  `timingSafeEqual`, вікном 300 с, ідемпотентністю; тільки `https://` для посилання на PDF; сторінка статусу
  оновлюється кожні 3 с; 4 ключі контракту в `.env.example`; реєстр `docs/n8n-integrations.md`.
- **Запитання агента і фінальна відповідь (скорочено):** запитань під час роботи не було. У фінальній відповіді —
  **зупинка за правилом скіла**: «Перевірка контракту по всьому репозиторію ще показує 6 порушень. Усі вони в
  старому коді… `submitLead` (`app/actions.ts:54`) та рядок `N8N_WEBHOOK_URL` у `.env.example`… Я це не чіпав.
  Правильна адреса для `lead-created` мені невідома, а якщо урізати дані, можна зламати воркфлоу клієнта.
  Перевести його на нового клієнта з мінімальними даними, щойно ви підтвердите робочу адресу
  `/webhook/lead-created` і які поля потрібні воркфлоу?» А також: «Я виходив з того, що воркфлоу одразу
  відповідає `202 {"job_id": …}`… як насправді налаштований воркфлоу клієнта, я не бачив» — і посилання на
  `n8n-side-setup.md` для людини.
- **Змінені файли** (`git diff --cached --stat base`): 14 файлів, +753 −1 — `.env.example`,
  `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`, `app/quotes/new/page.tsx`,
  `components/quote-form.tsx`, `components/quote-status-refresh.tsx`, `docs/n8n-integrations.md`, `lib/db.ts`,
  `lib/n8n/callback.ts`, `lib/n8n/client.ts`, `lib/n8n/idempotency.ts`, `lib/quote-form.ts`, `lib/types.ts`;
  діф: [`docs/ab/b-with-skill.diff`](ab/b-with-skill.diff)
- **Змінні середовища, які додав агент:** `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`,
  `APP_BASE_URL` (секрети — `change-me-…`, адреси локальні, `/webhook`).
- **`check-contract.mjs --root ../leaddesk-ab-b --changed-since base`** — лише код прогону:
  ```
  PASS  C1 … PASS  C11   (усі 11)

  11 PASS, 0 FAIL · 6 finding(s) outside the changed lines not shown
  exit=0
  ```
  6 прихованих — старий код базової лінії (`app/actions.ts:54/60`, `.env.example:17`), саме те, про що агент спитав.
- **Журнал мока** (форма → колбек → `/quotes/<id>`):
  ```
  POST /webhook/quote-request -> 202 in 4 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 317 B sha256=9b953178…
  workflow d7555b48-ffec-482f-9dc9-b27c1bc30a26 running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 152 ms (try 1/3) event=quote-request.completed body 382 B sha256=bd6ed6a9…
  ```
- **Час від «Надіслати» до відповіді форми:** 151 мс (`POST /quotes/new` → 303). Перша відправка з порожнім
  бюджетом — 200 з помилкою валідації (бюджет у B — обов'язкове число 100–1 000 000 $), як і має бути.
- **Що показала `/quotes/<id>`:** через ~5 с — «Готово» і посилання
  `https://files.example.test/n8n/d7555b48-ffec-482f-9dc9-b27c1bc30a26.pdf` (той самий `jobId`, що в журналі мока).
- **Матриця колбеків** проти роуту B на справжньому `job_id` (мок `--delay 60000`, щоб запит був у `processing`):
  valid 202, duplicate 200, bad-signature 401, missing-signature 401, stale-timestamp 401, future-timestamp 401,
  reformatted-body 401, wrong-content-type 415, unknown-event 404, key-mismatch 400, oversized 413 — **11 PASS**, exit 0.
- **Журнал сервера:**
  ```
  [n8n] quote-request -> 202 in 31 ms (attempt 1, correlation 280553bf-…)
  [n8n] callback quote-request completed accepted (correlation 280553bf-…)
  ```
  Тіл, email, телефонів, токенів, підписів немає (назва компанії, email, текст опису, `sha256=` — 0 входжень).

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, сам, першим кроком; читав `references/`, запускав `scripts/` |
| `check-contract.mjs --changed-since base`: FAIL (id) | **7 FAIL**: C1, C3, C4, C5, C9, C10, C11 | **0 FAIL** |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook-test/` у `.env.example` | `/webhook` (база) + `/quote-request` |
| `auth=` / `idempotency=` у журналі мока | `auth=missing` → 403 (без Header Auth: `idempotency=absent`) | `auth=ok idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні (403 на запуску); з вимкненим Header Auth — 401 (чекає Bearer, не HMAC) | так, 202 |
| `/quotes/<id>` | «Не вдалося підготувати кошторис» | «Готово» + посилання на PDF |
| Час відповіді форми | 322 мс (n8n викликається синхронно, до 10 с) | 151 мс (n8n — в `after()`) |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Змінних середовища | 3 власні (`N8N_QUOTE_WEBHOOK_URL`, `N8N_CALLBACK_SECRET`, `APP_URL`) | 4 з контракту |
| Змінених файлів | 11 (+565) | 14 (+753), зокрема `docs/n8n-integrations.md` |
| Запитання агента | немає | немає під час роботи; у фіналі — зупинка щодо старого `lead-created` |
| Час роботи агента | 10 хв | 13 хв |

## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --check docs/ab/b-with-skill.diff` → `git apply --3way docs/ab/b-with-skill.diff`
  у робочій гілці на коді BASE (+ документація й виправлення скіла після BASE; конфліктів немає). Діфи — коміт
  `89b1bc6`; перенесений результат B **без змін** — коміт `4875ac5`. `.env.local` і `node_modules` не переносили;
  нових залежностей B не додавав (`package.json` у діфі немає).
- **Що довелось доробити руками (і чому скіл цього не дав):** лише старий код, який агент B свідомо не
  чіпав і про який спитав (правило зупинки «невідомий production-шлях»):
  - `f6ecfd4` — `submitLead` (`app/actions.ts`): виклик `lead-created` через `lib/n8n/client.ts` в `after()`
    разом з аудитом; production-шлях `/webhook/lead-created` (за контрактом ім'я події = шлях); у n8n іде
    лід без IP, user agent, сирих даних форми й нотаток; у журналі більше немає цілого об'єкта помилки.
    Закрило C3, C6, C7, C10.
  - `ec84492` — `.env.example`: прибрано рядок `N8N_WEBHOOK_URL=…/webhook-test/lead-created`; у
    `docs/n8n-integrations.md` — рядок і примітки для `lead-created`. Закрило C1, C9.
  - Новий код прогону B доробок не потребував.
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає. У `.env.local` ті самі ключі додала людина
  скриптом `update-env-local.mjs` (поза репозиторієм; генерує секрети, друкує лише назви ключів).
- **`npm run lint`, `npm run build` на гілці:** без помилок і попереджень.
- **`check-contract.mjs` на фінальному коді:** 11 PASS, 0 FAIL, exit 0 (повний вивід — `docs/verification.md`).
- **Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці** (`npm run build && npm start`,
  `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`):
  ```
  POST /quotes/new -> HTTP 303 in 187 ms, location: /quotes/q_63a2dbf6-…
  [mock] POST /webhook/quote-request -> 202 in 4 ms auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token | body 317 B
  [mock] workflow e014e9e2-0356-4c31-ba6c-99037688576d running for 5000 ms, then callback event=quote-request.completed
  [mock] callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 138 ms (try 1/3)
  lead form: HTTP 200 in 243 ms | thank-you shown: yes
  [mock] POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token | body 325 B
  [server] [n8n] quote-request -> 202 in 35 ms (attempt 1, correlation 47c50132-…)
  [server] [n8n] callback quote-request completed accepted (correlation 47c50132-…)
  [server] [n8n] lead-created -> 202 in 7 ms (attempt 1, correlation 735dc9c4-…)
  ```
  `/quotes/q_63a2dbf6-…` — «Готово» і посилання на `…/e014e9e2-0356-4c31-ba6c-99037688576d.pdf`. Персональних
  даних у журналі сервера — 0 входжень.
- **Реєстр інтеграцій:** `docs/n8n-integrations.md` — `quote-request` (створив агент B) і `lead-created`
  (доповнено під час доведення).
- **Що скіл змінив у собі після прогонів:** `7593db2` — перевірки колбека в `check-contract.mjs` тепер
  враховують усі прямі імпорти роуту. На прогоні A верифікація токена жила в `lib/quote-workflow.ts`, і C5
  хибно повідомляв «signature not compared with timingSafeEqual». Хешування обох значень зараховано як
  вирівнювання довжин, а `===` шукається лише цілими словами (`assignedTo` у `lib/db.ts` — не «sig»). FAIL-и
  прогонів від цього не змінились.

## Висновок

Скіл змінив результат суттєво, і це видно не з враження, а з мока: без скіла агент зробив акуратну фічу за
загальними знаннями (таймаут, `after()` для аудиту, `timingSafeEqual`, захист від підміни `Host`), але вона не
працює з n8n, налаштованим за домовленостями команди, — запуск отримує 403 (немає `x-n8n-token`), а колбек з
HMAC-підписом отримав би 401; у `.env.example` потрапив тестовий URL, скопійований зі старого рядка. Зі
скілом агент сам завантажив його, узяв шаблони з `references/`, перевірив себе скриптами скіла і дав код, що
проходить усі 11 перевірок і весь сценарій (202 → підписаний колбек → «Готово») з першого разу. З моком,
який відповідає миттєво, обидві форми швидкі (151 проти 322 мс), але A чекає n8n у самій дії (до 10 с на
повільному n8n), а B не чекає його зовсім — виклик в `after()`. Доробляти після прогону B довелося лише старий
`lead-created` — там, де агент за правилом зупинки спитав людину, а не вирішив сам. Після прогонів у скілі
виправлено хибне повідомлення перевірки колбека; далі варто додати в `nextjs-patterns.md` приклад переведення
наявного fire-and-forget виклику зі збереженням полів, які потрібні воркфлоу.
