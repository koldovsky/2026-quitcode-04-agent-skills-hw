# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

**A — без скіла, B — зі скілом.** Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`,
Task D. Числа й цитати — із сесій і журналів. Фічу «запит на кошторис» будує агент у прогонах;
результат прогону **B** перенесено в гілку — останній розділ.

> **Коротко.** Той самий запит, дві свіжі сесії, Opus 5.5 з effort `high`. **A (без скіла) — 7 FAIL
> з 13** на власному коді прогону: n8n клієнта відповідає 403 (немає Header Auth), а колбек за
> контрактом отримав би 401 (A вигадав Bearer-токен замість HMAC). **B (зі скілом) — 0 FAIL**, скіл
> викликано першою дією, форма відповідає за 167 мс, колбек — 202, матриця колбеків — 11 з 11. Фіча
> в гілці — діф прогону B без правок (`d8d509a`); руками доведено старий виклик у `submitLead`
> (`5679c83`), після рев'ю домашки — ще чотири дрібниці (розділ «Після рев'ю домашки»).
> `check-contract.mjs` на фінальному коді — 13 PASS / 0 FAIL. Відхилення від протоколу й
> додаткові перевірки поза ним описано в розділах прогонів.

- **Інструмент і версія:** Claude Code 2.1.283 — CLI з розширення VS Code, запуск однаковим
  скриптом для обох прогонів (`start-run-a.cmd` / `start-run-b.cmd`: `cd` у теку копії, конектори
  claude.ai вимкнено змінною `ENABLE_CLAUDEAI_MCP_SERVERS=false`)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-5-5`
  (`/context` в обох копіях), effort `high` (`~/.claude/settings.json`); підтверджено `/model`
  на старті кожного прогону: в обох журналах сесій — «Set model to `Opus 5.5` for this session only with `high` effort»
