# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code CLI 2.1.283 (`claude -p --output-format stream-json --verbose`; повний журнал інструментів кожної сесії збережено)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `--model claude-opus-5-5 --effort high`, `--permission-mode acceptEdits`, однаковий список дозволених інструментів: `Read, Grep, Glob, Skill, Edit, Write, Bash/PowerShell(npm run lint), Bash/PowerShell(npm run build), Bash/PowerShell(node .claude/skills/*), Bash(git status), Bash(git diff:*)`. Усе інше в `-p` — відмова без запитання, однаково для обох.
- **Код:** BASE = `2f6e85f` (після Task C: виправлення Task A, три скіли, ще без `/quotes` і змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з HEAD на момент створення копій; код HEAD = BASE (після BASE були лише коміти в `docs/`).
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`); у кожній — коміт `start` з тегом `base`. Змінений `npm install`-ом `package-lock.json` повернуто `git checkout`, щоб агент бачив чистий `git status`.
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/` і `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks`). Перевірено: `find … -name SKILL.md` → рівно `../leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`; `ls -A … | grep …` → «no hints - ok»; `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" ../leaddesk-ab-a` → «no contract - ok».
- **Особисті копії скіла:** `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills` — немає. Особистий `~/.claude/skills/find-skills` (його поставив `npx skills` у Task A) до прогонів перенесено в `~/.claude/skills-disabled/`. Лишилась `~/.claude/skills/synced/` — скіли, які застосунок синхронізує з акаунта (`docs, docx, google-workspace, import-memory, morning, pdf, pptx, skill-creator, xlsx`, джерело «claude.ai sync»): однакові в обох прогонах, до n8n чи Next.js не стосуються. Вимкнути їх для окремої сесії CLI не можна (ними керує застосунок: після перенесення теки вона синхронізується знову), тому це відхилення від «у копії A — жодного скіла» зафіксовано явно. На результат вони не вплинули: у журналах сесій жодного виклику `Skill` на них немає — у A викликів `Skill` 0, у B рівно один, `integrating-n8n-webhooks`.
- **Запит:** текст між лініями `materials/ab-task.md`, витягнутий скриптом без змін (sha256 `498a125e…c39c`), подано на stdin; нова сесія на кожен прогін.
- **Відповідь на уточнення, однакова в обох:** посеред роботи жоден агент не питав. A завершив пропозиціями («Скажіть — додам»), B — чотирма запитаннями про наступні кроки. Щоб B не отримав більше ходів, ніж A, **жодну сесію не продовжували**.
- **Доступ поза текою копії:** обидва агенти писали власний допоміжний скрипт (свій мок) у **свою** тимчасову теку сесії Claude Code і пробували його запустити — відмова в дозволі, однаково для обох. Робочий репозиторій (`../hw4`) не читав жоден.
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії; робочий репозиторій у мене — тека `hw4`):
  `node --env-file=.env.local ../hw4/tools/mock-n8n.mjs --mode respond-202 --delay 5000`, без `--callback-url`: обидва агенти передають `callbackUrl` у тілі.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): A і B однаково — **8 FAIL, 7 PASS**: C1 (`.env.example:6`, `/webhook-test/`), C3, C4, C5, C6, C7, C8 (усі — `app/actions.ts:57`, старий виклик `lead-created`), C15 (`.env.example`); C9–C12 — колбек-роуту немає. Це старий код, в оцінку прогонів не йде.
- **Інструмент вимірювання:** `check-contract.mjs` з робочого репозиторію. Після прогону A в ньому знайшлась сліпа пляма (див. «Що змінилось у скілі»); виправлену версію (`bbbf5f1`) застосовано до **обох** прогонів. Копія B працювала зі скілом версії BASE.

## A — без скіла

