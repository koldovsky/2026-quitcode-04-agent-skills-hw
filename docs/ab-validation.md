# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code 2.1.308, headless `claude -p` (новий процес і `session_id` на кожен прогін)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** claude-opus-5-5 · high
- **Код:** BASE = `6c7fcc6` (після Task C: три скіли, виправлення Task A, форма нотатки з Task B; ще без
  `/quotes` і без змін у виклику n8n) · скіл для копії B — з того самого `6c7fcc6`
- **Копії:** `~/.local/share/qc-ws7-tools/ws4-ab/leaddesk-ab-a` (без жодного скіла) і `…/leaddesk-ab-b`
  (лише `integrating-n8n-webhooks`) — окрема батьківська тека, поруч немає робочого репо; у кожній —
  `git init`, коміт `start`, тег `base`, власний `npm ci`
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`,
  `.github/` і `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks`). Перевірено командами з
  walkthrough: `find … -name SKILL.md` → один рядок `…/leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md`;
  `ls -A … | grep -xE 'tools|materials|…'` → «no hints - ok»; `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key"`
  у копії A → «no contract - ok»
- **Особисті скіли:** у `~/.claude/skills/` у мене 10 скілів `n8n-*` (+ `tasks`); `~/.cursor/skills`,
  `~/.agents/skills` — немає, `~/.codex/skills` — порожньо. Щоб вони не потрапили в прогони, сесії
  запускались ізольовано: `--setting-sources project,local` (без особистих налаштувань/скілів/плагінів),
  порожній `--strict-mcp-config`, без `~/.claude/CLAUDE.md`. Окремий `claude -p "/context"` у кожній
  копії **до** прогону: A — Memory `CLAUDE.md` + `AGENTS.md`, **жодного** скіла (0 згадок `n8n-`);
  B — те саме + `integrating-n8n-webhooks | Project | ~310`
- **Запит:** `materials/ab-task.md` без змін (текст між лініями, передано через stdin), нова сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** «Роби, як вважаєш правильним» — обидва агенти зробили
  роботу й наприкінці поставили запитання; обидві сесії продовжено (`--resume`) цією фразою
- **Дозволи, однакові:** `acceptEdits` + Read/Grep/Glob/Skill + `npm`/`npx`/`node`/`git status|diff|log`/
  `ls`/`cd`/`grep`/`cat`/`wc`/`curl`; усе інше в `-p` автоматично відхиляється. Читання поза текою копії
  Claude Code блокує сам — в обох прогонах таких спроб, що пройшли б, немає (A: запис у `/tmp/quote-e2e`
  відхилено; B: перенаправлення в `/tmp` відхилено)
- **Мок, однаковий для обох** (з робочого репо, термінал у теці копії):
  `node --env-file=.env.local <робочий репо>/tools/mock-n8n.mjs --mode respond-202 --delay 5000`,
  без `--callback-url` (обидва застосунки передають `callbackUrl` у тілі). Застосунок — `npm run build`
  і `next start` з копії на `127.0.0.1:3000`. Сценарій — однаковий скрипт Playwright: `/quotes/new` →
  заповнити форму → «Надіслати» (час — від кліку до відповіді POST) → дочекатися колбека → `/quotes/<id>`
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код `base`, без `--changed-since`):
  **3 PASS, 6 FAIL (C1, C3, C5, C6, C7, C11), 5 N/A** — старий виклик `lead-created` в `app/actions.ts:54`
  і `.env.example:6`; в оцінку прогонів не йде

## A — без скіла