- **Код:** BASE = `c9b2f02` (коміт після Task C: три скіли, виправлення Task A, ще без `/quotes` і
  змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з HEAD `7eee53a` (після
  BASE змінювались лише `docs/`; тека скіла ідентична: `git diff c9b2f02 HEAD -- .claude/skills/integrating-n8n-webhooks` порожній)
- **Копії:** `../leaddesk-ab-a` (без жодного проєктного скіла), `../leaddesk-ab-b` (лише
  `integrating-n8n-webhooks`); у кожній — `git init`, коміт `start` з тегом `base` (A — `0639c8b`,
  B — `1f97e1f`), потім `npm ci` (не `npm install`: lockfile не змінюється, тож у діфі прогону
  немає чужих змін; `git status` після встановлення — чистий)
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`,
  `.github/` і всі скіли (у B повернуто лише `integrating-n8n-webhooks`). Перевірка:

  ```
  $ find ../leaddesk-ab-a ../leaddesk-ab-b -name SKILL.md -not -path "*/node_modules/*"
  ../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md
  $ ls -A ../leaddesk-ab-a ../leaddesk-ab-b | grep -xE 'tools|materials|docs|README.md|.coderabbit.yaml|.github' || echo "no hints - ok"
  no hints - ok
  $ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a --exclude-dir=node_modules || echo "no contract - ok"
  no contract - ok
  ```

- **Особисті копії скіла:** немає. `~/.cursor/skills` і `~/.agents/skills` не існують,
  у `~/.codex/skills` — лише системна `.system` (Codex). Особисті скіли `find-skills` і
  `postgres-migrations` на час прогонів перенесено з `~/.claude/skills` у `~/.claude/skills.off-ws04`.
  Лишились скіли, які Claude Code синхронізує з акаунта claude.ai (`docs`, `docx`, `google-workspace`,
  `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`, `xlsx`), і вбудовані (`dataviz`,
  `code-review`, `security-review`, `run` …) — однакові в обох копіях і не про n8n чи Next.js.
- **Які скіли бачить агент** (окремий запуск `start-run-<arm>.cmd -p "/context"`, не в сесії прогону):
  - A — жодного проєктного скіла; вбудовані й синхронізовані з claude.ai; MCP-інструментів — 0;
  - B — `integrating-n8n-webhooks · Project` + той самий набір вбудованих і синхронізованих; MCP — 0.

  Без вимкнення конекторів `/context` показував у копіях MCP-сервери claude.ai (Airtable, Supabase,
  Xero, PostHog, Claude Docs, у B ще Make); їх вимкнено в обох прогонах, щоб агент не мав іншого
  джерела знань про n8n і доступу до сервісів.
- **Запит:** `materials/ab-task.md` без змін (файл `prompt.txt` — рядки 14–18), нова сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** «Роби, як вважаєш правильним» — агент не питав ні в A, ні в B
- **Однакові правила дозволів:** режим accept edits; команди в теці копії — разове «Yes»; усе поза
  текою копії, нові пакети, веб — «No» (записано в розділах прогонів)
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000` — `--callback-url` не знадобився: обидва застосунки передають `callbackUrl` у тілі запиту
- **Базова лінія `check-contract.mjs` на копіях до прогону** (увесь код, без `--changed-since`):
  в обох **7 PASS, 6 FAIL** — C1 (`.env.example:6`, `/webhook-test/`), C3, C5, C6, C13
  (`app/actions.ts:56`, старий виклик n8n у `submitLead`), C11 (у `.env.example` немає ключів
  контракту). Це старий код; в оцінку прогонів він не йде.

## A — без скіла

Сесія `7e393569-f297-48a0-8692-eabf6c79cdaa` (`~/.claude/projects/D--leaddesk-ab-a/`), 27.09.2026,
18:37–18:50 за Києвом (у журналі UTC 15:37:45–15:50:40); `/model` на старті: «Opus 5.5 … with
`high` effort». Інструменти: Read ×22, Bash ×13, Edit ×11, Write ×10, Glob ×1, TaskStop ×2; `Skill`,
WebFetch, WebSearch, MCP — жодного разу.

- **Відхилення від протоколу:** третя команда агента (`for f in app/actions.ts … next.config.ts; do
  cat "$f"; done; ls tools` — читання файлів **усередині** копії) отримала «No», сесію перервано, і
  той самий запит вставлено вдруге (15:40:19 UTC) без жодного іншого тексту. Підказки не було: агент
  прочитав ті самі файли інструментом Read. У прогоні B відхилень і переривань не було.
- Які скіли бачив агент: див. вище — жодного проєктного
- Що зробив агент — своїми словами: форма `/quotes/new` (компанія, email, опис, бюджет) з
  `useActionState`; Server Action `requestQuote` зберігає запит і **чекає** відповіді n8n (до 10 с,
  `AbortSignal.timeout`) у самій дії, потім `redirect` на `/quotes/[id]`; виклик n8n — у
  `lib/quotes.ts`, `POST` на повний URL з `N8N_QUOTE_WEBHOOK_URL` з тілом
  `{ quoteId, company, email, description, budget, callbackUrl, callbackToken }` без жодного
  заголовка контракту. Колбек — `POST /api/quotes/[id]/callback` із захистом разовим токеном на
  кожен запит (`Authorization: Bearer …`, у базі — лише sha256 токена, порівняння через
  `timingSafeEqual`), тіло — `{ status: "ready", pdfUrl }` / `{ status: "failed", error }`; повторний
  колбек не перезаписує фінальний результат. `/quotes/[id]` опитує статус кожні 5 с. Людині
  порадив налаштувати вебхук у режимі **«Respond: Immediately»**. Власний мок n8n написав у своїй
  тимчасовій теці й перевірив цикл на `next dev -p 3100`.
- Звідки агент узяв домовленості (з журналу сесії): з коду проєкту (прочитав `app/actions.ts`,
  `lib/db.ts`, `lib/lead-form.ts`, `lib/note-form.ts`, `components/lead-note-form.tsx` тощо — звідти
  патерн форми й «введене не зникає»), з документації Next.js у `node_modules` (`after.md`,
  `refresh.md`, `15-route-handlers.md`, `redirect.md`) і із загальних знань. `after.md` прочитав, але
  виклик n8n в `after()` не виніс. Шукав `tools/**` — теки немає. Контракту команди (Header Auth
  `x-n8n-token`, `idempotency-key`, `x-correlation-id`, HMAC-підпис колбека з вікном 300 с,
  202 + колбек) у прогоні A немає ніде — ані в коді, ані у фінальній відповіді.
- Запитання агента: жодного. Фінальна відповідь (скорочено): «Сторінки `/quotes/new` і
  `/quotes/[id]`, Server Action і ендпоінт для n8n готові. Я прогнав повний цикл локально з
  імітацією n8n — усе спрацювало… [Server Action] чекає лише підтвердження, що n8n прийняв запит
  (не довше 10 с)… Ендпоінт `POST /api/quotes/[id]/callback`… одноразовий секретний ключ… У вузлі
  Webhook воркфлоу `quote-request` увімкнути «Respond: Immediately»… `N8N_QUOTE_WEBHOOK_URL` —
  production-адреса вебхука `/webhook/…`… Обмеження: немає захисту від спаму; запити лише в пам'яті».
- Змінені файли (`git diff --cached --stat base`): 12 файлів, +630 / −1 — `.env.example`,
  `app/api/quotes/[id]/callback/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`,
  `app/quotes/new/page.tsx`, `components/quote-form.tsx`, `components/quote-status-poller.tsx`,
  `lib/data.ts`, `lib/db.ts`, `lib/quote-form.ts`, `lib/quotes.ts`, `lib/types.ts`;
  діф: `docs/ab/a-without-skill.diff`
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request`,
  `APP_URL=http://127.0.0.1:3000` (токена для n8n і секрету колбека немає — токен колбека
  генерується на кожен запит)
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` (версія `2aa71a0` — див.
  «Що змінено в скілі» нижче; попередня версія з BASE давала тут 11 PASS / 2 FAIL, бо не бачила
  виклику n8n поза `lib/n8n/` і колбека поза `app/api/n8n/`):
  ```
  check-contract · root=../leaddesk-ab-a · changed since base (12 file(s))
  C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
  C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
  C3   FAIL  Виклики n8n і змінні N8N_* лише в lib/n8n/
           app/quotes/actions.ts:32  const webhookUrl = process.env.N8N_QUOTE_WEBHOOK_URL;
           lib/quotes.ts:48  const response = await fetch(webhookUrl, {
  C4   FAIL  Модулі, що викликають n8n, починаються з import "server-only"
           lib/quotes.ts:1  перший рядок не import "server-only"
  C5   PASS  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
  C6   FAIL  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
           lib/quotes.ts:48  заголовки не передаються: x-n8n-token, idempotency-key, x-correlation-id
  C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C8   FAIL  Підпис: спершу довжини, потім timingSafeEqual; не ===
           app/api/quotes/[id]/callback/route.ts:1  немає перевірки підпису x-n8n-signature (HMAC-SHA256 від timestamp.rawBody)
  C9   FAIL  Колбек перевіряє час (±300 с) і idempotency-key
           app/api/quotes/[id]/callback/route.ts:1  немає: x-n8n-timestamp, порівняння з Date.now() у вікні 300 с, idempotency-key, звірка ключа з data.jobId
  C10  PASS  Немає runtime = "edge"
  C11  FAIL  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
           .env.example  немає N8N_WEBHOOK_BASE_URL
           .env.example  немає N8N_WEBHOOK_TOKEN
           .env.example  немає N8N_CALLBACK_SECRET
           .env.example  немає APP_BASE_URL
  C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
  C13  FAIL  Server Action не чекає на n8n: виклик лише в after()
           app/quotes/actions.ts:47  const start = await startQuoteWorkflow(quote, callbackToken, { webhookUrl, appUrl });  ← виклик n8n поза after(): користувач чекає на n8n

  6 PASS, 7 FAIL
  exit=1
  ```
- **Сценарій з моком** (`npm run build && npm start` у копії; `.env.local` — змінні агента A зі
  значеннями для мока плюс `N8N_WEBHOOK_TOKEN` і `N8N_CALLBACK_SECRET` мока, згенеровані, не
  друкувались; форму надіслано так, як це робить гідрована форма — POST Server Action із
  заголовком `Next-Action`; дані синтетичні: `Nova Dental`, `olha.test@example.test`). Журнал мока:
  ```
  [mock-n8n] … header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] … POST /webhook/quote-request -> 403 in 2 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 359 B sha256=f10c4774…
  ```
  Воркфлоу не запустився, колбека немає.
- Час від «Надіслати» до відповіді форми: **281 мс** — форма показала «Не вдалося запустити
  підготовку кошторису. Спробуйте ще раз за кілька хвилин.», введене лишилось.
- Що показала `/quotes/<id>`: сторінки немає — дія повернула помилку, `redirect` не було.
- **Додатково, поза протоколом** — той самий сценарій з моком **без** Header Auth (лише
  `N8N_CALLBACK_SECRET`), щоб побачити колбек: форма — `redirect /quotes/quote_5867…` за 314 мс;
  мок — `POST /webhook/quote-request -> 202 … auth=none idempotency=absent`, через 5 с
  `callback POST http://127.0.0.1:3000/api/quotes/quote_5867…/callback -> 401` (роут чекає
  `Authorization: Bearer`, а n8n за контрактом підписує HMAC); `/quotes/<id>` і через 8 с —
  «Готуємо кошторис… Зазвичай це 40–90 секунд». Тобто навіть без Header Auth результат від n8n
  клієнта не дійде ніколи.