- **Які скіли бачив агент** (окремий запуск `MSYS_NO_PATHCONV=1 claude -p "/context"` у `../leaddesk-ab-a`): жодного Project чи User; лише вбудовані й «claude.ai sync» (див. вище). У `init` сесії — те саме.
- **Що зробив агент:** `/quotes/new` з формою (`useActionState`, помилки біля полів); Server Action `app/quotes/actions.ts`: запис `pending` → `redirect` на `/quotes/<id>`, виклик n8n в `after()` з `AbortSignal.timeout(15 000)`, без повторів; колбек `POST /api/quotes/<id>/callback` з `Authorization: Bearer <N8N_CALLBACK_SECRET>` (sha256 обох боків + `timingSafeEqual`), тіло `{ status: "ready", pdfUrl } | { status: "failed", error }`, змінює лише запит у `pending`; `/quotes/[id]` з автооновленням кожні 5 с.
- **Звідки агент узяв домовленості** (журнал сесії, 47 викликів інструментів): наявний код (`app/actions.ts`, `lib/db.ts`, `lib/lead-form.ts`, форма ліда) і документація Next.js у `node_modules/next/dist/docs` (server actions, `after`, route handlers) — звідти `after()` і «відповісти й працювати далі». Шукав `.claude/**` і `tools/**` — порожньо. `/webhook-test/` узяв за зразком зі старого `.env.example` (`N8N_WEBHOOK_URL=…/webhook-test/lead-created`). Bearer-схема колбека, 15 с таймауту, «Respond: Immediately» — загальні знання. Header Auth, HMAC-підпис з часовим вікном, `idempotency-key`, `x-correlation-id`, конверт `{ version, event, data }` не з'явились: у копії їх нема звідки взяти.
- **Запитання агента і фінальна відповідь (скорочено):** запитань не було. «Сторінка `/quotes/new`, Server Action, callback-ендпоінт і `/quotes/[id]` готові… наживо весь ланцюжок я не перевірив… Webhook node має відповідати одразу (Respond: Immediately)… POST на `callbackUrl` із заголовком `Authorization: Bearer …`». Пропозиція: rate limit чи капча для публічної форми.
- **Змінені файли** (`git diff --cached --stat base`): 11 файлів, +513/−1 — `.env.example`, `app/api/quotes/[id]/callback/route.ts`, `app/quotes/{actions.ts, layout.tsx, new/page.tsx, [id]/page.tsx}`, `components/{quote-form, quote-status-poller}.tsx`, `lib/{db, quote-form, types}.ts`; діф: [`docs/ab/a-without-skill.diff`](ab/a-without-skill.diff)
- **Змінні середовища, які додав агент:** `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/quote-request`, `APP_URL=http://localhost:3000`, `N8N_CALLBACK_SECRET=` (порожнє). У `.env.local` для сценарію — ці змінні (секрет згенеровано, `APP_URL=http://127.0.0.1:3000`) плюс `N8N_WEBHOOK_TOKEN` для мока (змінної токена в агента немає).
- **`check-contract.mjs --root ../leaddesk-ab-a --changed-since base`** — лише код прогону:
  ```
check-contract · root: ../leaddesk-ab-a · changed since base · 15 checks
FAIL  C1   No test webhook URL (/webhook-test/) in code or .env.example
        .env.example:10  test webhook URL
PASS  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
FAIL  C3   Requests to n8n only from lib/n8n/client.ts
        app/quotes/actions.ts:41  fetch to n8n outside lib/n8n/client.ts
        app/quotes/actions.ts:26  N8N_QUOTE_WEBHOOK_URL read outside lib/n8n/client.ts
FAIL  C4   lib/n8n/client.ts starts with import "server-only"
        app/quotes/actions.ts:41  no lib/n8n/client.ts with import "server-only"
PASS  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
FAIL  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
        app/quotes/actions.ts:41  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
FAIL  C7   Request body is the envelope { version, event, data }
        app/quotes/actions.ts:41  body is not the { version: 1, event, data } envelope
PASS  C8   Server Actions do not await n8n: calls to n8n run inside after()
FAIL  C9   Callback route reads the raw body and parses JSON only after the signature check
        app/api/quotes/[id]/callback/route.ts:1  x-n8n-signature is never read: the body is parsed without an HMAC check
FAIL  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures
        app/api/quotes/[id]/callback/route.ts:1  no createHmac("sha256", …)
        app/api/quotes/[id]/callback/route.ts:20  no length check before timingSafeEqual
FAIL  C11  Callback checks x-n8n-timestamp within a 300 s window
        app/api/quotes/[id]/callback/route.ts:1  x-n8n-timestamp is not read
FAIL  C12  Callback uses idempotency-key and checks it against jobId from the signed body
        app/api/quotes/[id]/callback/route.ts:1  idempotency-key header is not used
PASS  C13  No runtime = "edge"
PASS  C14  No request bodies or personal data in logs of n8n / Server Action code
FAIL  C15  .env.example has the contract variables
        .env.example:15  N8N_CALLBACK_SECRET must be a change-me-… placeholder

10 FAIL, 5 PASS
exit=1
  ```
  Перший запуск старою версією скрипта дав 2 FAIL: назв `N8N_QUOTE_WEBHOOK_URL` і `app/api/quotes/[id]/callback` скрипт не впізнавав (див. «Що змінилось у скілі»).
