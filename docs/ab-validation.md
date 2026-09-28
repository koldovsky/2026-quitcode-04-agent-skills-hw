# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`, Task D. **A — без скіла, B — зі
> скілом.** Числа й цитати — із сесій і журналів. Результат прогону **B** перенесено в гілку — останній
> розділ.

- **Інструмент і версія:** Claude Code (розширення VS Code), Windows 10 Pro 19045
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-5-5` — «Opus 5.5 (1M context)» за `/model` в обох копіях; рівень міркування — налаштування за замовчуванням, у прогонах не змінювався
- **Код:** BASE = `eb39591` (коміт після Task C: виправлення Task A, форма нотатки Task B, три скіли;
  ще без `/quotes` і без змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з того ж
  `eb39591` (HEAD `e3113cc` змінює лише `docs/`, скіл той самий)
- **Копії:** `D:\leaddesk-ab-a` (без жодного скіла), `D:\leaddesk-ab-b` (лише `integrating-n8n-webhooks`);
  у кожній — `git init`, коміт `start` (A: `d5f552b`, B: `1ffc91f`) з тегом `base`, `npm install`
  (494 пакети, 0 вразливостей)
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і всі скіли (у B повернуто лише `integrating-n8n-webhooks`). Лишились в обох: `AGENTS.md`, `CLAUDE.md`,
  `skills-lock.json` (описує лише скіл Vercel, самого скіла в копіях немає — однаково в A і B).
  Перевірено 27.09.2026:
  ```
  == SKILL.md in copies (expect exactly 1, in b):
  ../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md
  == hint files:
  no hints - ok
  == contract words in A:
  no contract - ok
  == contract words in B outside the skill:
  no contract outside skill - ok
  ```
- **Особисті скіли** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`):
  `~/.cursor/skills` і `~/.agents/skills` немає, `~/.codex/skills` порожня; у `~/.claude/skills/synced/`
  — синхронізовані `anthropic-skills` (`docs`, `docx`, `google-workspace`, `import-memory`, `morning`,
  `pdf`, `pptx`, `skill-creator`, `xlsx`). Жоден не згадує n8n чи вебхуки
  (`grep -rliE "n8n|webhook" ~/.claude/skills --include=SKILL.md` → нічого) і їх видно однаково в обох
  прогонах, тож на різницю A/B вони не впливають. Особистої копії `integrating-n8n-webhooks` немає.
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** не знадобилась — в обох прогонах агент під час роботи нічого не питав
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000` (без `--callback-url`)
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): в обох
  копіях однаково — **7 PASS, 7 FAIL** (C1 `.env.example:6`, C3/C4/C5/C6/C8 `app/actions.ts:55` (на BASE рядок зсунувся на 1 після Task A), C7
  `.env.example`). Це старий код, в оцінку прогонів не йде.


## A — без скіла

- **Сесії** (журнали `~/.claude/projects/d--leaddesk-ab-a/`): `b71e0d17…` — окремий чат лише для
  списку скілів (28.09.2026 08:21 UTC); `9a2082fa…` — `/model`; `ad2d6f6a…` — прогін (08:23 UTC).
  Модель — `claude-opus-5-5` (`/model`: «Opus 5.5 (1M context)») — та сама, що в B.
- **Які скіли бачив агент** (окремий чат): жодного скіла проєкту — лише вбудовані (`update-config`,
  `code-review`, `simplify`, `security-review`, `run`, `init`, …) і особисті `anthropic-skills`. Агент
  сам зауважив: «Скіли проєкту: за `AGENTS.md` вони мають лежати в `.claude/skills/`, але в мій список
  жоден не потрапив». Той чат далі не використовувався.
- **Що зробив агент:** сховище кошторисів у `lib/db.ts` (`pending → ready | failed`), `lib/quotes.ts` (виклик
  n8n `fetch(process.env.N8N_QUOTE_WEBHOOK_URL)` з таймаутом 10 с, **токен на кожен запит** — у БД лише
  його хеш, порівняння `timingSafeEqual`), `/quotes/new` + Server Action (запис, redirect на
  `/quotes/<id>`, виклик n8n в `after()`), колбек `POST /api/quotes/[id]/callback` з
  `Authorization: Bearer <token>` і тілом `{ status, pdfUrl }`, `/quotes/[id]` з автооновленням кожні 4 с і
  кнопкою «Спробувати ще раз». Старий виклик n8n у формі лідів і `.env.example` не чіпав — лише
  **додав** ще одну змінну з тестовим URL.
- **Звідки агент узяв домовленості** (з журналу сесії): наявний код (`app/actions.ts`, `lib/db.ts`, форми),
  документація Next.js у `node_modules/next/dist/docs` (читав `after.md`, шукав `after(`, `RouteContext`) і
  загальні знання. Шукав `tools/` і `.claude/` (`ls tools .claude`) — їх немає; `.env.example` згадує
  `tools/mock-n8n.mjs`, тож агент написав **власну заглушку n8n** у тимчасовій теці й перевіряв на ній.
  Контракту команди (Header Auth, `idempotency-key`, `x-correlation-id`, HMAC-підпис, `/webhook/`) йому
  не було звідки взяти — і в коді його немає.
- **Поза текою копії:** до робочого репозиторію чи копії B не звертався (у журналі жодного такого шляху),
  `.env.local` не відкривав (3 згадки — у тексті `AGENTS.md`, коментарі `.env.example` і фінальній
  відповіді). Відмовляти ні в чому не довелось.
- **Запитання агента:** під час роботи — жодного. Наприкінці — прохання до людини: додати
  `N8N_QUOTE_WEBHOOK_URL` і `APP_BASE_URL` у `.env.local`, увімкнути у вебхуку «Respond: Immediately»,
  додати HTTP Request з `Authorization: Bearer {{$json.callback.token}}`; зауваження про rate limit,
  домен `pdfUrl` і що «Запит у n8n іде без секрету … варто додати Header Auth».
- **Фінальна відповідь (скорочено):** «Готово. Сторінки `/quotes/new` і `/quotes/[id]`, Server Action і
  ендпоінт для зворотного виклику від n8n працюють. `tsc`, `lint` і `build` проходять. Повний цикл я
  перевірив локально на заглушці n8n … n8n отримує дані заявки і `callback: { url, token }` … Запит у n8n
  іде без секрету, як і наявний `N8N_WEBHOOK_URL` для лідів … У `.env.example` згадано
  `tools/mock-n8n.mjs`, але такого файлу в репозиторії немає.»
- **Змінені файли** (`git diff --cached --stat base`): 11 файлів, +494 / −1 — `.env.example`,
  `app/api/quotes/[id]/callback/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/new/actions.ts`,
  `app/quotes/new/page.tsx`, `components/quote-auto-refresh.tsx`, `components/quote-form.tsx`, `lib/db.ts`,
  `lib/quote-form.ts`, `lib/quotes.ts`, `lib/types.ts`; діф: `docs/ab/a-without-skill.diff`
- **Змінні середовища, які додав агент:** `N8N_QUOTE_WEBHOOK_URL` (у `.env.example` —
  `http://127.0.0.1:5678/webhook-test/quote-request`, **тестовий URL**) і `APP_BASE_URL`. Для сценарію
  `.env.local` копії: ці дві змінні зі значеннями для мока (`N8N_QUOTE_WEBHOOK_URL` — **production**
  `/webhook/quote-request`, як і в B: з тестовим URL мок відповів би 404 ще до всього іншого), старий
  `N8N_WEBHOOK_URL` і дві змінні мока `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET` (згенеровані, не друкувались).
- **`check-contract.mjs --root ../leaddesk-ab-a --changed-since base`** — лише код прогону (версія скрипта
  з `c56abe1`, див. «Що змінили в скілі» нижче):
  ```
  C1   FAIL  test-url             no /webhook-test/ URL in code or .env.example
         .env.example:11  test webhook URL (/webhook-test/)
  C2   PASS  public-env           no NEXT_PUBLIC_N8N_* variables
  C3   FAIL  single-module        n8n webhook env vars and fetch to n8n only in lib/n8n/client.ts
         lib/quotes.ts:43  fetch to n8n outside lib/n8n/client.ts
  C4   FAIL  server-only          lib/n8n/client.ts exists when n8n is called and starts with import "server-only"
         lib/quotes.ts:43  n8n is called but there is no lib/n8n/client.ts module
  C5   PASS  timeout              every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   FAIL  request-headers      webhook call sends x-n8n-token, idempotency-key, x-correlation-id
         lib/quotes.ts:43  webhook request without header x-n8n-token
         lib/quotes.ts:43  webhook request without header idempotency-key
         lib/quotes.ts:43  webhook request without header x-correlation-id
  C7   FAIL  env-example          .env.example lists the contract keys with safe local values
         .env.example:1  missing key N8N_WEBHOOK_BASE_URL
         .env.example:1  missing key N8N_WEBHOOK_TOKEN
         .env.example:1  missing key N8N_CALLBACK_SECRET
  C8   PASS  async-action         a Server Action ("use server") calls n8n only inside after()
  C9   FAIL  raw-body             callback route reads req.text(), never req.json(); JSON.parse only after the signature check
         app/api/quotes/[id]/callback/route.ts:21  body parsed with .json() (signature needs the raw body)
         app/api/quotes/[id]/callback/route.ts:1  raw body is never read with .text()
  C10  FAIL  signature            callback compares signatures with a length check + crypto.timingSafeEqual, never ===/!==
         app/api/quotes/[id]/callback/route.ts:1  no crypto.timingSafeEqual
  C11  FAIL  replay-window        callback checks x-n8n-timestamp against a 300 s window
         app/api/quotes/[id]/callback/route.ts:1  x-n8n-timestamp is not read
  C12  FAIL  callback-idempotency callback reads idempotency-key and answers duplicates
         app/api/quotes/[id]/callback/route.ts:1  idempotency-key header is not read
  C13  PASS  no-edge              no runtime = "edge" in the project
  C14  PASS  logs                 console.* in n8n code never logs bodies, form data, contacts, tokens or signatures
  
  Summary: 5 PASS, 9 FAIL (14 checks, changed since base)
  ```
  Увесь проєкт без прапорця — 3 PASS, 11 FAIL (до 9 FAIL прогону додаються 2 старі: виклик n8n у формі лідів).
- **Журнал мока** (той самий режим, що для B: `--mode respond-202 --delay 5000`):
  ```
  [mock-n8n] 2026-09-28T08:40:43.144Z POST /webhook/quote-request -> 403 in 3 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 305 B sha256=901f0d4b7e74218c11804ab310d59fd843e2593d9e3a0d54089c87220c74ac75
  ```
  URL — `/webhook/` (бо в `.env.local` так поставили для сценарію; у коді/`.env.example` агента —
  `/webhook-test/`), **`auth=missing` → 403**, заголовків `idempotency-key` і `x-correlation-id` немає (у
  рядку мока немає й поля `idempotency=`). Воркфлоу не запустився, колбеку не було. `--callback-url`
  мокові задати не вийшло б: застосунок передає не `callbackUrl`, а `callback: { url, token }`, і URL
  містить id конкретного запиту — але до колбека справа й не дійшла.
- **Час від «Надіслати» до відповіді форми:** **414 мс** (DevTools → Network, POST `/quotes/new`, людина).
- **Що показала `/quotes/<id>`** (`/quotes/q_f9d3559e-173e-4108-8fef-7481c658eebf`): одразу — «Готуємо
  кошторис», за кілька секунд — «Не вдалося підготувати кошторис».
- **Журнал сервера:**
  ```
  db:insertQuote: 1
  db:getQuote: 1
  Quote q_f9d3559e-173e-4108-8fef-7481c658eebf: failed to start n8n workflow Error: n8n responded with 403
      at d (D:\leaddesk-ab-a\.next\server\chunks\ssr\[root-of-the-server]__0mrtqrw._.js:1:6089)
  db:completeQuote: 1
  db:getQuote: 2
  ```
  Тіл, email, токенів, підписів немає (`grep -ciE "@example|test@|token|sha256=|signature|Bearer"` → 0);
  є стек помилки з внутрішнім шляхом чанка.

## B — зі скілом

> **Порядок прогонів.** Першим фактично пройшов прогін **B**: людина відкрила для «прогону A» теку
> `D:leaddesk-ab-b`. Це видно зі списку скілів (у ньому `integrating-n8n-webhooks`) і з того, що
> змінилась лише копія B (у копії A — жодних змін, `git status` порожній). Копії й сесії окремі, тож
> результат не зіпсовано — змінився лише порядок; прогін A пройшов після B у своїй копії.

- **Сесії** (журнали `~/.claude/projects/d--leaddesk-ab-b/`): `798ffb58…` — окремий чат лише для
  списку скілів (28.09.2026 07:36 UTC); `d4db2cc1…` — прогін (07:43 UTC). Модель в обох —
  `claude-opus-5-5` (`/model`: «Opus 5.5 (1M context)»).
- **Які скіли бачив агент** (окремий чат «які skills тобі доступні? не відкривай файлів»): «Скіл проєкту
  (з `.claude/skills/`) — integrating-n8n-webhooks …»; крім нього — вбудовані (`code-review`,
  `simplify`, `security-review`, `run`, `init`, `claude-api`, …) і особисті `anthropic-skills`
  (docs, docx, pptx, xlsx, pdf, google-workspace, skill-creator, import-memory, morning).
- **Чи викликав агент скіл:** **так, сам і першим кроком** — перший інструмент сесії
  `Skill {"skill":"integrating-n8n-webhooks"}`; далі читав `references/code-templates.md`,
  `contract.md`, `pitfalls.md`, `n8n-setup.md`, `response-modes.md`; запускав
  `scripts/check-contract.mjs`, `scripts/mock-n8n.mjs` і `scripts/send-signed-callback.mjs` зі скіла
  (60 викликів інструментів разом).
- **Поза текою копії:** до робочого репозиторію не звертався (у журналі жодного шляху
  `2026-quitcode…`), `.env.local` не відкривав; для власних тестів поклав env-файл із `change-me`
  значеннями з `.env.example` у свій тимчасовий scratchpad Claude Code. Відмовляти ні в чому не довелось.
- **Що зробив агент:** сховище кошторисів у `lib/db.ts` (статуси `queued → processing → ready | failed`),
  `lib/n8n/client.ts` (`server-only`, таймаут 10 с, до 3 спроб, той самий `idempotency-key`),
  `lib/n8n/idempotency.ts`, `lib/n8n/callbacks.ts`, колбек-роут `app/api/n8n/[event]/route.ts`
  (HMAC на сирому тілі, `timingSafeEqual`, вікно 300 с, ідемпотентність, стан до відповіді),
  `/quotes/new` з формою + Server Action (`after()`, повертає `{ status, id }`), `/quotes/[id]` з
  автооновленням кожні 5 с (id — UUID, email на сторінці не показується). **Сам** переробив і старий
  виклик у `app/actions.ts` (форма лідів → `triggerWorkflow("lead-created", …)` в `after()`, у `data` —
  лише `leadId, company, budget, source`) і `.env.example`; додав `docs/n8n-integrations.md`.
  Перевірив сам: lint/build, `check-contract` 14/14, сценарій з моком, `send-signed-callback` 12/12.
- **Запитання агента:** під час роботи — жодного (відповідь «Роби, як вважаєш правильним» не знадобилась).
  У фінальній відповіді — 3 питання людині: які поля потрібні воркфлоу (чи передавати email), як
  налаштований вебхук у клієнта (202 + підписаний колбек), справжні значення змінних.
- **Фінальна відповідь (скорочено):** «Сторінки кошторисів і ендпоінт для n8n готові й перевірені проти
  офлайн-мока n8n. Справжній n8n клієнта я не викликав. … Форма `/quotes/new` … відповідає приблизно за
  0,15 с … n8n одразу відповідає 202, результат надсилає пізніше колбеком … Перевірка контракту зі скіла:
  14 з 14 … Набір тестових колбеків: 12 з 12 … `.env.local` я не відкривав і не змінював … Ваш
  `.env.local` треба оновити … Нічого не комічено й не пушено.»
- **Змінені файли** (`git diff --cached --stat base`): 15 файлів, +658 / −15 — `.env.example`,
  `app/actions.ts`, `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`,
  `app/quotes/new/page.tsx`, `components/auto-refresh.tsx`, `components/quote-form.tsx`,
  `docs/n8n-integrations.md`, `lib/db.ts`, `lib/n8n/callbacks.ts`, `lib/n8n/client.ts`,
  `lib/n8n/idempotency.ts`, `lib/quote-form.ts`, `lib/types.ts`; діф: `docs/ab/b-with-skill.diff`
- **Змінні середовища, які додав агент:** `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`,
  `N8N_CALLBACK_SECRET`, `APP_BASE_URL` (прибрав `N8N_WEBHOOK_URL` з `/webhook-test/`). Для сценарію
  `.env.local` копії створено з цими ж 4 ключами (секрети згенеровано, значення ніде не друкувались).
- **`check-contract.mjs --root ../leaddesk-ab-b --changed-since base`** — лише код прогону:
  ```
  C1   PASS  test-url             no /webhook-test/ URL in code or .env.example
  C2   PASS  public-env           no NEXT_PUBLIC_N8N_* variables
  C3   PASS  single-module        n8n webhook env vars and fetch to n8n only in lib/n8n/client.ts
  C4   PASS  server-only          lib/n8n/client.ts exists when n8n is called and starts with import "server-only"
  C5   PASS  timeout              every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   PASS  request-headers      webhook call sends x-n8n-token, idempotency-key, x-correlation-id
  C7   PASS  env-example          .env.example lists the contract keys with safe local values
  C8   PASS  async-action         a Server Action ("use server") calls n8n only inside after()
  C9   PASS  raw-body             callback route reads req.text(), never req.json(); JSON.parse only after the signature check
  C10  PASS  signature            callback compares signatures with a length check + crypto.timingSafeEqual, never ===/!==
  C11  PASS  replay-window        callback checks x-n8n-timestamp against a 300 s window
  C12  PASS  callback-idempotency callback reads idempotency-key and answers duplicates
  C13  PASS  no-edge              no runtime = "edge" in the project
  C14  PASS  logs                 console.* in n8n code never logs bodies, form data, contacts, tokens or signatures
  
  Summary: 14 PASS, 0 FAIL (14 checks, changed since base)
  ```
  Без `--changed-since` (увесь проєкт) — теж 14 PASS / 0 FAIL: агент переробив і старий код, тож 7 FAIL
  базової лінії зникли. Після покращення скрипта (`c56abe1`) повторний запуск на коді B — так само
  14 PASS / 0 FAIL в обох режимах.
- **Журнал мока** (`--mode respond-202 --delay 5000`, `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs`;
  форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] 2026-09-28T08:12:08.857Z POST /webhook/quote-request -> 202 in 4 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 239 B sha256=e85f904bd0d7e29bd4a1711098971d460d909836938b3dbf04176ea647500250
  [mock-n8n] 2026-09-28T08:12:08.858Z workflow 51b0e095-627e-4b8b-ad17-59a9ba0fc8fd running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-28T08:12:14.043Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 177 ms (try 1/3) event=quote-request.completed body 382 B sha256=ddc6a491ce5a15a33c22a8287f6bd4bd0b3c90ee32519ef9f59725dbd014aed6
  ```
  URL — `/webhook/`, `auth=ok`, `idempotency=new`, заголовки контракту на місці; колбек дійшов,
  застосунок відповів **202** з першої спроби. `--callback-url` не знадобився — застосунок передає
  `callbackUrl`. (Людина надіслала форму двічі — друга відправка о 08:14 дала такий самий результат.)
- **Час від «Надіслати» до відповіді форми:** **287 мс** (DevTools → Network, POST `/quotes/new`, людина).
- **Що показала `/quotes/<id>`** (`/quotes/q_807573b0-fcf2-4808-a3fa-92570c582e79`): одразу — «Готуємо
  кошторис», за кілька секунд, без дій людини — «Кошторис готовий» з кнопкою завантаження PDF.
- **Журнал сервера** (`npm start` копії, перша відправка):
  ```
  db:insertQuote: 1
  n8n out event=quote-request correlation=41d492bb-6bd0-4f5e-9d23-ea12e8fbf375 attempt=1 status=202 ms=51
  db:updateQuote: 1
  db:getQuote: 1
  db:updateQuote: 2
  n8n in event=quote-request correlation=41d492bb-6bd0-4f5e-9d23-ea12e8fbf375 status=202
  db:getQuote: 2
  db:getQuote: 3
  ```
  Тіл, email, назв компаній, токенів чи підписів немає (`grep -ciE "@example|test@|x-n8n-token|sha256=|signature"` → 0).

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — (скілів у копії немає) | так, першим кроком (`Skill`), далі `references/` і `scripts/` |
| `check-contract.mjs --changed-since base`: FAIL (id) | **9 FAIL**: C1, C3, C4, C6, C7, C9, C10, C11, C12 | **0 FAIL** (14 PASS) |
| `check-contract.mjs` на всьому проєкті | 11 FAIL (ще 2 від старого коду) | 0 FAIL — агент переробив і старий виклик лідів |
| URL вебхука в коді/`.env.example` | `/webhook-test/quote-request` (новий тестовий URL) | `/webhook` + подія |
| `auth=` / `idempotency=` у журналі мока | `auth=missing` → **403**; `idempotency` відсутній | `auth=ok` → **202**; `idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні — воркфлоу не запустився | так, **202** з першої спроби |
| Захист колбека | Bearer-токен на запит (хеш + `timingSafeEqual`), `request.json()`, без вікна часу й ідемпотентності (повтор → 409) | HMAC-SHA256 на сирому тілі, довжина + `timingSafeEqual`, вікно 300 с, `idempotency-key` (повтор → 200 duplicate) |
| Результат на `/quotes/<id>` | «Не вдалося підготувати кошторис» | «Кошторис готовий» + PDF |
| Час відповіді форми | 414 мс | 287 мс |
| Тіла чи персональні дані в журналі сервера | немає (є стек помилки) | немає |
| Змінених файлів | 11 (+494 / −1) | 15 (+658 / −15) |
| Запитання агента | під час роботи — жодного | під час роботи — жодного |
| Старий виклик n8n у формі лідів | не чіпав | переробив на клієнт + `after()`, мінімальний `data` |

**Що змінили в скілі після прогонів.** `c56abe1` — `check-contract.mjs` знаходив колбек-роут лише в
`app/api/n8n/`, тому на коді A перевірки C9–C12 спершу показали PASS, хоча роут
`app/api/quotes/[id]/callback/route.ts` контракту не відповідає. Тепер колбек-роутом вважається й роут з
`callback`/`webhook` у шляху або зі згадкою n8n у коді, а без колбек-роуту C9–C12 друкують **N/A** замість
«тихого» PASS. Вивід для A вище — уже новою версією; на коді B, на шаблонах і на `main` результат
(0 FAIL / 0 FAIL / 7 FAIL) не змінився, на `main` C9–C12 тепер N/A.


## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --3way docs/ab/b-with-skill.diff` у робочій гілці `ws04/Zahakailo30`
  (код гілки між BASE `eb39591` і HEAD не змінювався — `git diff eb39591 HEAD -- app components lib .env.example`
  порожній). Пробний `--check` і справжнє накладання — без конфліктів. `.env.local` і `node_modules/` у
  діфі немає, `package.json`/`package-lock.json` агент не змінював. Коміти:
  - `e1974f9` `feat(quotes): quote request feature from A/B run B (with skill)` — діф прогону B **без змін**
    (15 файлів, разом із `docs/n8n-integrations.md` — реєстр інтеграцій);
  - `e05b708` `fix(quote-form): team form pattern after transfer …` — доведення руками (нижче).
- **Що довелось доробити руками після перенесення (і чому скіл цього не дав).** Для контракту n8n —
  **нічого**: `check-contract.mjs` одразу 14 PASS / 0 FAIL на всьому коді, lint/build чисті, сценарій з моком
  і матриця колбеків проходять. Доробити довелось **форму** `/quotes/new` — не за контрактом n8n, а за
  патерном форм команди (Task B): у копії B був лише скіл `integrating-n8n-webhooks` (`SKILL.md` згадує
  «форма — за скілом форм команди, якщо він є»), тож агент зробив форму «як уміє»:
  - помилки полів без `aria-invalid`/`aria-describedby` і без підсумку `role="alert"`;
  - після помилки введене зникало (React 19 скидає форму, а `defaultValue` зі стану не було);
  - перехід на `/quotes/<id>` робив `useEffect` + `router.push` — **без JavaScript** користувач лишався на
    «Запит прийнято, відкриваємо статус…».

  Виправлено: дія повертає `values` разом з помилками і після запису робить ``redirect(`/quotes/${id}`)``
  (у Next 16 — 303 для відправки без JS), `after()` при цьому все одно виконується; форма —
  `label htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"`, `defaultValue` зі стану.
  Перевірено без JS (multipart POST з полями `$ACTION_*` зі сторінки): помилка → 200, `role="alert"`,
  `aria-invalid="true"`, введене на місці; успіх → `303 See Other`, `Location: /quotes/q_…` за 0,14 с.
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; старого `N8N_WEBHOOK_URL` з `/webhook-test/` немає. `git ls-files ".env*"`
  → лише `.env.example`.
- **`npm run lint`, `npm run build` на гілці:** без помилок (`✓ Compiled successfully`, у збірці
  `ƒ /api/n8n/[event]`, `ƒ /quotes/[id]`, `○ /quotes/new`).
- **`check-contract.mjs` на фінальному коді** (увесь проєкт, без прапорців; 0 FAIL, код виходу 0):
  ```
  check-contract: root=D:6-quitcode-04-agent-skills-hw | 41 code files + .env.example | whole project
  C1   PASS  test-url             no /webhook-test/ URL in code or .env.example
  C2   PASS  public-env           no NEXT_PUBLIC_N8N_* variables
  C3   PASS  single-module        n8n webhook env vars and fetch to n8n only in lib/n8n/client.ts
  C4   PASS  server-only          lib/n8n/client.ts exists when n8n is called and starts with import "server-only"
  C5   PASS  timeout              every fetch to n8n has signal: AbortSignal.timeout(...)
  C6   PASS  request-headers      webhook call sends x-n8n-token, idempotency-key, x-correlation-id
  C7   PASS  env-example          .env.example lists the contract keys with safe local values
  C8   PASS  async-action         a Server Action ("use server") calls n8n only inside after()
  C9   PASS  raw-body             callback route reads req.text(), never req.json(); JSON.parse only after the signature check
  C10  PASS  signature            callback compares signatures with a length check + crypto.timingSafeEqual, never ===/!==
  C11  PASS  replay-window        callback checks x-n8n-timestamp against a 300 s window
  C12  PASS  callback-idempotency callback reads idempotency-key and answers duplicates
  C13  PASS  no-edge              no runtime = "edge" in the project
  C14  PASS  logs                 console.* in n8n code never logs bodies, form data, contacts, tokens or signatures
  
  Summary: 14 PASS, 0 FAIL (14 checks, whole project)
  exit=0
  ```
- **Сценарій «форма → колбек → `/quotes/<id>`» на гілці** (`next start` гілки + мок з `tools/`,
  `--mode respond-202 --delay 5000`; змінні — одноразовий env-файл у тимчасовій теці, `.env.local` не
  відкривався): форма → 303 за 0,14 с; через ~5 с сторінка — «Кошторис готовий» + «Завантажити PDF».
  Журнал мока (кошторис, потім стара форма лідів на `/`):
  ```
  [mock-n8n] 2026-09-28T08:46:35.687Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  [mock-n8n] 2026-09-28T08:46:35.689Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  [mock-n8n] 2026-09-28T08:46:35.689Z test URLs: not registered (start with --listen to open them for 120 s)
  [mock-n8n] 2026-09-28T08:46:35.689Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] 2026-09-28T08:46:35.689Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  [mock-n8n] 2026-09-28T08:46:50.912Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 297 B sha256=190abcdf3d4678a14e31353b4ac6a042cbb0d27f9d94a685a44508722f8f6786
  [mock-n8n] 2026-09-28T08:46:50.913Z workflow fe82850d-9359-4111-8168-254415f7e656 running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-28T08:46:56.100Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 173 ms (try 1/3) event=quote-request.completed body 382 B sha256=76265f1fd39432eb64e7332e95a144f4921848ba97ca0e623c1731dca731b54b
  [mock-n8n] 2026-09-28T08:47:26.598Z POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 112 B sha256=1f829d738c607b5fb22e4a3bd08149b79c4f39ea228b1b81d2cfa7646e2f8bd7
  ```
  Журнал сервера (тіл, email, назви компанії, токенів і підписів — 0 збігів):
  ```
  db:insertQuote: 1
  n8n out event=quote-request correlation=861231cd-c996-402c-8743-d7b3ac581cbf attempt=1 status=202 ms=52
  db:updateQuote: 1
  db:updateQuote: 2
  n8n in event=quote-request correlation=861231cd-c996-402c-8743-d7b3ac581cbf status=202
  db:getQuote: 1
  db:updateQuote: 3
  n8n in event=quote-request job=87ae6eae-c4c4-429f-ba1d-cbbc0fd746ea correlation=5ef66dbf-e498-45fb-b043-a866f7a7cad2 quote=unknown
  n8n in event=quote-request correlation=7d7ce043-19cc-45a8-ac26-4e9d3d25b75e status=202
  db:insertLead: 1
  n8n out event=lead-created correlation=7b43d3c6-88ab-48e0-9e60-a557e4f024d7 attempt=1 status=202 ms=9
  db:insertAuditEntry: 1
  ```
  `send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request` → 12/12 PASS. Форма лідів на
  головній тепер: `/webhook/lead-created`, `auth=ok`, тіло 112 B (на `main` було 1236 B з IP, user agent,
  нотатками) і відповідь, що не чекає на n8n.
- **Рядок у `docs/n8n-integrations.md`:** є — його додав агент у прогоні B (`quote-request` і `lead-created`).

## Висновок

Скіл змінив результат по суті. Без скіла (A) агент зробив працездатну на вигляд фічу з власним,
по-своєму продуманим захистом (Bearer-токен на запит, `timingSafeEqual`, таймаут, `after()`), але **не за
контрактом команди**: тестовий URL у `.env.example`, жодного `x-n8n-token`/`idempotency-key`/`x-correlation-id`,
колбек без HMAC, вікна часу й ідемпотентності, виклик n8n поза єдиним модулем — 9 FAIL
`check-contract`, а з налаштованим за контрактом n8n (Header Auth) запит отримав **403**, і кошторис
«не вдався». Домовленості A брав з наявного коду, документації Next.js у `node_modules` і загальних знань.
Зі скілом (B) агент сам викликав скіл першим кроком, узяв шаблони з `references/`, перевірив себе
скриптами скіла і дав **0 FAIL**, робочий цикл `202 → колбек 202 → «Кошторис готовий»`, ще й переробив
старий виклик n8n. Після перенесення довелось доробити лише форму за патерном Task B (цього скіла в
копії не було — межа скіла n8n). Сам скіл після прогонів покращено в одному місці: `check-contract.mjs`
тепер знаходить колбек-роут будь-де і не дає «тихого» PASS (`c56abe1`).