- Журнал сервера: `db:insertQuote: 1`, `quote.workflow_start failed { quoteId: 'quote_e1a2…', httpStatus: 403 }`,
  `db:finishQuote: 1` — без тіл запитів, email, назви компанії, токенів і підписів (перевірено
  скриптом по значеннях: усе `false`).

## B — зі скілом

Сесія `a8b67d4a-2b52-4822-b07f-f51828573d51` (`~/.claude/projects/D--leaddesk-ab-b/`), 27.09.2026,
19:11–19:22 за Києвом (у журналі UTC 16:11:18–16:22:06); `/model` на старті: «Opus 5.5 … with
`high` effort». Інструменти: `Skill` ×1, Bash ×16, Read ×11, Edit ×12, Write ×11, ToolSearch ×1,
TaskStop ×2; WebFetch, WebSearch, MCP — жодного разу. Відхилених дозволів і переривань не було;
запит вставлено один раз.

- Які скіли бачив агент: див. вище — лише `integrating-n8n-webhooks`
- **Чи викликав агент скіл:** **так, першою ж дією** — `Skill(integrating-n8n-webhooks)` через
  5 с після запиту (16:11:23 UTC), ще до читання файлів проєкту. Далі прочитав
  `references/contract.md`, `references/callback.md`, `references/code-templates.md`, запускав
  `scripts/check-contract.mjs --changed-since HEAD`, `scripts/mock-n8n.mjs` і
  `scripts/send-signed-callback.mjs` зі скіла (мок у скілі — частина скіла, не витік).