- **Журнал мока** (форма → колбек → `/quotes/<id>`). Перший рядок — сценарій як є (URL з `.env.example` агента); другий — додаткова спроба, коли я вручну замінив у `.env.local` `/webhook-test/` на `/webhook/`, щоб побачити, чи далі все спрацює:
  ```
[mock-n8n] 2026-09-27T18:52:10.055Z POST /webhook-test/quote-request -> 404 in 2 ms  | headers: accept,accept-language,content-type,user-agent | body 355 B sha256=075119fabbf544625cd44670844d0f0edb89a9fb6e63cb9cb72154cb6a014399
[mock-n8n] 2026-09-27T18:52:46.479Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 355 B sha256=f308be9ca18edcff89ff00a36e2c63040279cb6c877becf4304b0360efd837cc
  ```
  Колбека не було (воркфлоу не запустився). Окремо: підписаний колбек у форматі n8n (як його шле мок: `x-n8n-timestamp`, `x-n8n-signature`, `idempotency-key`, тіло `{ version, event, data }`) на `/api/quotes/<id>/callback` → **401**: роут чекає `Authorization: Bearer`.
- **Час від «Надіслати» до відповіді форми:** 421 мс (друга спроба — 413 мс), після чого `redirect` на `/quotes/<id>`. Як міряли (однаково для A, B і гілки): продакшн-збірка (`npm run build && npm start`), у браузері — `performance.now()` від кліку «Надіслати» до зміни `location.pathname` на `/quotes/<id>` (тобто до відповіді Server Action і переходу), один прогін.
- **Що показала `/quotes/<id>`:** «Помилка · Не вдалося підготувати кошторис · Не вдалося запустити підготовку кошторису · Надіслати запит ще раз».
- **Журнал сервера:**
  ```
Failed to start quote-request workflow for quote_7bfec23a-a843-4314-a123-5ff7b24ae497 Error: n8n responded with 404
Failed to start quote-request workflow for quote_9d745997-b165-4a6c-95a0-5b6b5e5b96a8 Error: n8n responded with 403
  ```
  Тіл, email, телефонів, токенів і підписів немає (пошук `@example|Nova Dental|olena` — 0 збігів). Але в n8n агент надсилав `quoteId, company, email, description, budget, callbackUrl` — email без обґрунтування, що він потрібен воркфлоу.

## B — зі скілом