- Які скіли бачив агент: жодного проєктного й жодного особистого (див. вище).
- Що зробив агент: прочитав `package.json`, `.env.example`, `proxy.ts`, `lib/*`, `app/actions.ts`,
  форму ліда, потім документацію Next.js у `node_modules/next/dist/docs/` (`server-actions.md`,
  route handlers, `redirect`, `useRouter().refresh`). Написав: нові змінні `N8N_QUOTE_WEBHOOK_URL`,
  `APP_URL`, `N8N_QUOTE_CALLBACK_SECRET`; Server Action, що **синхронно** чекає, поки n8n прийме задачу
  (`fetch` з `AbortSignal.timeout(10_000)`, без заголовків контракту, тіло — плоский об'єкт з **email**),
  і тільки потім робить `redirect`; колбек `POST /api/quotes/callback` з **Bearer-токеном** (порівняння
  `timingSafeEqual` по sha256 обох значень), `request.json()`, без підпису тіла, вікна часу й
  `idempotency-key` — повтор відсікається станом (409); сторінку `/quotes/[id]` з клієнтським
  поллером раз на 3 с; випадкові UUID; перевірку `http(s)` для посилання на PDF.
- Звідки агент узяв домовленості: **загальні знання + наявний код + документація Next.js у `node_modules`**.
  З наявного коду — шаблон «повний URL вебхука в змінній `N8N_*_URL`» і тестовий шлях: у `.env.example`
  агент дописав `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/quote-request` (за зразком рядка
  `lead-created`). Режим відповіді n8n вгадав як «Respond: Immediately» і попросив клієнта так налаштувати.
- Запитання агента і фінальна відповідь (скорочено): «I've added the quote request feature. Lint and
  `npm run build` pass. I haven't tested it end to end … **Check the n8n contract.** I couldn't see the
  `quote-request` workflow, so the data format is my guess … The workflow's Webhook node must be set to
  "Respond: Immediately" … If you want, I can run the local test now.» Після «Роби, як вважаєш
  правильним»: спробував локальний тест (свій мок у теці копії + `next start` на :3100) — запуск сервера
  потребував дозволу, якого в `-p` немає; прибрав тимчасову теку й відповів: «Наскрізну перевірку провести
  не вдалося … Цей шлях важливіший: формат даних між сайтом і воркфлоу я лише припустив».
- Змінені файли (`git diff --cached --stat base`): 11 файлів, +506/−1 — `.env.example`,
  `app/api/quotes/callback/route.ts`, `app/quotes/{actions.ts,new/page.tsx,[id]/page.tsx}`,
  `components/{quote-form,quote-status-poller}.tsx`, `lib/{data,db,quote-form,types}.ts`;
  діф: `docs/ab/a-without-skill.diff`
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL`, `APP_URL`, `N8N_QUOTE_CALLBACK_SECRET`.
  У `.env.local` копії — вони зі значеннями для мока (`/webhook/quote-request`, `http://127.0.0.1:3000`,
  згенерований секрет) + змінні мока `N8N_WEBHOOK_TOKEN` (згенерований) і `N8N_CALLBACK_SECRET` (=
  `N8N_QUOTE_CALLBACK_SECRET`).
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base` — лише код прогону:
  ```
  C1   FAIL  no-test-url           - .env.example:10 test URL /webhook-test/
  C2   PASS  no-public-n8n-env
  C3   FAIL  single-client         - app/quotes/actions.ts:20 reads N8N_QUOTE_WEBHOOK_URL (n8n URL/token) outside lib/n8n/
  C4   N/A   server-only
  C5   PASS  fetch-timeout
  C6   FAIL  contract-headers      - app/quotes/actions.ts:26 n8n request without x-n8n-token, idempotency-key, x-correlation-id
  C7   FAIL  non-blocking-action   - app/quotes/actions.ts:20 Server Action starts an n8n workflow without after() — the user waits for n8n
  C8   FAIL  callback-raw-body     - app/api/quotes/callback/route.ts:54 request.json() — read the raw body with request.text()
                                   - app/api/quotes/callback/route.ts:1 the raw body is never read with request.text()
  C9   PASS  timing-safe-compare
  C10  PASS  no-edge-runtime
  C11  FAIL  env-example           - .env.example missing N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
  C12  PASS  no-sensitive-logs
  C13  FAIL  callback-replay       - app/api/quotes/callback/route.ts:1 x-n8n-timestamp is never read
  C14  FAIL  callback-idempotent   - app/api/quotes/callback/route.ts:1 idempotency-key header is never read
  TOTAL: 5 PASS, 8 FAIL, 1 N/A   exit=1
  ```
  Перша версія скрипта (з BASE) на цьому ж коді дала **3 PASS, 2 FAIL, 9 N/A**: код n8n вона впізнавала
  лише за назвами з контракту (`N8N_WEBHOOK_*`, `app/api/n8n/`), тож виклик через `N8N_QUOTE_WEBHOOK_URL`
  і колбек `/api/quotes/callback` «зникли» в N/A. Це сліпа пляма самого скіла — виправлено окремим
  комітом `8adab99` (див. «Що скіл змінив у собі»), вивід вище — виправленою версією.
- Журнал мока:
  ```
  header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  POST /webhook/quote-request -> 403 in 0 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 348 B sha256=7badfc47…
  ```
  колбека немає.
- Час від «Надіслати» до відповіді форми: **269 мс** — але лише тому, що мок одразу відповів 403. Дія
  чекає n8n синхронно (до 10 с на спробу); з реальним воркфлоу в режимі, відмінному від «Immediately»,
  форма висіла б до таймауту.
- Що показала `/quotes/<id>`: сторінку не відкрито — форма лишилась на `/quotes/new` з повідомленням «Не
  вдалося запустити підготовку кошторису. Спробуйте ще раз за хвилину.»
- Журнал сервера: `Failed to start quote workflow for quote_efeae7c5-… Error: n8n responded with 403` +
  стек; тіл, email, токенів і підписів немає.
- **Додатково (поза протоколом), щоб побачити колбек:** той самий застосунок A, мок **без** Header Auth.
  Форма → 202 (`auth=none idempotency=absent`), редирект на `/quotes/<id>`; через 5 с
  `callback POST http://127.0.0.1:3000/api/quotes/callback -> 401` — n8n підписує тіло HMAC, а роут чекає
  `Authorization: Bearer`; сторінка назавжди лишилась «Готуємо кошторис… Зазвичай це займає від 40 до 90
  секунд».