- Що зробив агент — своїми словами: `lib/n8n/client.ts` (перший рядок `import "server-only"`,
  заголовки `x-n8n-token`, `idempotency-key`, `x-correlation-id`, `AbortSignal.timeout(10_000)`, до
  2 повторів на мережу/таймаут/5xx), `lib/n8n/idempotency.ts`; Server Action `requestQuote`
  валідує, зберігає запис `queued` з `idempotencyKey` і `correlationId`, повертає `{ status: "ok", id }`,
  а виклик n8n — в `after()` з `try/catch` і умовним оновленням статусу; у n8n іде лише
  `{ quoteId, company, description, budget }` (email не надсилається). Колбек
  `app/api/n8n/[event]/route.ts` — порядок з `references/callback.md` (404/415 → сире тіло → 413 →
  ±300 с → HMAC + `timingSafeEqual` → «застовпити» ключ → `JSON.parse` і звірка з `jobId` → запис →
  202). `/quotes/[id]` оновлюється кожні 5 с, після 5 хв пише про затримку. Додав ключі контракту в
  `.env.example` і `docs/n8n-integrations.md` (реєстр). Старий виклик n8n у `submitLead` свідомо
  не чіпав («поза задачею») і назвав у відповіді.
- Запитання агента: жодного. Фінальна відповідь (скорочено): «Кошторис через n8n працює від
  початку до кінця. Я перевірив усе на локальному моку n8n зі скіла: форма відповідає одразу, n8n
  отримує запит, колбек приходить… Перевірка контракту зі скіла по моїх змінах — 13 з 13 PASS… з
  моком: форма відповіла за 250 мс, мок прийняв запит (`202 auth=ok idempotency=new`)… Тест
  колбеків — усі 11 випадків пройшли… **Що варто підтвердити:** форма публічна, без входу…; email у
  n8n не надсилається…; ключі проти повторних колбеків — у пам'яті процесу, для продакшну потрібна
  таблиця або KV…; воркфлоу в n8n треба налаштувати під цей контракт (`references/n8n-setup.md`)…;
  стара відправка лідів у n8n порушує той самий контракт… Я її не чіпав, бо це поза задачею».