- **Які скіли бачив агент** (окремий запуск `/context` у `../leaddesk-ab-b`): `integrating-n8n-webhooks` (Project, ~330 токенів) + ті самі вбудовані й «claude.ai sync». У `init` сесії — те саме.
- **Чи викликав агент скіл:** так, сам — **перший** виклик інструмента в сесії: `Skill {"skill":"integrating-n8n-webhooks"}`. Потім прочитав `references/contract.md`, `references/code-templates.md`, `references/n8n-setup.md` (`response-modes.md` не читав), запускав `scripts/check-contract.mjs` (увесь проєкт і `--changed-since HEAD`), `--help` мока й `send-signed-callback.mjs`. Запуск мока й сервера наживо — відмова в дозволі (як і в A).
- **Що зробив агент:** `lib/n8n/client.ts` (`server-only`, заголовки, конверт, таймаут 10 с, 2 повтори) і `lib/n8n/callback-keys.ts` за шаблонами скіла; Server Action `requestQuote` (`queued` → `{ status, id }`, n8n в `after()`, 202 → `processing`, інакше `failed`); колбек `app/api/n8n/[event]/route.ts` за 9 кроками контракту + перевірка, що посилання на PDF — `http(s)`; `/quotes/[id]` («У черзі» → «Готуємо» → «Готово»/«Не вдалося»), автооновлення 5 с; `.env.example` — 4 ключі контракту; `docs/n8n-integrations.md` — реєстр інтеграції з налаштуваннями воркфлоу. У `data` для n8n — лише `quoteId, company, budget, description`: email не передав і спитав, чи він потрібен.
- **Запитання агента і фінальна відповідь (скорочено):** «Я додав `/quotes/new` і `/quotes/[id]`, Server Action… і ендпоінт для колбека… повний цикл із мок-n8n я не запускав… `check-contract --changed-since HEAD`: 15 PASS, 0 FAIL; на весь проєкт: 7 FAIL, і всі вони в старому `lead-created`». Запитання: (1) перевести старий `lead-created` (тестовий URL, весь запис з IP, синхронне очікування) на цей клієнт окремою задачею? (2) чи передавати email у воркфлоу? (3) `/quotes/*` публічні з UUID — чи потрібна сесія? (4) власник воркфлоу — «уточнити». Відповідей не давали (див. вище).
- **Змінені файли** (`git diff --cached --stat base`): 14 файлів, +647 — `.env.example`, `app/api/n8n/[event]/route.ts`, `app/quotes/{actions.ts, layout.tsx, new/page.tsx, [id]/page.tsx}`, `components/{auto-refresh, quote-form}.tsx`, `docs/n8n-integrations.md`, `lib/{db, quote-form, types}.ts`, `lib/n8n/{client, callback-keys}.ts`; діф: [`docs/ab/b-with-skill.diff`](ab/b-with-skill.diff)
- **Змінні середовища, які додав агент:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`, `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`, `APP_BASE_URL=http://127.0.0.1:3000` (старий `N8N_WEBHOOK_URL` не чіпав). У `.env.local` — ці назви зі згенерованими токеном і секретом; мок бере ті самі `N8N_WEBHOOK_TOKEN` і `N8N_CALLBACK_SECRET`.
- **`check-contract.mjs --root ../leaddesk-ab-b --changed-since base`** — лише код прогону:
  ```
check-contract · root: ../leaddesk-ab-b · changed since base · 15 checks
PASS  C1   No test webhook URL (/webhook-test/) in code or .env.example
PASS  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
PASS  C3   Requests to n8n only from lib/n8n/client.ts
PASS  C4   lib/n8n/client.ts starts with import "server-only"
PASS  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
PASS  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
PASS  C7   Request body is the envelope { version, event, data }
PASS  C8   Server Actions do not await n8n: calls to n8n run inside after()
PASS  C9   Callback route reads the raw body and parses JSON only after the signature check
PASS  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures
PASS  C11  Callback checks x-n8n-timestamp within a 300 s window
PASS  C12  Callback uses idempotency-key and checks it against jobId from the signed body
PASS  C13  No runtime = "edge"
PASS  C14  No request bodies or personal data in logs of n8n / Server Action code
PASS  C15  .env.example has the contract variables

0 FAIL, 15 PASS
exit=0
  ```
- **Журнал мока** (форма → колбек → `/quotes/<id>`):
  ```
[mock-n8n] 2026-09-27T19:00:16.314Z POST /webhook/quote-request -> 202 in 3 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 321 B sha256=4bfd84312ccb4401441e9d37e6b0f69be93013657e27bd858b18bc110a9826b5
[mock-n8n] 2026-09-27T19:00:16.315Z workflow a9ec1240-1ac2-48fa-92f8-b4f203c5421f running for 5000 ms, then callback event=quote-request.completed
[mock-n8n] 2026-09-27T19:00:21.465Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 134 ms (try 1/3) event=quote-request.completed body 382 B sha256=6a479fc8a92ef5ed993091e639231c512db1fbfd4bb22f812fba0fa2be46c150
  ```
