# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`, Task D. **A — без скіла, B — зі
> скілом.** Числа й цитати — із сесій і журналів. Результат прогону **B** перенесено в гілку — останній
> розділ.

- **Інструмент і версія:** Claude Code (розширення VS Code), Windows 10 Pro 19045
- **Модель і рівень міркування (effort), однакові в обох прогонах:** _після прогонів_
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
- **Відповідь на уточнення, однакова в обох:** _після прогонів_
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії): _після прогонів_
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): в обох
  копіях однаково — **7 PASS, 7 FAIL** (C1 `.env.example:6`, C3/C4/C5/C6/C8 `app/actions.ts:55` (на BASE рядок зсунувся на 1 після Task A), C7
  `.env.example`). Це старий код, в оцінку прогонів не йде.

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
  базової лінії зникли.
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