- Змінені файли (`git diff --cached --stat base`): 13 файлів, +751 / −1 — `.env.example`,
  `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`,
  `app/quotes/new/page.tsx`, `components/quote-form.tsx`, `components/quote-status-refresher.tsx`,
  `docs/n8n-integrations.md`, `lib/db.ts`, `lib/n8n/client.ts`, `lib/n8n/idempotency.ts`,
  `lib/quote-form.ts`, `lib/types.ts`; файли скіла агент не змінював; діф: `docs/ab/b-with-skill.diff`
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000` — рівно ключі записки
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base` (версія `2aa71a0`; версія з
  BASE, яку бачив агент, дає те саме — 13 PASS):
  ```
  check-contract · root=../leaddesk-ab-b · changed since base (13 file(s))
  C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
  C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
  C3   PASS  Виклики n8n і змінні N8N_* лише в lib/n8n/
  C4   PASS  Модулі, що викликають n8n, починаються з import "server-only"
  C5   PASS  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
  C6   PASS  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
  C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===
  C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key
  C10  PASS  Немає runtime = "edge"
  C11  PASS  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
  C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
  C13  PASS  Server Action не чекає на n8n: виклик лише в after()

  13 PASS, 0 FAIL
  exit=0
  ```
  На всій копії B (без `--changed-since`) — 8 PASS / 5 FAIL: C1, C3, C5, C6, C13 — це старий
  `submitLead` і рядок `N8N_WEBHOOK_URL=…/webhook-test/…` з базової лінії.
- **Сценарій з моком** (ті самі умови, що для A: мок з Header Auth, `respond-202`, `--delay 5000`,
  підписаний колбек на `callbackUrl` із запиту; `.env.local` — ключі агента B зі значеннями мока).
  Журнал мока:
  ```
  [mock-n8n] … header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] … POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 262 B sha256=84ca1317…
  [mock-n8n] … workflow 207c9cf2-… running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] … callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 150 ms (try 1/3) event=quote-request.completed body 382 B sha256=b2fe583f…
  ```
- Час від «Надіслати» до відповіді форми: **167 мс** (`{"status":"ok","id":"16e32e54-…"}`; далі
  клієнт переходить на `/quotes/<id>`).
- Що показала `/quotes/<id>`: одразу — «Готуємо кошторис», після колбека — «**Готово.** Кошторис
  готовий: завантажити PDF» з посиланням `https://files.example.test/n8n/207c9cf2-….pdf`; сторінка
  з `noindex`.
- Журнал сервера: `db:insertQuote: 1`, `n8n.out { event: 'quote-request', correlationId: 'fcd27428-…', status: 202, ms: 91, attempt: 1 }`,
  `db:updateQuoteIfStatus: 1`, `db:completeQuote: 1`, `n8n.in { event, correlationId, status: 202, size: 382, sha256 }` —
  без тіл, email, назви компанії, токенів і підписів (перевірено скриптом по значеннях: усе `false`).