- **Матриця колбеків** `send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request` на роуті B (версія скрипта на той момент — 10 негативних випадків; випадок `toString` додано пізніше, `d9956f7`):
  ```
send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request.completed · 10 cases
PASS  unknown event path                       expected 404, got 404
PASS  wrong content-type                       expected 415, got 415
PASS  body over 64 KB                          expected 413, got 413
PASS  timestamp 10 min old                     expected 401, got 401
PASS  timestamp 10 min ahead                   expected 401, got 401
PASS  wrong signature                          expected 401, got 401
PASS  signature without sha256= prefix         expected 401, got 401
PASS  body reformatted after signing           expected 401, got 401
PASS  valid signature, key != jobId:event      expected 400, got 400
PASS  valid signature, event of another path   expected 400, got 400

0 FAIL, 10 PASS
  ```
- **Час від «Надіслати» до відповіді форми:** 413 мс (перехід на `/quotes/<id>`); n8n форма не чекала (виклик — 83 мс, уже в `after()`).
- **Що показала `/quotes/<id>`:** одразу — «У черзі · Запит прийнято, передаємо його на підготовку»; через ~5 с, після колбека, — «Готово · Кошторис готовий — його можна завантажити нижче · Завантажити PDF».
- **Журнал сервера:**
  ```
[n8n] out event=quote-request attempt=1 status=202 ms=83 correlation=fa863f72-947e-4a7b-9dd3-f683aa474ff1
[n8n] in event=quote-request.completed status=202 bytes=382 correlation=fa863f72-947e-4a7b-9dd3-f683aa474ff1
  ```
  Лише подія, напрям, код, тривалість або байти й `correlation`. Тіл, email, телефонів, токенів і підписів немає (пошук — 0 збігів).

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, першим викликом (`Skill`), + 3 файли `references/` і `check-contract.mjs` |
| `check-contract.mjs` на коді прогону (`--changed-since base`): FAIL (id) | **10 FAIL**: C1, C3, C4, C6, C7, C9, C10, C11, C12, C15 (PASS: C2, C5, C8, C13, C14) | **0 FAIL** (15 PASS) |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook-test/quote-request` → **404** | `/webhook/quote-request` → **202** |
| `auth=` / `idempotency=` у журналі мока | немає (404 до перевірки); з виправленим URL — `auth=missing` → **403**; `idempotency-key` і `x-correlation-id` не надсилаються | `auth=ok` / `idempotency=new`, `x-correlation-id` є |
| Колбек дійшов; код відповіді застосунку | ні (воркфлоу не запустився); підписаний колбек n8n на роут A → **401** | так, `-> 202`; негативні випадки матриці — 10/10 |
| Статус на `/quotes/<id>` | «Помилка» | «У черзі» → «Готово» + PDF |
| Час відповіді форми | 421 мс | 413 мс |
| Тіла чи персональні дані в журналі сервера | ні (але email іде в n8n) | ні (email у n8n не йде) |
| Змінених файлів | 11 (+513/−1) | 14 (+647) |
| Запитання агента | немає (пропозиція rate limit) | 4 — старий `lead-created`, email, доступ до `/quotes`, власник воркфлоу |
| Тривалість сесії | 239 с, 48 ходів | 267 с, 60 ходів |

## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --3way docs/ab/b-with-skill.diff` у корені робочого репозиторію (код гілки = BASE). 14 файлів накотились чисто; порівняння з `../leaddesk-ab-b` (`diff --strip-trailing-cr`) — усі 14 ідентичні. Коміт без жодних правок: `391c55f` «feat(quotes): carry over A/B run B … as-is». Реєстр `docs/n8n-integrations.md`, який створив агент, лишили — його рекомендує записка.
- **Що довелось доробити руками (і чому скіл цього не дав):** коміт `bb4a91d`. Після перенесення `check-contract` на всій гілці — 7 FAIL, **усі у старому коді**, якого запит не стосувався: виклик `lead-created` з публічної форми (`app/actions.ts:57`: `/webhook-test/`, весь рядок з бази з IP і user agent, без токена, ключа й таймауту, синхронно) і рядок `N8N_WEBHOOK_URL=…/webhook-test/lead-created` у `.env.example`. Агент B це помітив і спитав (запитання 1), але сам не чіпав — це поза задачею, і тут діє правило зупинки скіла «невідомо, які поля потрібні в `data`». Доробили: `triggerWorkflow("lead-created", …)` в `after()`; склад `data` (контакт і заявка, без IP, user agent, `rawPayload` і нотаток) узгодили з людиною — саме як вимагає правило зупинки; аудит теж перенесено в `after()`; з `.env.example` прибрано `N8N_WEBHOOK_URL`. У коді прогону B під час фінальної перевірки знайшлась одна вада, успадкована з шаблону скіла: `HANDLERS[event]` для шляхів `/api/n8n/toString`, `/constructor`, `/__proto__` повертав методи `Object.prototype`, і роут відповідав 401 замість 404 «невідома подія» (підпис однаково не проходив, тож дірки не було). Виправлено `Object.hasOwn` (`1d03471`); у шаблоні скіла й матриці колбеків — `d9956f7`.
- **Ще дві доробки після незалежного рев'ю гілки:**
  - `48013b4` — форма `/quotes/new` не мала `aria-invalid`/`aria-describedby` і підсумку помилок у `role="alert"`, а на статус переходила лише через `router.push` у `useEffect`, тож без JavaScript зупинялась на «відкриваємо статус…». Тепер `requestQuote` робить серверний `redirect` на `/quotes/<id>` (без JS — 303), помилки прив'язані до полів. **Межа скіла й протоколу:** агент B не бачив `building-client-form` — за протоколом у копії B був лише n8n-скіл, — тож патерн доступної форми йому не підказував ніхто; n8n-скіл формою не займається. Перевірено: без JS порожня форма → 200 з `role="alert"` і 3 × `aria-invalid`; неправильний email → 1 помилка, компанія лишилась; коректна → 303 на `/quotes/<id>`, колбек → «Готово»; з JS — те саме, 311 мс.
  - `90771b9` — колбек приймається, лише якщо `jobId` збігається зі збереженим із відповіді 202 (якщо його вже знаємо); аудит `lead-created` пишеться і при помилці конфігурації n8n (`try/finally`).
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`, `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`, `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає. У `.env.local` (git-ignored) — ті самі ключі з токеном і секретом, згенерованими `node:crypto.randomBytes`.
- **`npm run lint`, `npm run build` на гілці:** без помилок. Два попередження `no-unused-expressions` у самому `check-contract.mjs` (їх помітив і агент B) виправлено в скілі (`515f48b`) — тепер lint без попереджень.
- **`check-contract.mjs` на фінальному коді** (0 FAIL, код виходу 0):
  ```
check-contract · root: . (ws04 branch) · 15 checks
PASS  C1   No test webhook URL (/webhook-test/) in code or .env.example
PASS  C2   No NEXT_PUBLIC_ prefix on N8N_* variables
PASS  C3   Requests to n8n only from lib/n8n/client.ts
PASS  C4   lib/n8n/client.ts starts with import "server-only"
PASS  C5   Every fetch to n8n has signal: AbortSignal.timeout(...)
PASS  C6   Requests send x-n8n-token, idempotency-key and x-correlation-id
PASS  C7   Request body is the envelope { version, event, data }
PASS  C8   Server Actions do not await n8n: calls to n8n run inside after()
PASS  C9   Callback route reads the raw body and parses JSON only after the signature check
PASS  C10  Callback signature: HMAC-SHA256, length check + timingSafeEqual, no === on signatures
PASS  C11  Callback checks x-n8n-timestamp within a 300 s window
PASS  C12  Callback uses idempotency-key and checks it against jobId from the signed body
PASS  C13  No runtime = "edge"
PASS  C14  No request bodies or personal data in logs of n8n / Server Action code
PASS  C15  .env.example has the contract variables

0 FAIL, 15 PASS
exit=0
  ```
