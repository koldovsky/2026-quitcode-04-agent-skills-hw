# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Скопіюйте в `docs/ab-validation.md` і заповніть. Протокол — `materials/ab-task.md`, команди —
> `docs/walkthrough.md`, Task D. **A — без скіла, B — зі скілом.** Числа й цитати беріть із сесії
> та журналів, а не з пам'яті. Фічу «запит на кошторис» будує агент у прогонах; результат
> прогону **B** ви переносите у свою гілку — про це останній розділ.

- **Інструмент і версія:** десктопний застосунок Claude, вкладка Code — Claude Code 2.1.281
  (у журналі сесії `"entrypoint":"claude-desktop"`, `"version":"2.1.281"`)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-5-5` (Opus 5.5),
  effort `xhigh`; режим дозволів `auto`. Так записано в журналах обох сесій: `"effort":"xhigh"` в усіх
  відповідях агента (A — 148, B — 122), `"permissionMode":"auto"`, `"entrypoint":"claude-desktop"`,
  `"version":"2.1.281"`, модель `claude-opus-5-5` в усіх відповідях
- **Код:** BASE = `04e8b58` (ваш коміт після Task C: три скіли й виправлення Task A, ще без `/quotes` і
  змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з `a626d17` (HEAD; від BASE
  відрізняється лише `docs/verification.md`, скіл той самий)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`);
  у кожній — коміт `start` з тегом `base` (A — `4c3da02`, B — `11610f3`), `npm install` — 501 пакет,
  `package-lock.json` не змінився
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і всі скіли (у B повернуто лише `integrating-n8n-webhooks`). Перевірено кроком 1: `find … -name SKILL.md` —
  рівно `../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`; `ls -A` — «no hints - ok»;
  `grep` по A — «no contract - ok». Крім `.git` і скіла, копії однакові (`diff -rq`). Про n8n у копіях
  згадують лише стартові `app/actions.ts` і `.env.example`
- **Особисті копії скіла** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`):
  копії `integrating-n8n-webhooks` немає ніде. `~/.cursor/skills` і `~/.agents/skills` не існують,
  у `~/.codex/skills` — лише системна `.system`. У `~/.claude/skills` був особистий `find-skills`
  (пошук і встановлення скілів; n8n не згадує) — на час обох прогонів перенесено в `~/find-skills.off`,
  щоб агент у прогоні A не встановив сторонній скіл для n8n
- **MCP, однакові в обох:** ті самі 15 конекторів claude.ai (`claude mcp list` — усі Connected)
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін. У сесії A слова запиту
  збігаються з текстом між лініями дослівно; відрізняються лише переноси рядків і бектики (вставлено
  з відрендереного markdown); у сесії B запит байт у байт той самий, що в A
- **Відповідь на уточнення, однакова в обох:** не знадобилась — в обох сесіях агент не зупинявся з
  питаннями, у кожній лише одне повідомлення користувача (запит). B лишив три запитання у фінальній
  відповіді, коли все вже зробив; на них не відповідали
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`,
  без `--callback-url` (обидва застосунки передають `callbackUrl` у тілі). Застосунок копії —
  `npm run build && npm start` на :3000 (перед цим зупинено `next-server` робочого репозиторію, що
  займав :3000). Журнали — `../ab-logs/{a,b}-{mock,server}.log` (`tee`). У `.env.local` обох копій —
  ті самі значення токена й секрету мока (`change-me-…` з `.env.example` копії B). Зараховані запуски:
  A — 2026-09-27 21:54–21:55 UTC і повтор о 22:05 (для заміру часу; журнали — з нього), B — 21:57 UTC; мок на старті обох: `header auth: x-n8n-token required`,
  `callbacks: signed`. Перша спроба A (21:41) — без змінних мока, не враховується (див. розділ A)
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): однакова
  в A і B — 14 перевірок: 2 PASS · 7 FAIL · 5 SKIP. FAIL: C1, C3, C4, C6, C7, C8, C14 (усі —
  `app/actions.ts:61`/`:67` і `.env.example:6`); PASS: C2, C9; SKIP: C5, C10–C13 (немає `lib/n8n/` і
  роуту колбеку) — це старий код, в оцінку прогонів він не йде

## A — без скіла

- Які скіли бачив агент (окремий запуск `/context`): жодного проєктного чи особистого — лише вбудовані
  й синхронізовані з claude.ai, ті самі, що в B
- **Сесія:** `8b80682f-d047-4b0a-b3cd-0d867cd52682`, 2026-09-27 20:45:50 → 21:03:02 UTC (≈ 17 хв);
  148 відповідей агента (67 викликів API), ≈ 60,4 тис. вихідних токенів, ≈ 9,6 млн — читання з кешу.
  Інструменти: Bash ×37, Claude Browser ×31 (`browser_batch` ×21, `preview_start`/`preview_stop` ×2,
  `read_page` ×2, `preview_logs` ×2, `get_page_text`, `read_network_requests`), `Write` ×1,
  `ToolSearch` ×1, `spawn_task` ×1. `Skill`, `WebFetch`, `WebSearch`, `AskUserQuestion` — жодного разу