- Матриця колбеків (`send-signed-callback.mjs` з робочого репозиторію проти роуту B): **11/11**
  як очікувалось (повтор → 200 `{"duplicate":true}`, невідома подія й `constructor` → 404,
  `text/plain` → 415, зіпсований підпис / старий час / переформатоване тіло → 401, чужий ключ /
  тіло не тієї форми → 400, > 64 КБ → 413).

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — (скілів немає) | так, першою дією, через 5 с після запиту |
| `check-contract.mjs --changed-since base`: FAIL (id) | **7 FAIL**: C3, C4, C6, C8, C9, C11, C13 (6 PASS) | **0 FAIL** (13 PASS) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request` (повний URL у `N8N_QUOTE_WEBHOOK_URL`) | `/webhook/quote-request` (`N8N_WEBHOOK_BASE_URL` + подія) |
| Заголовки контракту в запиті до n8n | немає: `accept,accept-language,content-type,user-agent` | `x-n8n-token`, `idempotency-key`, `x-correlation-id` |
| `auth=` / `idempotency=` у журналі мока | `403 auth=missing` (без Header Auth — `auth=none idempotency=absent`) | `202 auth=ok idempotency=new` |
| Хто чекає на n8n | Server Action (до 10 с) | ніхто: `after()`, дія одразу повертає `{ status, id }` |
| Колбек дійшов; код відповіді застосунку | ні (403 на запуск); без Header Auth — колбек → **401** (Bearer замість HMAC) | так, **202** через 5 с; сторінка — «Готово» + PDF |
| Захист колбека | разовий Bearer-токен на запит, sha256 у базі, `timingSafeEqual`; без вікна часу | HMAC-SHA256 `timestamp.rawBody`, довжини + `timingSafeEqual`, ±300 с, `idempotency-key` звірено з `jobId` |
| Матриця колбеків (11 випадків) | не застосовна (інший протокол колбека) | 11/11 |
| Час відповіді форми | 281 мс (помилка «не вдалося запустити») | 167 мс (`ok`, перехід на `/quotes/<id>`) |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Що йде в n8n | `quoteId, company, email, description, budget, callbackUrl, callbackToken` | `quoteId, company, description, budget` (+ `callbackUrl`), без email |
| Змінних середовища | 2, свої назви (`N8N_QUOTE_WEBHOOK_URL`, `APP_URL`) | 4, ключі записки (`N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`) |
| Змінених файлів | 12 (+630) | 13 (+751, з них `docs/n8n-integrations.md`) |
| Запитання агента | жодного | жодного (5 пунктів «що варто підтвердити» у фінальній відповіді) |
| Тривалість сесії | ≈ 10,5 хв від другого вставлення запиту (≈ 13 хв від першого) | ≈ 11 хв |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` у робочій гілці (код `app/`,
  `components/`, `lib/` з BASE не змінювався, діф ліг чисто); коміт `d8d509a` — 13 файлів, **без
  жодної правки**: кожен файл ідентичний копії B (`diff -q --strip-trailing-cr` по всіх 13).
  Діфи обох прогонів — окремим комітом `docs(ab)` перед цим.
- Що довелось доробити руками — у робочому репозиторії, не агентом прогону (коміти окремо):
  - `5679c83` — старий виклик n8n у `submitLead` (публічна форма заявки): голий `fetch` на
    `N8N_WEBHOOK_URL` (`/webhook-test/` у `.env.example`) з усім рядком ліда (IP, user agent, сира
    форма), без токена, таймауту й перевірки відповіді, з очікуванням у самій дії. Агент B його
    свідомо не чіпав («поза задачею») і назвав у фінальній відповіді. Тепер —
    `triggerWorkflow("lead-created", { leadId, company, budget, source }, { idempotencyKey })` з
    `lib/n8n/client.ts` в `after()`; `N8N_WEBHOOK_URL` прибрано з `.env.example`; подію додано в
    `N8nEvent`.
  - `73698b4` — рядок `lead-created` у `docs/n8n-integrations.md` (реєстр створив агент B).
  - У коді самого прогону B правити не довелось нічого.
  - **Чому скіл цього не дав:** скіл описує, як писати нову інтеграцію, і правило зупинки не
    переписувати зайве без запиту; агент B дотримався і того, і іншого — побачив порушення в
    старому коді, але лише повідомив. Це межа скіла, а не помилка прогону.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; жодного `/webhook-test/` і `NEXT_PUBLIC_N8N_*`.