- **Сценарій «форма → колбек → `/quotes/<id>`» уже на гілці** (`npm run build && npm start` + `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`): форма кошторису відповіла за 358 мс, сторінка — «Готово» + «Завантажити PDF»; публічна форма ліда — 231 мс (раніше чекала n8n і аудит).
  ```
[mock-n8n] 2026-09-27T19:04:24.041Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 321 B sha256=0d3101140a68fbf802e7ce0c516436f548b90b4d5d9352e1d950ac2ae9a901a3
[mock-n8n] 2026-09-27T19:04:24.041Z workflow d10396ba-981f-4496-a7f3-38a37180d545 running for 5000 ms, then callback event=quote-request.completed
[mock-n8n] 2026-09-27T19:04:29.170Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 119 ms (try 1/3) event=quote-request.completed body 382 B sha256=9de4fd6da108f4546b194bfac83367ccde73cbc153bd9a54c352b0cdda343171
[mock-n8n] 2026-09-27T19:04:31.917Z POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 310 B sha256=c1bde621cd86238a18f5fa2abdad2eec60f13677602f09d4c8097573b9a69319
  ```
  ```
[n8n] out event=quote-request attempt=1 status=202 ms=86 correlation=40d68228-6074-4901-b6f4-3f3849e5298a
[n8n] in event=quote-request.completed status=202 bytes=382 correlation=40d68228-6074-4901-b6f4-3f3849e5298a
[n8n] out event=lead-created attempt=1 status=202 ms=6 correlation=27a5d196-ccda-476a-8dfd-4d4efc161058
  ```
  Матриця колбеків на гілці — `0 FAIL, 10 PASS`; після `1d03471`/`d9956f7` — `0 FAIL, 11 PASS` (з випадком `toString`, вивід — у `docs/verification.md`, Task C); персональних даних у журналі сервера — 0.