- Що зробив агент — своїми словами:
  - `/quotes/new` — Server Component і клієнтська форма `components/quote-form.tsx` (`useActionState`);
    валідація — `lib/quote-form.ts` за зразком форми ліда (для цього експортував `EMAIL_RE` з
    `lib/lead-form.ts`; варіанти бюджету взяв звідти ж, «/ міс.»);
  - Server Action `requestQuote` (`app/quotes/actions.ts`): валідує, створює запис `processing` у пам'яті
    (`lib/db.ts`: `quotes`, `insertQuote`, `getQuote`, `settleQuote`; id — `randomUUID()`), генерує
    окремий токен колбеку на кожен запит (у базі — лише SHA-256), **чекає** `startQuoteWorkflow()` і
    робить `redirect` на `/quotes/<id>`; якщо запуск не вдався — ставить `failed` і повертає помилку з
    введеними значеннями;
  - виклик n8n — `lib/quotes.ts`: `POST` на `N8N_QUOTE_WEBHOOK_URL` з `AbortSignal.timeout(10_000)`,
    лише `content-type`; тіло пласке — `quoteId, company, email, description, budget, callbackUrl,
    callbackToken`; розраховує, що Webhook-вузол n8n відповідає одразу (Respond: Immediately);
  - колбек `POST /api/quotes/[id]/callback`: спершу `Authorization: Bearer <callbackToken>`
    (`timingSafeEqual` над SHA-256; невідомий id — той самий 401), потім `request.json()`, перевірка
    `status` (`ready`/`failed`) і `pdfUrl` (лише https, у dev — і http); результат фіксується один раз:
    повтор того самого — 200, інший — 409; у журнал — `quote.settled {quoteId, status}`;
  - `/quotes/[id]`: публічна за випадковим UUID, `robots: noindex`, `await connection()`, без email і опису
    (`getQuoteStatus()` у `lib/data.ts`); поки `processing` — `router.refresh()` кожні 4 с і лічильник
    часу (`components/quote-progress.tsx`), після 3 хв — попередження; `ready` — «Завантажити PDF»,
    `failed` — «Новий запит»; невідомий id — 404;
  - перевіряв сам: `npm run build`, `npm run lint`, `npx tsc --noEmit`; **власний** мок n8n у своєму
    scratchpad (порт 5679) і production-збірка на порту 3100 через тимчасово змінений
    `.claude/launch.json` (наприкінці відновив — у діфі його немає). Сценарії: порожня форма, основний
    сценарій з колбеком, n8n 500 і недоступний, `failed`, колбек без токена / з чужим токеном (401),
    `javascript:` і не-JSON (400), повтор (200) і конфлікт (409), очікування 4 хв, ширина 375 px;
  - запропонував окрему задачу `spawn_task` «Add rate limiting to the public quote form».
- Звідки агент узяв домовленості: скіла не мав; поза текою копії нічого не читав і не запитував (у
  викликах інструментів немає `../`, робочого репозиторію, `materials/`, `WebFetch`/`WebSearch`; `ls tools`
  — теки немає). Читав наявний код (`app/actions.ts` зі старим викликом n8n, `lib/db.ts`, `lib/lead-form.ts`,
  `components/lead-form.tsx`, `proxy.ts`, `.env.example`, `.claude/launch.json` тощо) і документацію
  Next.js у `node_modules/next/dist/docs` (route handlers, caching, `connection`, `refresh`, dynamic
  routes, server actions, `after`). Таймаут 10 с і продакшн-шлях `/webhook/` — із загальних знань
  (у стартовому коді таймауту немає, а в `.env.example` — `/webhook-test/`). Схему колбеку (Bearer-токен
  на запит, 409 на конфлікт) агент вигадав сам; HMAC-підпису, часу й ключа ідемпотентності в ній немає.
  Документацію `after()` читав, але запуск воркфлоу лишив в `await` у Server Action
- Запитання агента і фінальна відповідь (цитата, скорочено): запитань не було; відмов у дозволах не було.
  Фінальна відповідь: «Запит на кошторис працює від початку до кінця. … Проти справжнього n8n я не
  перевіряв, лише проти локального мока: воркфлоу треба налаштувати під контракт нижче. Lint і `npm run
  build` проходять. Нічого не закомічено.» Далі — як працює (Server Action «не чекає 40–90 секунд …
  запускає вебхук (очікування до 10 с)»), що налаштувати в n8n (Webhook → Respond: Immediately;
  наприкінці `POST {{callbackUrl}}` з `Authorization: Bearer {{callbackToken}}` і
  `{"status":"ready","pdfUrl":"https://…"}` або `{"status":"failed"}`), які змінні додати в `.env.local`
  (`N8N_QUOTE_WEBHOOK_URL`, `APP_URL`), як перевіряв, і застереження: дані в пам'яті, бюджет «/ міс.»,
  немає обмеження частоти запитів