- `npm run lint`, `npm run build` на гілці: без помилок (після `d8d509a` і після `5679c83`).
- `check-contract.mjs` на фінальному коді (увесь проєкт, без `--changed-since`):
  ```
  check-contract · root=. · whole project
  C1   PASS  Тестовий URL вебхука (/webhook-test/) у коді чи .env.example
  C2   PASS  Змінні N8N_* з префіксом NEXT_PUBLIC_
  C3   PASS  Виклики n8n і змінні N8N_* лише в lib/n8n/
  C4   PASS  Модулі, що викликають n8n, починаються з import "server-only"
  C5   PASS  fetch до n8n з таймаутом (signal: AbortSignal.timeout)
  C6   PASS  Заголовки x-n8n-token, idempotency-key, x-correlation-id у запиті до n8n
  C7   PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C8   PASS  Підпис: спершу довжини, потім timingSafeEqual; не ===
  C9   PASS  Колбек перевіряє час (±300 с) і idempotency-key
  C10  PASS  Немає runtime = "edge"
  C11  PASS  .env.example з ключами контракту (секрети — change-me-…, адреси локальні)
  C12  PASS  Журнали коду n8n без тіл, секретів і персональних даних
  C13  PASS  Server Action не чекає на n8n: виклик лише в after()

  13 PASS, 0 FAIL
  exit=0
  ```
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці (`npm run build`, `next start`
  на `:3000`; ключі контракту — з тимчасового файлу змінних із щойно згенерованими значеннями, свій
  `.env.local` не відкривали; мок з робочого репозиторію `--mode respond-202 --delay 5000`):
  - кошторис: форма — **169 мс**, `{"status":"ok","id":"cc072f51-…"}`; мок —
    `POST /webhook/quote-request -> 202 … auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token`;
    через 5 с `callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202`; `/quotes/<id>` —
    «Готово. Кошторис готовий: завантажити PDF»;
  - заявка з публічної форми: **418 мс** `{"status":"ok"}`; мок —
    `POST /webhook/lead-created -> 202 … auth=ok idempotency=new | … | body 119 B` (раніше — увесь
    рядок ліда на `/webhook-test/`);
  - журнал сервера — лише `db:*`, `n8n.out`/`n8n.in` з подією, correlation id, статусом, розміром і
    sha256; email, телефону, імені, назви компанії, токенів і підписів немає;
  - матриця колбеків — 11/11, `exit=0`.
- Рядок у `docs/n8n-integrations.md`: `quote-request` (створив агент B) і `lead-created`.

### Після рев'ю домашки

Рев'ю гілки знайшло ще чотири місця; кожне — окремим комітом:

- `f72aebb` — **форма `/quotes/new` не за патерном команди.** Прогін B обгортав поля в `<label>` і
  клав текст помилки всередину, без `id` і `aria-describedby`. Це очікувано: у копії B був лише
  n8n-скіл, а не `building-client-form` (так вимагає протокол), тож перенесена фіча не виконувала
  інший скіл команди — ще одна межа, яку видно лише після перенесення. Тепер `label htmlFor`,
  `aria-invalid`, `aria-describedby` → `<p id="quote-…-error">`. Перевірено без JS на `next start`
  (multipart POST з полями `$ACTION_*` із серверного HTML): порожня відправка — три поля з
  `aria-invalid`, кожне з `aria-describedby` на свій текст помилки, підсумок у `role="alert"`;
  неправильний email — `aria-invalid` лише на email, введене в усіх полях лишилось.
- `fff173e` — **`idempotency-key` для `lead-created` тепер зберігається з лідом**
  (`Lead.idempotencyKey`), як вимагає контракт («один на бізнес-операцію, зберігається з записом»);
  раніше жив лише в змінній дії.
- `ed774dc` — **колбек-роут журналює `x-correlation-id` лише у формі UUID.** Заголовок приходить до
  перевірки підпису й ішов у `n8n.in` як є на 404/415/413/401. Перевірено: запит з
  `x-correlation-id: forged text goes here` → 401, у журналі `correlationId: 'invalid'`, тексту
  заголовка немає. Той самий недолік був у шаблоні скіла — виправлено там (`fbfebf8`).
- `4c34842` — **публічна форма заявки чекала запис аудиту** (250 мс) до відповіді; тепер він в
  `after()`, як і виклик n8n. Медіана відповіді форми — **408 → 150 мс** (докладно —
  `docs/verification.md`, Task A, `server-after-nonblocking`).

Повторна перевірка на гілці після цих змін (`npm run build`, `next start` на `:3000`, мок з
робочого репозиторію `--mode respond-202 --delay 5000`, ключі з `.env.local`, значень не друкували):

- кошторис: форма — **166 мс**, `{"status":"ok"}`; мок — `POST /webhook/quote-request -> 202 …
  auth=ok idempotency=new | headers: …,idempotency-key,…,x-correlation-id,x-n8n-token`, через 5 с
  `callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202`; `/quotes/<id>` — «Кошторис
  готовий»;
- заявка з публічної форми: **150 мс** (медіана 5 відправок), мок — `POST /webhook/lead-created ->
  202 … auth=ok idempotency=new … body 123 B`;