- **Рядок у `docs/n8n-integrations.md`:** `quote-request` створив агент B; рядок `lead-created` після міграції оновлено (`33992d8`: `/webhook/lead-created`, склад `data`).

## Що змінилось у скілі після прогонів

- `bbbf5f1` — **сліпа пляма `check-contract.mjs`, знайдена на коді A.** Перевірки C3–C12 шукали лише `N8N_WEBHOOK_URL|BASE_URL|TOKEN` і роути в `app/api/n8n/`. Агент A назвав змінну `N8N_QUOTE_WEBHOOK_URL` і поклав колбек у `app/api/quotes/[id]/callback` — скрипт їх не побачив і показав 2 FAIL замість 10. Тепер запитом до n8n вважається будь-яка `process.env.N8N_*` (крім секрету колбека), а колбек-роутом — будь-який `route.ts` з `POST`, що використовує `N8N_*SECRET`, `x-n8n-*` чи згадує n8n. Базова лінія й прогін B після цього не змінились (8 і 0 FAIL).
- `515f48b` — прибрано 2 попередження ESLint у `check-contract.mjs` (помітив агент B).
- `d9956f7` — шаблон колбека: `Object.hasOwn(HANDLERS, event)` замість `HANDLERS[event]`; у `send-signed-callback.mjs` — випадок `/api/n8n/toString` → 404 (тепер 11 випадків). Знайдено на фінальній перевірці гілки.
- `5a77b97` — чекліст `SKILL.md` (версія 0.1.1): новий пункт «наявні виклики n8n у проєкті — привести до контракту або явно винести в окрему задачу» і «0 FAIL на всьому проєкті, а не лише `--changed-since`». Причина — прогін B лишив старий `lead-created` як був і лише спитав.

## Висновок

Скіл змінив результат докорінно. Без скіла агент зробив акуратну на вигляд фічу, яка з n8n клієнта **не працює**: тестовий URL, узятий за зразком зі старого `.env.example` (404); немає Header Auth (403 навіть після ручного виправлення URL), ідемпотентності й кореляції; власний Bearer-колбек відхиляє підписаний колбек n8n (401) — `check-contract` 10 FAIL, статус «Помилка». Правильні частини A (`after()`, таймаут) прийшли з документації Next.js у `node_modules`; решти контракту в копії просто нема звідки взяти. Зі скілом агент першим кроком його завантажив, читав `references/` і сам проганяв `check-contract`: 0 FAIL, повний цикл 202 → підписаний колбек → «Готово», матриця колбеків 10/10, персональні дані в n8n не пішли. У коді B доробляти не довелось нічого — лише старий `lead-created` поза задачею, де спрацювало правило зупинки (склад `data` узгодили з людиною). Межа скіла: він не спонукав приводити до контракту наявні виклики поза задачею (агент лише спитав) — у чекліст тепер додано відповідний пункт (`5a77b97`); а сам вимірювальний скрипт після першого ж прогону довелось навчити нестандартних назв.