## B — зі скілом

- Які скіли бачив агент: лише `integrating-n8n-webhooks` (Project).
- **Чи викликав агент скіл: так, першим же кроком** — інструмент `Skill: integrating-n8n-webhooks`; далі
  `Read references/contract.md`, `Read references/code-templates.md`, `cat references/response-modes.md`,
  `check-contract.mjs --help`, `mock-n8n.mjs --help`; звірив `after.md` і `server-only` з документацією
  Next.js у `node_modules`.
- Що зробив агент: `lib/n8n/client.ts` (`import "server-only"`, конверт, три заголовки контракту,
  таймаут 10 с, ≤ 2 повтори на мережу/5xx), `lib/n8n/callback.ts` (HMAC, 300 с, `timingSafeEqual`),
  `lib/quotes.ts` (сховище з `idempotencyKey` і `correlationId` на запис), `lib/quote-form.ts`,
  `app/quotes/actions.ts` (запис `queued` → `redirect`, виклик n8n в `after()`, у `data` — **без email**),
  `app/quotes/new/page.tsx`, `app/quotes/[id]/page.tsx` (`<meta refresh>` 5 с — працює без JS),
  `app/api/n8n/[event]/route.ts` (404/415 → `text()` → 413 → вікно → підпис → ідемпотентність → 400 →
  стан → 202), `components/quote-form.tsx`, `docs/n8n-integrations.md`, 4 ключі в `.env.example` з
  `change-me-…`. Перевірив сам: lint/build, `check-contract --changed-since HEAD`, свій прогін з моком
  скіла й тимчасовими секретами, `send-signed-callback.mjs` 9/9, «n8n вимкнено» → `failed` після 3 спроб.
- Запитання агента і фінальна відповідь (скорочено): «Сторінки `/quotes/new` і `/quotes/[id]` та ендпоінт
  для n8n готові й перевірені локально з офлайн-моком n8n … **Потрібне ваше рішення:** 1. Email не
  передається в n8n … 2. Стара інтеграція `lead-created` порушує правила для n8n … Виправити окремою
  задачею? … Закомітити зміни?» Після «Роби, як вважаєш правильним»: email лишив поза n8n («мінімум
  даних»), `lead-created` не чіпав («зміна тіла зламає опублікований воркфлоу клієнта»), а записав у реєстр
  з ⚠️ і переліком порушень; коміт не вдався — `git checkout`/`add` не дозволені.