- Змінені файли (`git diff --cached --stat base`) — 14 файлів, +572 / −2; агент нічого не комітив:
  ```
  .env.example                          |   7 +++
  app/api/quotes/[id]/callback/route.ts |  38 ++++++++++++
  app/quotes/[id]/page.tsx              | 106 ++++++++++++++++++++++++++++++++++
  app/quotes/actions.ts                 |  49 ++++++++++++++++
  app/quotes/layout.tsx                 |  16 +++++
  app/quotes/new/page.tsx               |  24 ++++++++
  components/quote-form.tsx             |  67 +++++++++++++++++++++
  components/quote-progress.tsx         |  44 ++++++++++++++
  lib/data.ts                           |  15 +++++
  lib/db.ts                             |  48 ++++++++++++++-
  lib/lead-form.ts                      |   2 +-
  lib/quote-form.ts                     |  55 ++++++++++++++++++
  lib/quotes.ts                         |  77 ++++++++++++++++++++++++
  lib/types.ts                          |  26 +++++++++
  ```
  діф: `docs/ab/a-without-skill.diff`
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL` (у `.env.example` —
  `http://127.0.0.1:5678/webhook/quote-request`) і `APP_URL` (`http://localhost:3000`). Змінних для
  токена запиту й секрету колбеку немає; старий `N8N_WEBHOOK_URL` з `/webhook-test/` не чіпав
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` — лише код прогону, код виходу 1:
  ```
  check-contract (integrating-n8n-webhooks) · root …/leaddesk-ab-a · 39 source files · scope: changes since base (14 files)

  PASS  C1  no-test-url           only production webhook URLs: no /webhook-test/ in code or .env.example (1 more in unchanged code)
  PASS  C2  env-server-only       n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components
  FAIL  C3  env-example           .env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets (2 more in unchanged code)
          .env.example  missing N8N_WEBHOOK_BASE_URL; missing N8N_WEBHOOK_TOKEN; missing N8N_CALLBACK_SECRET; missing APP_BASE_URL
          .env.example:10  N8N_QUOTE_WEBHOOK_URL is not a contract variable (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
          lib/quotes.ts:35  N8N_QUOTE_WEBHOOK_URL is not a contract variable (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
  FAIL  C4  one-client            n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/ (2 more in unchanged code)
          app/api/quotes/[id]/callback/route.ts  n8n callback route outside app/api/n8n/: use app/api/n8n/[event]/route.ts
  SKIP  C5  server-only           lib/n8n modules that hold config start with import "server-only" (no lib/n8n/ modules)
  PASS  C6  fetch-timeout         every fetch to n8n has signal: AbortSignal.timeout(…) (1 more in unchanged code)
  PASS  C7  request-contract      requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope (1 more in unchanged code)
  PASS  C8  no-waiting            Server Actions start n8n only inside after() (1 more in unchanged code)
  PASS  C9  no-edge               no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)
  FAIL  C10 callback-raw-body     callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check
          app/api/quotes/[id]/callback/route.ts:6  the raw body is never read: const raw = await request.text(); content-type is never checked (415 for anything but application/json); no 404 for an unknown event; no 415 for a non-JSON content-type; no 413 for bodies over 64 KB
          app/api/quotes/[id]/callback/route.ts:17  request.json(): the signature is checked on the raw text; parse only after it
  FAIL  C11 callback-signature    callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never ===
          app/api/quotes/[id]/callback/route.ts  x-n8n-signature is never read; no HMAC-SHA256: createHmac("sha256", N8N_CALLBACK_SECRET); the signature is not compared in the sha256=<hex> format
          lib/quotes.ts:28  timingSafeEqual without a length check first (it throws on different lengths)
  FAIL  C12 callback-timestamp    callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401
          app/api/quotes/[id]/callback/route.ts  x-n8n-timestamp is never read; no ±300 s window for x-n8n-timestamp; the time window must work both ways: Math.abs(now - timestamp) > 300
  FAIL  C13 callback-idempotency  callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure
          app/api/quotes/[id]/callback/route.ts  idempotency-key is never read; no 200 {duplicate: true} for a repeated idempotency-key; idempotency-key is not matched to `${data.jobId}:${event}` of the signed body; the claimed key is never released when processing fails (n8n's retry would get "duplicate")
  PASS  C14 log-hygiene           n8n code logs no bodies, personal data, secrets, env or whole error objects (1 more in unchanged code)

  14 checks: 7 PASS · 6 FAIL · 1 SKIP
  ```
  **Поправка після ручної перевірки коду — 5 PASS · 8 FAIL · 1 SKIP.** Скрипт не розпізнав виклик n8n у
  `lib/quotes.ts:41`: виклики він шукає за `N8N_WEBHOOK_*` у файлі або за підказкою в аргументах `fetch`,
  а тут змінна — `N8N_QUOTE_WEBHOOK_URL`, і `fetch` отримує просто `webhookUrl`; Server Action імпортує
  `@/lib/quotes`, а не модуль n8n. Тому цей виклик не потрапив у C4, C6, C7, C8, C14:
  - C4 — насправді FAIL і для `lib/quotes.ts:41`: `fetch` до n8n поза `lib/n8n/client.ts`;
  - C6 — PASS підтверджено: `AbortSignal.timeout(10_000)` є;
  - C7 — насправді **FAIL**: немає `x-n8n-token`, `idempotency-key`, `x-correlation-id` і конверта
    `{version, event, data}`; у тілі — email, компанія, опис і `callbackToken`;
  - C8 — насправді **FAIL**: `await startQuoteWorkflow(...)` в `app/quotes/actions.ts:32`, не в `after()`;
  - C14 — PASS підтверджено: у журналі лише `quoteId` і `status`/`reason`;
  - C11, зауваження до `lib/quotes.ts:28`, — спірне: порівнюються два SHA-256, довжини завжди однакові.

  Прогалину в скрипті виправити окремим комітом скіла після прогону B і перезапустити перевірку на обох
  копіях тією самою версією (запис — у висновку)
- Змінні в `.env.local` копії A: `N8N_QUOTE_WEBHOOK_URL`, `APP_URL` (змінні агента) + `N8N_WEBHOOK_TOKEN`,
  `N8N_CALLBACK_SECRET` (змінні мока — відповідників серед змінних агента немає)
- Журнал мока (форма → колбек → `/quotes/<id>`), 2026-09-27 22:05 UTC, `../ab-logs/a-mock.log`.
  (Власний мок агента в його сесії — не протокольний і сюди не рахується.)
  ```
  [mock-n8n] 2026-09-27T22:05:08.161Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  [mock-n8n] 2026-09-27T22:05:08.162Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  [mock-n8n] 2026-09-27T22:05:08.162Z test URLs: not registered (start with --listen to open them for 120 s)
  [mock-n8n] 2026-09-27T22:05:08.162Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 2026-09-27T22:05:08.162Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  [mock-n8n] 2026-09-27T22:05:28.903Z POST /webhook/quote-request -> 403 in 4 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 314 B sha256=db1cf46ec0549da0b795304461ffad0fa465d9655525e5c3188938b360d8b339
  ```
  Застосунок не надіслав `x-n8n-token`, `idempotency-key` і `x-correlation-id` — n8n з Header Auth
  відхилив запит (`403 auth=missing`). Воркфлоу не запустився, колбеку не було. Повторів з боку
  застосунку теж не було (один `POST`). Запуск о 21:54–21:55 UTC дав те саме (`403 in 4 ms auth=missing`,
  `quote.start_failed … http_403`); о 22:05 A перезапущено, щоб виміряти час форми в DevTools
  > **Перша спроба, 2026-09-27 21:41–21:44 UTC, не враховується:** у `.env.local` копії A не було
  > змінних мока `N8N_WEBHOOK_TOKEN` і `N8N_CALLBACK_SECRET`, тож мок працював м'якше, ніж у B
  > (`header auth: none`, `callbacks: off`). Що встигло видно: `POST /webhook/quote-request -> 202 in 4 ms
  > auth=none idempotency=absent | headers: accept,accept-language,content-type,user-agent | body 295 B`,
  > `callback skipped: N8N_CALLBACK_SECRET is not set`; сторінка статусу опитувала сервер (29 × `db:getQuote`),
  > колбеку не було. Повторено о 21:54 з обома змінними — результат вище.
- Час від «Надіслати» до відповіді форми: **271,41 мс** (DevTools → Network → `POST` `new` → Timing:
  очікування відповіді сервера 265,98 мс, завантаження 3,10 мс). Швидко лише тому, що мок відхилив
  запит за 4 мс: Server Action A **чекає** відповіді n8n (`await startQuoteWorkflow`, C8), тож з
  повільним n8n форма чекала б до 10 с таймауту
- Що показала `/quotes/<id>`: **до сторінки статусу не дійшло.** За журналом сервера: запис створено
  (`db:insertQuote: 1`), запуск упав (`quote.start_failed … reason: 'http_403'`), запис переведено у
  `failed` (`db:settleQuote: 1`), `redirect` не було (жодного `db:getQuote`) — форма повертає помилку
  з введеними значеннями (у коді — «Не вдалося надіслати запит. Спробуйте ще раз за хвилину.»)
- Журнал сервера (`../ab-logs/a-server.log`): **тіл, email, телефонів, токенів і підписів немає** — лише
  `db:*` і один рядок:
  ```
  quote.start_failed { quoteId: 'b4609621-93b6-4074-8a71-abdb453bbec3', reason: 'http_403' }
  ```
  (Email, компанія й опис при цьому пішли в тілі запиту до n8n — це видно з коду, мок тіл не логує.)

## B — зі скілом

- Які скіли бачив агент (окремий запуск `/context`): один проєктний — `integrating-n8n-webhooks`
  (Project, ~340 токенів); решта — ті самі вбудовані й синхронізовані з claude.ai, що в A
- **Сесія:** `a11e2cad-7841-4ff8-a567-9d353cf989e8`, 2026-09-27 21:13:45 → 21:23:21 UTC (≈ 9,5 хв);
  122 відповіді агента (52 виклики API), ≈ 49,4 тис. вихідних токенів, ≈ 7,4 млн — читання з кешу.
  Інструменти: Bash ×28, Write ×13, Read ×7, Edit ×1, **Skill ×1**, Claude Browser ×16 (`browser_batch`
  ×9, `read_page` ×2, `preview_logs` ×2, `preview_list`, `preview_start`, `preview_stop`). `WebFetch`,
  `WebSearch`, `AskUserQuestion` — жодного разу
- **Чи викликав агент скіл** (інструмент `Skill` / читання `references/`, `scripts/`): **так, першою ж
  дією** — `Skill: integrating-n8n-webhooks` (назву скіла в запиті не згадано: агент вибрав його сам за
  описом). Далі `ls -R` скіла і `Read` шести довідок: `code-templates.md`, `contract.md`,
  `callback-route.md`, `n8n-setup.md`, `pitfalls.md`, `local-testing.md` (не читав лише
  `response-modes.md`). Скрипти скіла запускав: `mock-n8n.mjs --help`, `send-signed-callback.mjs
  --help`, `check-contract.mjs`, `mock-n8n.mjs` (режими `last-node`, `respond-202`, 403) і
  `send-signed-callback.mjs`. Як і радить `SKILL.md`, прочитав у `node_modules/next/dist/docs`
  `after.md` і `route.md`
- Що зробив агент — своїми словами:
  - три модулі `lib/n8n/*` за шаблонами скіла:
    - `client.ts` — `import "server-only"`, `triggerWorkflow()`: `POST ${N8N_WEBHOOK_BASE_URL}/quote-request`
      з `x-n8n-token`, `idempotency-key`, `x-correlation-id`; конверт `{version: 1, event, data,
      callbackUrl}`; `AbortSignal.timeout(10_000)`; ≤ 2 повтори (1 с, 3 с) лише на мережу/таймаут/5xx,
      4xx не повторює; читає тільки статус і `job_id` відповіді 202; у журнал — event, correlationId,
      attempt, status, ms, bytes, sha256;
    - `callback.ts` — вікно ±300 с, HMAC-SHA256 над `${timestamp}.${raw}`, порівняння `sha256=<hex>` з
      перевіркою довжини й `timingSafeEqual`, розбір конверта лише після підпису;
    - `callback-keys.ts` — зайняті `idempotency-key` колбеків у `globalThis` (позначено як DEMO ONLY);
  - Server Action `submitQuoteRequest` (`app/quotes/actions.ts`): валідує, створює запис `queued` з
    `idempotencyKey` і `correlationId` (`randomUUID()`, один раз на операцію), `triggerWorkflow()` — у
    `after()` з власним `try/catch` (успіх → `processing`, помилка → `failed`), одразу `redirect` на
    `/quotes/<id>`. У n8n іде лише `quoteId, company, description, budget` — **email не надсилає**;
  - колбек `app/api/n8n/[event]/route.ts` — кроки 1–10 зі скіла по порядку: 404 невідомий шлях →
    415 → 413 (заголовок і фактичний розмір) → сирий текст → ±300 с → підпис → зайняти ключ (повтор →
    200 `{duplicate: true}`) → розбір, ключ = `${jobId}:${event}` → зберегти стан до відповіді →
    звільнити ключ при збої → 202 `{ok: true}`; у журнал — path, correlationId, status, ms, bytes, sha256;
  - `lib/quotes.ts` і `lib/db.ts`: статуси `queued → processing → ready | failed`, запис знаходить за
    `requestIdempotencyKey` з колбеку, PDF-посилання — лише `https:` (інакше `failed` з
    `invalid_document_url`); id — `q_<uuid>`;
  - `/quotes/new` — Server Component і клієнтська форма з `useActionState`, `aria-invalid` /
    `aria-describedby`; бюджет — **необов'язкова сума в доларах на весь проєкт** (варіанти «/ міс.» з
    форми ліда свідомо не взяв); експортував `EMAIL_RE` з `lib/lead-form.ts`;
  - `/quotes/[id]` — публічна за випадковим id, `robots: noindex`, без email; поки `queued`/`processing`
    — `router.refresh()` кожні 3 с (`components/quote-status-refresh.tsx`), після 3 хв — «довше, ніж
    зазвичай»; `ready` — посилання на PDF (`rel="noopener noreferrer"`), `failed` — «Новий запит»;
  - `docs/n8n-integrations.md` — рядок реєстру для `quote-request`, а старий `lead-created` — у розділі
    «Not yet on the contract»;
  - старий виклик n8n у `submitLead` (`app/actions.ts:61`) **не чіпав** і виніс питання про міграцію
    людині, як вимагає стоп-правило скіла;
  - перевіряв сам: `check-contract.mjs --changed-since HEAD` (у копії HEAD = `base`) — 14 PASS, повний
    прогін — 7 FAIL, усі в старому `submitLead`/`.env.example` (так і повідомив); `npm run lint`,
    `npm run build`; production-збірка на порту 3100 (порт 3000 був зайнятий чужим процесом) через
    тимчасову конфігурацію в `.claude/launch.json` зі значеннями `change-me-…` з `.env.example`
    (наприкінці `git checkout -- .claude/launch.json` — у діфі його немає); мок і матриця колбеків
    зі скіла — результати нижче.
- Звідки агент узяв домовленості: зі скіла — `SKILL.md`, шість довідок, шаблони коду з
  `code-templates.md` («Now the three `lib/n8n/*` modules from the tested templates»), скрипти скіла.
  Поза текою копії нічого не читав: у викликах немає `../`, робочого репозиторію, `materials/`,
  `WebFetch`/`WebSearch`; один `Read` поза текою — файл із власним великим виводом інструмента
  (`~/.claude/projects/…/a11e2cad…/tool-results/…`), це не джерело. `.env.local` не відкривав; мок і
  тестовий сервер запускав з `--env-file=.env.example`. Копія мока лежить у самому скілі
  (`scripts/mock-n8n.mjs`) — це частина скіла, а не витік
- Запитання агента і фінальна відповідь (цитата, скорочено): посеред роботи — жодного запитання. Фінальна
  відповідь: «Готово: форма `/quotes/new`, запуск воркфлоу, ендпоінт для колбеку і сторінка статусу
  `/quotes/[id]`. Усе зроблено за командним контрактом зі скіла `integrating-n8n-webhooks`. Наскрізний
  прогін проти офлайн-мока n8n пройшов. Нічого не комічено.» Далі — як працює (асинхронно: 202 +
  підписаний колбек, бо n8n Cloud обриває синхронну відповідь на 100 с), рішення, ухвалені самостійно
  (email не йде в n8n; публічна сторінка з випадковим id; бюджет у доларах на весь проєкт; PDF лише
  `https:`), перевірка, і **три запитання**: (1) чи потрібен воркфлоу email клієнта; (2) чи мігрувати
  старий `submitLead` на контракт — перелічив порушення (весь запис ліда з IP, user agent, `rawPayload`;
  без токена, таймауту й ключа; блокує форму; логує весь об'єкт помилки; `/webhook-test/` у
  `.env.example`); (3) хто власник інтеграції в `docs/n8n-integrations.md`. Наприкінці — чотири змінні
  для `.env.local` і команда для генерації секретів, покрокове налаштування n8n (Header Auth і Crypto,
  Webhook з Respond to Webhook 202, Remove Duplicates, Edit Fields, Crypto HMAC, HTTP Request з
  підписом і Retry On Fail, гілка помилки, Publish), команда мока для наскрізної перевірки, і
  застереження: пам'ять процесу замість бази/KV і немає обмеження частоти запитів
- Змінені файли (`git diff --cached --stat base`) — 17 файлів, +925 / −2; агент нічого не комітив і
  скіл у копії не змінював:
  ```
  .env.example                        |  10 +++
  app/api/n8n/[event]/route.ts        | 102 ++++++++++++++++++++++++
  app/quotes/[id]/page.tsx            | 127 ++++++++++++++++++++++++++++++
  app/quotes/actions.ts               |  45 +++++++++++
  app/quotes/layout.tsx               |  20 +++++
  app/quotes/new/page.tsx             |  28 +++++++
  components/quote-form.tsx           | 152 ++++++++++++++++++++++++++++++++++++
  components/quote-status-refresh.tsx |  20 +++++
  docs/n8n-integrations.md            |  23 ++++++
  lib/db.ts                           |  71 ++++++++++++++++-
  lib/lead-form.ts                    |   2 +-
  lib/n8n/callback-keys.ts            |  20 +++++
  lib/n8n/callback.ts                 |  59 ++++++++++++++
  lib/n8n/client.ts                   |  99 +++++++++++++++++++++++
  lib/quote-form.ts                   |  64 +++++++++++++++
  lib/quotes.ts                       |  61 +++++++++++++++
  lib/types.ts                        |  24 ++++++
  ```
  діф: `docs/ab/b-with-skill.diff`
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL` (`http://127.0.0.1:5678/webhook`),
  `N8N_WEBHOOK_TOKEN` (`change-me-webhook-token`), `N8N_CALLBACK_SECRET` (`change-me-callback-secret`),
  `APP_BASE_URL` (`http://127.0.0.1:3000`) — рівно чотири змінні контракту. Старий `N8N_WEBHOOK_URL` з
  `/webhook-test/` не чіпав
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base` — лише код прогону, код виходу 0:
  ```
  check-contract (integrating-n8n-webhooks) · root …/leaddesk-ab-b · 42 source files · scope: changes since base (17 files)

  PASS  C1  no-test-url           only production webhook URLs: no /webhook-test/ in code or .env.example (1 more in unchanged code)
  PASS  C2  env-server-only       n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components
  PASS  C3  env-example           .env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets (2 more in unchanged code)
  PASS  C4  one-client            n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/ (1 more in unchanged code)
  PASS  C5  server-only           lib/n8n modules that hold config start with import "server-only"
  PASS  C6  fetch-timeout         every fetch to n8n has signal: AbortSignal.timeout(…) (1 more in unchanged code)
  PASS  C7  request-contract      requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope (1 more in unchanged code)
  PASS  C8  no-waiting            Server Actions start n8n only inside after() (1 more in unchanged code)
  PASS  C9  no-edge               no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)
  PASS  C10 callback-raw-body     callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check
  PASS  C11 callback-signature    callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never ===
  PASS  C12 callback-timestamp    callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401
  PASS  C13 callback-idempotency  callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure
  PASS  C14 log-hygiene           n8n code logs no bodies, personal data, secrets, env or whole error objects (1 more in unchanged code)

  14 checks: 14 PASS · 0 FAIL · 0 SKIP
  ```
  **Ручна перевірка підтверджує 14 PASS.** Прогалина скрипта з прогону A тут не діє: виклик — у
  `lib/n8n/client.ts` (для клієнтського модуля скрипт бере всі `fetch`), змінні — `N8N_WEBHOOK_*`, а
  Server Action імпортує `@/lib/n8n/client`. Код прочитано: `lib/n8n/client.ts`, `lib/n8n/callback.ts`,
  `lib/n8n/callback-keys.ts`, `app/api/n8n/[event]/route.ts`, `app/quotes/actions.ts`, `lib/quotes.ts`,
  `.env.example` — усе, що перевіряють C1–C14, у коді справді є
- **Самоперевірка агента** з його сесії (мок і скрипти скіла, змінні з `.env.example`, застосунок на
  :3100) — це не протокольний сценарій кроку 3.4, але той самий мок:
  ```
  # --mode last-node (відповідь через 2 с): форма → /quotes/<id> за 261 мс
  POST /webhook/quote-request -> 200 in 2007 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 359 B
  # --mode respond-202 --delay 5000
  POST /webhook/quote-request -> 202 in 3 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 337 B
  workflow 5f4d2266-… running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3100/api/n8n/quote-request -> 202 in 122 ms (try 1/3) event=quote-request.completed body 382 B
  # N8N_WEBHOOK_TOKEN=a-different-token (у мока)
  POST /webhook/quote-request -> 403 in 4 ms auth=wrong | … body 303 B      ← одна спроба, без повторів; сторінка — «Не вдалося»
  ```
  `send-signed-callback.mjs`: 11 PASS · 0 FAIL · 3 SKIP — R1 404, R2 415, R3 413, R4–R8 401 ×5, R9–R10
  400 ×2, R11 ключ звільнено (404, потім знову 404); V1–V3 пропущено (потрібен `--request-key` реального
  запису). Сторінка статусу після колбеку: «Готово · Кошторис готовий · PDF відкриється в новій вкладці»,
  посилання `https://files.example.test/n8n/5f4d2266-….pdf`. Журнал сервера (`preview_logs`): лише
  `n8n.request {event, correlationId, attempt, status, ms, bytes, sha256}` і `n8n.callback {path,
  correlationId, status, ms, bytes, sha256}`, плюс лічильники `db:*` — без тіл, email, токенів, підписів
- Змінні в `.env.local` копії B: чотири змінні агента з `.env.example` — `N8N_WEBHOOK_BASE_URL`,
  `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`; змінні мока збігаються з двома з них за назвою
- Журнал мока (форма → колбек → `/quotes/<id>`), 2026-09-27 21:57 UTC, `../ab-logs/b-mock.log`:
  ```
  [mock-n8n] 2026-09-27T21:57:05.602Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  [mock-n8n] 2026-09-27T21:57:05.603Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  [mock-n8n] 2026-09-27T21:57:05.603Z test URLs: not registered (start with --listen to open them for 120 s)
  [mock-n8n] 2026-09-27T21:57:05.603Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 2026-09-27T21:57:05.603Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  [mock-n8n] 2026-09-27T21:57:33.517Z POST /webhook/quote-request -> 202 in 7 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 235 B sha256=ee2bc2d8edbb615ae5c7f8dec9274fe8ab067f6942911d7dd7aa86ca8c5c5382
  [mock-n8n] 2026-09-27T21:57:33.517Z workflow de9ad5a9-8ef5-4666-8425-c7133f219b2a running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-27T21:57:38.634Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 114 ms (try 1/3) event=quote-request.completed body 382 B sha256=7442a2566654562fd34fcec49c78ad26b2913b719ba7e643249b2be1fc72c9ce
  ```
  Запит — з усіма заголовками контракту (`auth=ok idempotency=new`), колбек дійшов з першої спроби
  через ≈ 5,1 с, застосунок відповів 202. `callbackUrl` застосунок передав сам. (Попередній запуск B о
  21:48–21:49 UTC дав той самий результат: `202 … auth=ok idempotency=new`, колбек `-> 202 in 118 ms`.)
- Час від «Надіслати» до відповіді форми: **308,18 мс** (DevTools → Network → `POST` `new` → Timing:
  очікування відповіді сервера 220,19 мс, завантаження 84,56 мс — відповідь уже несе сторінку статусу
  після `redirect`). Server Action не чекає n8n: запит до n8n (16 мс) іде в `after()`, уже після
  відповіді. Цей час не залежить від n8n — у самоперевірці агента з моком `last-node` (відповідь
  через 2007 мс) форма відповіла за 261 мс
- Що показала `/quotes/<id>` (`/quotes/q_f269a54c-dd21-4799-a6e6-6f5842ffae1a`, скріншот): бейдж
  «Готово», «Кошторис готовий», «PDF відкриється в новій вкладці.», кнопка «Завантажити кошторис (PDF)»;
  блок «Ваш запит» — компанія, бюджет «4 500 USD», «Надіслано 28 вер. 2026 р., 00:57», опис задачі.
  Email не показано. Сторінка перейшла з очікування в «Готово» сама (3 × `db:getQuote`, `db:completeQuote: 1`).
  Примітка для кроку 4: публічна (за випадковим id) сторінка показує **опис задачі** — у A опису на ній немає
- Журнал сервера (`../ab-logs/b-server.log`): **тіл, email, телефонів, токенів і підписів немає.** Є лише
  лічильники `db:*` і два записи n8n з тим самим `correlationId` — запит і колбек зв'язані наскрізно:
  ```
  n8n.request  { event: 'quote-request', correlationId: '667ce2c9-86ff-4437-9a1c-00a41308bada', attempt: 1, status: 202, ms: 16, bytes: 235, sha256: 'ee2bc2d8…' }
  n8n.callback { path: 'quote-request',  correlationId: '667ce2c9-86ff-4437-9a1c-00a41308bada', status: 202, ms: 82, bytes: 382, sha256: '7442a256…' }
  ```

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так: `Skill` першою дією + 6 довідок і скрипти скіла |
| `check-contract.mjs` на коді прогону (`--changed-since base` або без FAIL базової лінії): FAIL (id) | скрипт: 6 FAIL — C3, C4, C10, C11, C12, C13; після ручної поправки — 8 FAIL: + C7, C8 | 0 FAIL (14 PASS, підтверджено вручну) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request` | `/webhook/quote-request` (`N8N_WEBHOOK_BASE_URL` + event) |
| `auth=` / `idempotency=` у журналі мока | `403 auth=missing`; заголовків `idempotency-key`, `x-correlation-id` немає | `202 auth=ok idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні — воркфлоу не запустився (403); форма — помилка, запис `failed` | так, з 1-ї спроби; `-> 202` (114 мс); сторінка — «Кошторис готовий» |
| Час відповіді форми | 271 мс — але лише тому, що мок відповів 403 за 4 мс: форма чекає n8n (до 10 с) | 308 мс — не залежить від n8n: запит до n8n іде в `after()` (з моком на 2 с — 261 мс) |
| Тіла чи персональні дані в журналі сервера | немає (`quote.start_failed {quoteId, reason}`) | немає (`n8n.request`/`n8n.callback`: correlationId, status, ms, bytes, sha256) |
| Персональні дані в запиті до n8n | email, компанія, опис + `callbackToken` | компанія, опис, бюджет; email — ні |
| Колбек: автентифікація | Bearer-токен на запит (свій, не за контрактом) | HMAC `sha256=` над `${timestamp}.${raw}`, ±300 с, `idempotency-key` |
| Старий виклик у `submitLead` | не чіпав, не згадав | не чіпав, виніс питання про міграцію з переліком порушень |
| Змінених файлів | 14 (5 змінено, 9 нових), +572 / −2 | 17 (4 змінено, 13 нових), +925 / −2 |
| Тривалість сесії / вихідні токени | ≈ 17 хв / ≈ 60,4 тис. | ≈ 9,5 хв / ≈ 49,4 тис. |
| Запитання агента | немає | посеред роботи — немає; у фінальній відповіді — 3 (email у воркфлоу, міграція `submitLead`, власник інтеграції) |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` у корені робочого репозиторію, гілка
  `ws04/pavmys` на коді BASE (між `04e8b58` і `41aa304` — лише документи). Застосовано 17 файлів;
  кожен звірено з копією B (`cmp`) — **байт у байт**, без жодної правки. `package.json`,
  `package-lock.json`, `.env.local`, `node_modules/` не переносились (агент нічого не доставляв).
  Коміти:
  - `4946c7f` feat(quotes): add quote requests started in n8n with a signed callback — код прогону B як є;
  - `c97f358` fix(lead-form): send new leads to n8n through the contract client — доробка 1;
  - `8a00f0b` fix(quotes): keep the task description off the public status page — доробка 2.
- Що довелось доробити руками після перенесення (і чому скіл цього не дав):
  1. **Старий виклик n8n у `submitLead`** (`app/actions.ts`) — одразу після перенесення повний
     `check-contract` давав 7 FAIL (C1, C3, C4, C6, C7, C8, C14), усі в старому коді: весь запис ліда
     (IP, user agent, `rawPayload`) прямим `fetch` на `N8N_WEBHOOK_URL` з `/webhook-test/`, без токена,
     ключа й таймауту, з `await` у Server Action і журналом усього об'єкта помилки. Переведено на
     `triggerWorkflow("lead-created", …)` в `after()` з `try/catch`; `data` — `leadId, name, email, phone,
     company, budget, message` (без IP, user agent і сирих даних форми); `idempotencyKey` і
     `correlationId` створюються один раз і зберігаються в записі ліда (два необов'язкові поля в `Lead`);
     `N8nEvent` доповнено `"lead-created"`; `N8N_WEBHOOK_URL` прибрано з `.env.example`.
     **Чому не скіл:** так задумано. Стоп-правило скіла — не мігрувати наявний виклик без «так» людини,
     бо міграція змінює, що отримує живий воркфлоу клієнта. Агент B так і зробив: не чіпав, переліком
     показав порушення й спитав. Склад `data` вирішила людина (скіл вимагає не слати персональні дані
     «про всяк випадок» і питати).
  2. **Опис задачі на публічній сторінці `/quotes/[id]`** — прибрано; лишились статус, компанія, бюджет і
     дата. Сторінка відкривається будь-кому з посиланням; email агент B сховав сам, а опис задачі (може
     містити дані клієнта) — ні. **Чому не скіл:** правила скіла про персональні дані стосуються журналів
     і того, що йде в n8n, а про вміст сторінки статусу не кажуть нічого. Кандидат у скіл: «публічна
     сторінка статусу показує лише статус і поля без даних клієнта».
- Ключі контракту в `.env.example` (секрети — `change-me-…`, адрес `/webhook-test/` немає):
  `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`, `N8N_WEBHOOK_TOKEN=change-me-webhook-token`,
  `N8N_CALLBACK_SECRET=change-me-callback-secret`, `APP_BASE_URL=http://127.0.0.1:3000`. Інших `N8N_*`
  немає; `/webhook-test/` немає ні в `.env.example`, ні в коді
- `npm run lint`, `npm run build` на гілці: обидва проходять — одразу після перенесення (`4946c7f`) і на
  фінальному коді (`8a00f0b`); у збірці є `/quotes/new`, `/quotes/[id]`, `/api/n8n/[event]`
- `check-contract.mjs` на фінальному коді (0 FAIL, код виходу 0) — `HEAD` = `8a00f0b`, увесь код, без
  прапорців:
  ```
  check-contract (integrating-n8n-webhooks) · root …/2026-quitcode-04-agent-skills-hw · 42 source files · scope: all files

  PASS  C1  no-test-url           only production webhook URLs: no /webhook-test/ in code or .env.example
  PASS  C2  env-server-only       n8n settings stay on the server: no NEXT_PUBLIC_ n8n variables, no n8n code in Client Components
  PASS  C3  env-example           .env.example declares the contract variables: base ends with /webhook, local URLs, change-me-… secrets
  PASS  C4  one-client            n8n is called only from lib/n8n/client.ts; callback routes live under app/api/n8n/
  PASS  C5  server-only           lib/n8n modules that hold config start with import "server-only"
  PASS  C6  fetch-timeout         every fetch to n8n has signal: AbortSignal.timeout(…)
  PASS  C7  request-contract      requests send x-n8n-token (from env), idempotency-key, x-correlation-id and the {version, event, data} envelope
  PASS  C8  no-waiting            Server Actions start n8n only inside after()
  PASS  C9  no-edge               no runtime = "edge" (deprecated in Next.js 16; the contract needs node:crypto)
  PASS  C10 callback-raw-body     callback route: 404/415 checks, raw text body, 413, no JSON parsing before the signature check
  PASS  C11 callback-signature    callback route: HMAC-SHA256 sha256=<hex>, length check + timingSafeEqual, never ===
  PASS  C12 callback-timestamp    callback route: signs `${timestamp}.${raw}` and rejects x-n8n-timestamp outside ±300 s with 401
  PASS  C13 callback-idempotency  callback route: claims idempotency-key (200 duplicate), matches it to `${jobId}:${event}`, releases it on failure
  PASS  C14 log-hygiene           n8n code logs no bodies, personal data, secrets, env or whole error objects

  14 checks: 14 PASS · 0 FAIL · 0 SKIP
  ```
  (Для порівняння: одразу після перенесення, на `4946c7f`, — 7 PASS · 7 FAIL, усі в старому `submitLead`
  і `.env.example:6`; `--changed-since 04e8b58` — 14 PASS · 0 FAIL і тоді, і тепер.)
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці: 2026-09-27 22:16 UTC, код доробок
  (до їхнього коміту, той самий, що в `c97f358` + `8a00f0b`). Порти 3000 і 5678 ще тримали процеси
  копії A, тож застосунок — `next start -p 3100`, мок — `tools/mock-n8n.mjs --port 5679 --mode
  respond-202 --delay 5000`, обидва зі значеннями `change-me-…` з `.env.example` (а не з `.env.local`).
  - Форма кошторису → `/quotes/q_28b5e1b8-…` → через ≈ 5 с сама перейшла в «Готово · Кошторис готовий ·
    Завантажити кошторис (PDF)»; у блоці «Ваш запит» — компанія, бюджет «3 000 USD», дата, **опису немає**.
    Мок: `POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new`, потім
    `callback POST http://127.0.0.1:3100/api/n8n/quote-request -> 202 in 111 ms (try 1/3)`.
  - Форма ліда на `/` → «Дякуємо! Заявку отримано.»; мок: `POST /webhook/lead-created -> 202 in 3 ms
    auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,
    x-correlation-id,x-n8n-token`; колбеку немає (подія «до відома», `callbackUrl` не передається).
  - Журнал сервера: лише `n8n.request` (`lead-created`, `quote-request`) і `n8n.callback` — event/path,
    correlationId, attempt, status, ms, bytes, sha256, плюс `db:*`. Тіл, email, телефонів, токенів і
    підписів немає. Помилок у консолі браузера немає.
  - Час відповіді форми в цьому запуску не вимірювали; на копії B — 308 мс (крок 3.4).
- Рядок у `docs/n8n-integrations.md` (рекомендовано, не оцінюється): є обидва — `quote-request` (додав
  агент B: Respond to Webhook 202 + callback, дані, колбек, сторінка статусу) і `lead-created` (доробка 1:
  Immediately, без колбеку, склад `data` і що має змінитися в живому воркфлоу — Header Auth, шлях
  `/webhook/lead-created`, поля в `$json.body.data`, Remove Duplicates, Publish). Власник — _TBD_

## Висновок

<2–4 речення: чи змінив скіл результат і в чому саме; звідки агент без скіла взяв домовленості,
якщо взяв; скільки довелось доробляти після прогону B; що ви зміните в скілі після цього прогону.>