- матриця колбеків (`send-signed-callback.mjs`) — 11 з 11, `exit=0`;
- журнал сервера: email, назви компанії, телефону, імені, підписів і тексту підробленого заголовка
  немає (пошук по значеннях — 0 збігів); `n8n.out` / `n8n.in` — лише подія, correlation id, статус,
  розмір і sha256;
- `npm run lint`, `npm run build` — без помилок; `check-contract.mjs` — 13 PASS / 0 FAIL;
  `self-test.mjs` — усі випадки як очікувалось.

Рев'ю CodeRabbit PR #13 і друге коло рев'ю за тим самим `.coderabbit.yaml` додали виправлення коду
фічі й скіла: ліміт тіла колбека під час читання, точний `application/json`, `https` для
`N8N_WEBHOOK_BASE_URL` (з окремими назвами помилок конфігурації), звірку `jobId` у `completeQuote`,
honeypot в обох публічних формах; у скрипті `check-contract.mjs` — перевірку C5 і читання шляхів git
у `--changed-since`; у `send-signed-callback.mjs` — обробку опцій і 12-й випадок матриці (chunked
без `content-length`). Таблиці з відтвореннями «було → стало» — `docs/verification.md`, розділ
«Рев'ю CodeRabbit».

**Відомі обмеження (свідомо не змінювали):** `/quotes/new` і форма заявки — публічні форми з
honeypot-полем (`d068c93`), але без обмеження частоти (агент B сам назвав антиспам у «що варто
підтвердити»);
ключі колбеків — у пам'яті процесу (для продакшну — таблиця з унікальним ключем). Обидва — рішення
людини й клієнта (пороги, сховище), а не коду з домашки.

## Що змінено в скілі під час Task D

- `2aa71a0` (після прогону A, до прогону B) — `check-contract.mjs` бачив лише домовлені місця
  (`lib/n8n/`, `app/api/n8n/`, URL з `N8N_*`). Прогін A поклав виклик n8n у `lib/quotes.ts`
  (`fetch(webhookUrl, …)`) і колбек у `app/api/quotes/[id]/callback`, тож C4–C9 і C13 для нього
  «нічого не знаходили» (11 PASS / 2 FAIL). Тепер виклик n8n розпізнається й за назвою чи
  значенням змінної з URL, колбек — за згадкою n8n у POST-роуті, хелпери з локальних модулів
  відстежуються на один рівень (підпис, час, ключ; Server Action, що чекає на функцію з
  n8n-модуля). Регресія: `main` 7/6, навмисно поганий код 0/13, шаблони 13/0 (LF, CRLF, `src/`,
  підпис в окремому модулі). Копія B працювала зі скілом з BASE (цю зміну агент B не бачив);
  обидва прогони виміряно новою версією.
- `816b79f` (після прогону B) — `send-signed-callback.mjs`: проти роуту B усі 11 випадків
  пройшли, але Node на Windows після цього падав з `Assertion failed … async.c` (вихід через
  `process.exit()` при відкритих keep-alive-з'єднаннях `fetch`), і код виходу ставав 127 замість 0.
  Тепер — `process.exitCode`.

## Висновок

Скіл змінив результат по суті, а не косметично. Той самий агент, та сама модель, той самий запит:
без скіла — 7 FAIL з 13 і фіча, яка з n8n клієнта не працює (Header Auth → 403, а колбек за
контрактом → 401, бо A вигадав власний Bearer-протокол і радив режим «Immediately»); зі скілом — 0
FAIL, скіл викликано першою дією, форма відповідає за 167 мс, колбек приймається, матриця 11/11.
Без скіла агент узяв домовленості з наявного коду (патерн форми) і загальних знань — і там, де
загальні знання розумні (таймаут, production-URL, чисті журнали), він їх має; контракту команди
(заголовки, HMAC з вікном 300 с, 202 + колбек, дія не чекає n8n) в нього немає звідки взяти.
Після перенесення B довелось доробити лише старий виклик у `submitLead`, якого запит не стосувався.
Сам скіл за цей бій виправлено двічі (`2aa71a0`, `816b79f`): скрипт перевірки мав сліпу зону для
коду поза домовленими шляхами — без прогону A ми б її не побачили.