- Змінені файли (`git diff --cached --stat base`): 11 файлів, +610 — `.env.example`,
  `app/api/n8n/[event]/route.ts`, `app/quotes/{actions.ts,new/page.tsx,[id]/page.tsx}`,
  `components/quote-form.tsx`, `docs/n8n-integrations.md`, `lib/n8n/{client,callback}.ts`,
  `lib/{quote-form,quotes}.ts`; діф: `docs/ab/b-with-skill.diff`
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`,
  `APP_BASE_URL` — ті самі назви, що читає мок, тож `.env.local` = ці чотири зі значеннями для мока.
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base`:
  ```
  C1–C14 PASS
  TOTAL: 14 PASS, 0 FAIL, 0 N/A   exit=0
  ```
  (Перша версія скрипта давала 13 PASS + `C11 FAIL .env.example:6 N8N_WEBHOOK_URL…` — на рядку зі
  старого коду, якого агент не змінював; та сама правка `8adab99` прибрала цей хибний FAIL.)
- Журнал мока:
  ```
  header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: …,content-type,idempotency-key,…,x-correlation-id,x-n8n-token | body 356 B sha256=f7e5d7a2…
  workflow 8dd2aa15-… running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 28 ms (try 1/3) event=quote-request.completed body 382 B sha256=380fc0d5…
  ```
- Час від «Надіслати» до відповіді форми: **70 мс** (POST), 585 мс — до завантаженої сторінки статусу
  після `redirect`.
- Що показала `/quotes/<id>`: «Кошторис для Nova Dental … **Готово.** Кошторис готовий. Відкрити
  PDF-кошторис» — посилання `https://files.example.test/n8n/8dd2aa15-….pdf`.
- Журнал сервера: лише
  `n8n out event=quote-request correlation=819518ef-… attempt=1 status=202 ms=4` і
  `n8n in event=quote-request correlation=819518ef-… accepted bytes=382 sha256=380fc0d59ec0` — без тіл,
  email, токенів і підписів.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, першим кроком (`Skill`, потім `references/`, `scripts/ --help`) |
| `check-contract.mjs --changed-since base`: FAIL (id) | **8 FAIL**: C1, C3, C6, C7, C8, C11, C13, C14 | **0 FAIL** (14 PASS) |
| URL вебхука | `/webhook-test/quote-request` у `.env.example` | `/webhook` + `/<event>` |
| `auth=` / `idempotency=` у журналі мока | `auth=missing` → 403 (у додатковому прогоні без Header Auth — `idempotency=absent`) | `auth=ok`, `idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні (403 на запуску); без Header Auth — колбек → **401** (Bearer ≠ HMAC) | так, **202**; матриця підробок 9/9 |
| Час відповіді форми | 269 мс до помилки; дія чекає n8n синхронно (до 10 с) | 70 мс; n8n — в `after()` |
| Тіла чи персональні дані в журналі сервера | ні (стек помилки 403) | ні (лише подія, correlation id, статус, sha256) |
| Персональні дані в n8n | email клієнта в тілі | email не передається |
| Змінених файлів | 11 (+506/−1) | 11 (+610) |
| Запитання агента | наприкінці: формат даних n8n, режим вебхука, локальний тест | наприкінці: email у `data`, стара `lead-created`, коміт |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` у корені робочого репо на гілці
  `ws04/maryan-qc` (поверх BASE + коміт скіла `8adab99`) — застосувалось без конфліктів; коміт
  **`c442121`** «carried over from A/B run B». `.env.local` і `node_modules/` з копії не переносились;
  `package.json` агент не змінював.
- Що довелось доробити руками (коміт **`dde28ce`**) і чому скіл цього не дав:
  - стара інтеграція `lead-created`: прямий `fetch(process.env.N8N_WEBHOOK_URL!)` з усім лідом (IP, user
    agent, `rawPayload`), без токена, таймауту й повторів, з очікуванням у формі. Переведено на
    `triggerWorkflow({ event: "lead-created", … })` з `lib/n8n/client.ts` в `after()` (там само аудит),
    `data` — дані заявки без IP/UA/`rawPayload`, `idempotency-key` — один на заявку. Скіл цього не зробив
    свідомо: його правила зупинки кажуть питати, коли невідомо, які поля потрібні воркфлоу, а зміна тіла
    ламає опублікований воркфлоу клієнта — агент B правильно зупинився й записав це в реєстр. Рішення
    ухвалив я; у реєстрі позначено, що конверт треба узгодити з клієнтом перед деплоєм;
  - `.env.example`: прибрано рядок `N8N_WEBHOOK_URL=…/webhook-test/lead-created` і його коментар;
  - `docs/n8n-integrations.md`: рядок `lead-created` тепер `/webhook/lead-created`, Immediately, з описом
    `data`; власник — я.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає. У `.env.local` — ті самі ключі зі
  згенерованими секретами (`git check-ignore` → ігнорується).
- `npm run lint`, `npm run build` на гілці: без помилок (маршрути `/quotes/new`, `/quotes/[id]`,
  `/api/n8n/[event]` у збірці).
- `check-contract.mjs` на фінальному коді (увесь проєкт, **без** `--changed-since`):
  ```
  check-contract — . (40 file(s))
  C1–C14 PASS
  TOTAL: 14 PASS, 0 FAIL, 0 N/A
  exit=0
  ```
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці: POST `/quotes/new` → 200 за **82 мс** →
  мок `POST /webhook/quote-request -> 202 auth=ok idempotency=new` → через 5 с
  `callback POST …/api/n8n/quote-request -> 202` → сторінка «Готово. Кошторис готовий. Відкрити
  PDF-кошторис». Форма ліда на `/`: POST за **165 мс**, «Дякуємо!», мок
  `POST /webhook/lead-created -> 202 auth=ok idempotency=new`. Журнал сервера — лише рядки
  `n8n out/in event=… correlation=… status=…`.
- Матриця колбеків на гілці (`send-signed-callback.mjs` з `--request-key` справжнього запиту):
  `unknown-event 404`, `wrong-type 415`, `too-large 413`, `bad-signature 401`, `stale 401`,
  `reformatted 401`, `key-mismatch 400`, `valid 202`, `duplicate 200` — **9/9 PASS**; у журналі сервера
  `rejected=invalid|stale|shape`, `accepted`, `duplicate` — без тіл.
- Реєстр: `docs/n8n-integrations.md` — рядки `quote-request` і `lead-created`.

## Що скіл змінив у собі після прогонів

- `8adab99` — `check-contract.mjs` упізнає код n8n за **будь-якою** змінною `N8N_*` (адреса/токен — лише в
  `lib/n8n/`, секрет колбека — у колбек-коді) і колбек за роутом, що читає секрет; C9 дивиться на
  операнди порівняння (без хибного спрацювання на `token !== ""`); C11 з `--changed-since` не рахує
  незмінений старий рядок. Причина — прогін A: перша версія видавала N/A на код, написаний без контракту,
  тобто мовчала саме там, де мала знайти порушення. Після правки — повторна перевірка на `main` (6 FAIL),
  поганому роуті (7 FAIL) і шаблонах скіла (0 FAIL): результати ті самі.

## Висновок

Скіл змінив результат докорінно. Без нього агент написав охайну на вигляд фічу з правильними загальними
інстинктами (таймаут, `timingSafeEqual`, адреса колбека з конфігурації, випадкові id), але **несумісну з
тим, як налаштований n8n клієнта**: без `x-n8n-token` запит отримав 403, форма чекає n8n синхронно, а
колбек з Bearer-токеном відкидає підписаний HMAC колбек — у сценарії фіча не спрацювала жодного разу.
Домовленості він узяв із загальних знань, наявного коду (звідти ж — `/webhook-test/`) і документації
Next.js. Зі скілом агент першим кроком завантажив його, пройшов `check-contract` на 14/14 і з першого разу
пройшов повний сценарій з моком. Межа скіла — стара інтеграція `lead-created`: тут він, як і задумано
правилами зупинки, спитав людину, а доробив її я. Після прогонів я змінив у скілі перевірку: вона мусить
бачити й код, написаний «не за контрактом», — інакше саме прогін без скіла виглядав би кращим, ніж є.
Обмеження: по одному прогону на плече.
