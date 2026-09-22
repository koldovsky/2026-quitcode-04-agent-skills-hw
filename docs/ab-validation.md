# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Еталон автора, формат — `docs/templates/ab-validation.md`. Прогони виконано 21.09.2026 **за вашим
> протоколом** (`docs/walkthrough.md`, Task D): у копіях немає ні `tools/` з моком, ні `materials/`,
> ні `docs/`, у копії A — жодного скіла, у копії B — лише `integrating-n8n-webhooks`.
>
> **Що тут є.** Замість одного прогону на гілку автор зробив **по три**: A — копія без скіла, B —
> копія зі скілом, запит однаковий (`materials/ab-task.md`, sha256 тексту між лініями —
> `498a125e…c39c`), нова сесія на кожен прогін. Діфи в `docs/ab/` — по одному завершеному прогону на
> гілку: A1 і B1. Що в протоколі автора все ж інакше, ніж у вас, — розділ «Чим це відрізняється від
> вашого протоколу». Читайте його до таблиці порівняння.
>
> **Результат одним рядком:** `check-contract.mjs --changed-since base` — **5 з 10 PASS у кожному
> прогоні A і 10 з 10 у кожному прогоні B**. Скіл перевернув C3, C4, C5, C9 і C10 — саме ті
> перевірки, що кодують рішення команди, а не загальну практику.
>
> **Фіча на `ws04/sample` — це не запис прогону B.** Вона теж побудована «зі скілом» (автор писав
> її з `integrating-n8n-webhooks`, і скіл під час роботи виправив сам себе — коміт `f3ba25d`), але
> поза протоколом A/B. Докази по фічі (мок, час відповіді форми, журнал сервера, `check-contract`
> — 0 FAIL) — у `docs/verification.md`.

- **Інструмент і версія:** Claude Code 2.1.278, неінтерактивно, однаково в обох гілках:
  `claude -p --output-format json --permission-mode acceptEdits --allowedTools …`, запит — у stdin
  (UTF-8), обмеження автора — 25 хвилин на прогін (далі процес зупиняється).
- **Модель і рівень міркування (effort), однакові в обох гілках:** основна модель —
  `claude-sonnet-5`, effort `xhigh` (обидва — з `~/.claude/settings.json`; прапорців `--model` і
  `--effort` не передавали). **Плюс радник:** налаштування автора додають інструмент advisor на
  `claude-opus-5`. Він працював в обох гілках (у B1 і B2 — по 2 виклики, у B3 — 1) і входить у
  ціну: $1,23–1,37 за прогін у A, $1,90–1,97 у B1 і B2. Без такого налаштування і поведінка агента,
  і ціна у вас будуть іншими.
- **Дозволені інструменти:** `Read,Edit,Write,Grep,Glob,Skill,Bash(npm run build:*),Bash(npm run lint:*),Bash(node:*)`.
  Це **дозвіл, а не пісочниця**. Складені команди (`cd … && …`), змінні перед командою, `npm start`
  і PowerShell агент запустити не міг, тож «глибина» перевірки в прогонах різна — див. кожен прогін.
- **Код:** BASE = `main` на `e3451d2` (експорт гілки: у A — клон, у B — `git archive`; дерево те
  саме) · скіл `integrating-n8n-webhooks` для копії B — з `ws04/sample` на `8b0c92b`.
- **Копії:** окремий каталог на кожен прогін, у кожному — коміт `start` з тегом `base` і
  `npm install` (`package-lock.json` не змінився). `base` у копіях: A1 `a065189`, A2 `638b279`,
  A3 `e8d671f`, B1 `624c12e`, B2 `8f67c5b`, B3 `195bbb6`.
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`,
  `.github/` і вся тека `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks`). Перевірено
  перед кожним прогоном: `find … -name SKILL.md` — у A нічого, у B рівно один файл скіла;
  `ls -A` — «no hints - ok»; `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key"` — у A
  «no contract - ok», у B — лише файли самого скіла.
- **Особисті копії скіла:** перевірено — немає. `~/.claude/skills`: `course-prep`, `find-skills`,
  `synced/` (docs, docx, import-memory, morning, pdf, pptx, skill-creator, xlsx); `~/.agents/skills`:
  `find-skills`; `~/.codex/skills`: `.system/*`, `web-design-reviewer`; `~/.cursor/skills` не
  існує. Пошук `n8n` і назв контракту в цих теках — нічого.
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін.
- **Відповідь на уточнення:** у режимі `-p` агент питань не ставить — усі шість прогонів зробили
  припущення й описали їх у фінальній відповіді.
- **Мок:** сценарій «форма → колбек → `/quotes/<id>`», який у вашому протоколі запускаєте ви,
  автор для цих прогонів **окремо не знімав**. Живий сценарій є лише там, де агент зробив його сам
  (B1, мок зі скіла — це частина скіла, а не витік). Усе, що про мок і журнали сказано нижче, — з
  журналу сесії агента.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`) —
  однакова в усіх шести: 5 FAIL (C1, C3, C6, C9, C10), 3 PASS (C2, C7, C8), 2 N/A (C4, C5 —
  колбек-роуту ще немає), код виходу 1. Це старий потік `lead-created`, в оцінку прогонів він не
  йде:

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root <копія>
  scanned 26 source files; n8n callers: app/actions.ts; callback routes: none
  C1  FAIL  .env.example:6  N8N_WEBHOOK_URL points at a /webhook-test/ URL
  C3  FAIL  app/actions.ts:54  fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)
  C4  N/A   (no callback route found)      C5  N/A  (no callback route found)
  C6  FAIL  app/actions.ts:54  fetch without signal: add AbortSignal.timeout(10_000)
  C9  FAIL  .env.example  keys N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL are missing
  C10 FAIL  app/actions.ts:54  no idempotency-key header; no x-n8n-token header
  5 failed, 3 passed, 2 n/a (10 checks)
  ```

## Чим це відрізняється від вашого протоколу

1. **По три прогони на гілку, а не по одному** — щоб побачити розкид, а не один випадок.
2. **BASE — `main`, а не ваш коміт після Task C.** У вашому BASE ще є виправлення Task A; скілів у
   копіях немає ні тут, ні у вас (крім скіла в B).
3. **Неінтерактивний режим** `claude -p`: уточнень агент не ставив, відповіді «роби, як вважаєш
   правильним» не було.
4. **Сценарій із моком знімав не автор, а (де зміг) сам агент.** Дозволи стенду не пускали
   `npm start`, тож лише B1 підняв застосунок (через `node node_modules/next/dist/bin/next start`)
   і мок зі скіла. У вас мок і застосунок запускаєте ви — для **обох** копій.
5. **Обидві гілки йшли паралельно** на одній машині й одному акаунті, тож тривалість і ціна містять
   конкуренцію за процесор і API. Порт 3000 був зайнятий стороннім процесом, тому B1 працював на 3100.
6. **Прогін B3 зупинено за обмеженням 25 хвилин** (SIGKILL), коли агент переглядав власний діф.
   Код на диску повний і перевірений (нижче), але CLI не встиг надрукувати підсумок, тож **ціну
   B3 не наводимо** (оцінка з журналу сесії — не вимір).
7. **Три прогони записали файли поза своєю копією** — у вашому протоколі агент працює лише в теці
   копії. A1 — власний мок у батьківську теку (оператор переніс його до початку A2); A3 — мок і
   сценарій у `%TEMP%/quote-e2e/`; B3 — свій тестовий стенд у теку поза копією (перенесено після
   прогону). Запустити жоден із цих файлів A1 і A3 не змогли. Читань чужих файлів поза копією в
   журналах сесій немає — лише власні (журнали фонових задач, стенд B3).

## A — без скіла

- **Які скіли бачив агент** (окремий запуск `/context` у кожній копії): жодного проєктного. Лише
  особисті (`course-prep`, `find-skills`), плагіни й вбудовані — ті самі, що в копії B.
- **Що зробив агент — своїми словами:** у всіх трьох — повна фіча: `/quotes/new` з формою
  (компанія, email, опис, бюджет), Server Action, роут колбека, `/quotes/[id]` зі статусом, який
  оновлюється кожні 3 с. Воркфлоу на 40–90 с ніхто не чекав синхронно: A1 і A3 чекають лише
  підтвердження прийому (до 10 с, потім `redirect`), A2 викликає n8n в `after()`.
- **Звідки агент узяв домовленості** (з журналу сесії): інструмент `Skill` — 0 викликів,
  `SKILL.md` ніхто не читав (A1 ще й перевірив `ls .claude/skills` — порожньо). Кожну деталь, схожу
  на контракт, агент **уперше написав сам**, без жодного попереднього результату інструмента, де
  вона була б, — тобто із загальних знань. Документацію Next.js у `node_modules/next/dist/docs/`
  читали всі три, але лише заради API (`after`, форми, route handlers). A3 випадково влучив в одне
  ім'я контракту — `N8N_CALLBACK_SECRET`.
- **Запитання агента і фінальна відповідь** (скорочено): питань немає; у фіналі — припущення, які
  треба звірити. A2: «Воркфлоу `quote-request` я не бачив (n8n-інструментів у сесії немає), тому
  контракт вигадав сам.» A3: «Воркфлоу я не бачив, тому формат вигадав сам. Його треба звірити з
  реальним `quote-request`.» A1: «…написані, але наскрізно не запускались».
- **Змінені файли** (`git diff --cached --stat base`): A1 — 15 файлів, +575/−2; A2 — 11 файлів,
  +523/−2; A3 — 15 файлів, +559/−1. Діф прогону A1 — `docs/ab/a-without-skill.diff`.
- **Змінні середовища, які додав агент:** A1, A2 — `N8N_QUOTE_WEBHOOK_URL`, `APP_BASE_URL`,
  `N8N_QUOTE_CALLBACK_SECRET`; A3 — `N8N_QUOTE_WEBHOOK_URL`, `APP_URL`, `N8N_CALLBACK_SECRET`. З
  ключами контракту збіглось по одному (`APP_BASE_URL` у A1 і A2, `N8N_CALLBACK_SECRET` у A3); ключа
  `N8N_WEBHOOK_TOKEN` немає ні в кого — вихідний виклик без автентифікації. Секрети в `.env.example`
  — порожні. URL — продакшн `…/webhook/quote-request` з коментарем, чому не
  `/webhook-test/`, у всіх трьох.
- **`check-contract.mjs --root <копія> --changed-since base`** — однаково в усіх трьох:
  `5 failed, 5 passed, 0 n/a` (C1, C2, C6, C7, C8 PASS; C3, C4, C5, C9, C10 FAIL). Вивід A1:

  ```
  scope: changed since base (a065189) - 15 checked file(s): app/api/quotes/[id]/callback/route.ts, app/quotes/actions.ts, …, lib/quote-workflow.ts, lib/types.ts, …, .env.example
  scanned 36 source files; n8n callers: app/actions.ts, lib/quote-workflow.ts; callback routes: app/api/quotes/[id]/callback/route.ts

  C1  PASS no /webhook-test/ URL in code or .env.example
  C2  PASS no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
  C3  FAIL n8n is called only from lib/n8n/*, which starts with import 'server-only'
        lib/quote-workflow.ts:44  fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)
  C4  FAIL callback route reads the raw body; parses only after the signature check
        app/api/quotes/[id]/callback/route.ts:45  request.json() parses/re-serialises the body: read it once with .text() or .arrayBuffer()
  C5  FAIL signature: length check + timingSafeEqual, never === / !==
        app/api/quotes/[id]/callback/route.ts  no length check before timingSafeEqual (it throws on different lengths)
  C6  PASS every fetch to n8n has signal: AbortSignal.timeout(...)
  C7  PASS no bodies, payloads or headers in console.* in n8n code
  C8  PASS no runtime = 'edge'
  C9  FAIL .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
        .env.example  key N8N_WEBHOOK_BASE_URL is missing
        .env.example  key N8N_WEBHOOK_TOKEN is missing
        .env.example  key N8N_CALLBACK_SECRET is missing
  C10 FAIL every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL
        lib/quote-workflow.ts:44  no idempotency-key header (UUID created once per operation, reused on retries)
        lib/quote-workflow.ts:44  no x-n8n-token header (n8n Header Auth; a missing or wrong token is a 403)

  5 failed, 5 passed, 0 n/a (10 checks)
  ```

  A2 — ті самі id (`app/quotes/actions.ts:41`, роут — `route.ts:59`), A3 — ті самі id
  (`lib/n8n.ts:29` — **файл**, а не тека `lib/n8n/`, і без `server-only`; роут
  `app/api/quotes/callback/route.ts:32`; у C9 бракує `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`,
  `APP_BASE_URL`).

  **Як це читати.** Усі три A незалежно зробили той самий **власний протокол**, а не неохайну
  версію нашого: колбек захищено статичним `Authorization: Bearer <секрет>` (sha256 обох боків +
  `timingSafeEqual`), HMAC над тілом немає, `x-n8n-timestamp` і вікна часу немає, тіло читається
  через `request.json()`; ідемпотентність — лише за станом запису (готовий кошторис не
  перезаписується), ключа ідемпотентності немає в жодному напрямку; вихідний виклик до n8n — без
  `x-n8n-token`. Причина C5 у виводі («немає перевірки довжини») тут формальна: обидва дайджести
  по 32 байти, тож `timingSafeEqual` не кине. Справжня причина C4 і C5 — підпису над тілом немає
  зовсім.

  **Увесь проєкт** — `7 failed, 3 passed` у кожному прогоні (базова лінія — 5 FAIL): додались C4 і
  C5 на новому роуті, старі FAIL лишились.
- **Що агент без скіла зробив правильно сам (3 з 3):** продакшн-URL `/webhook/`, таймаут 10 с на
  новому виклику (C6 PASS), жодного синхронного очікування 40–90 с, жодних `NEXT_PUBLIC_` і
  секретів у query, `callbackUrl` — з конфігурації (`APP_BASE_URL` / `APP_URL`), а не із заголовка
  `Host`; у журналах — без тіл і персональних даних; без `runtime = 'edge'`.
- **`npm run lint` / `npm run build`** (перевірка стенду після прогону): A1 і A3 — обидва зелені;
  A2 — build зелений, **lint FAIL** (`react-hooks/purity`: `Date.now()` під час рендера,
  `app/quotes/[id]/page.tsx:27`). A2 сам lint не запускав — усі його спроби впирались у дозволи — і
  чесно написав, що не перевіряв.
- **Журнал мока:** не знімався в жодному прогоні A. A1 і A3 написали власні моки (поза копією, див.
  відхилення 7), але запуск і їх, і `next start` не було дозволено; A2 наскрізного прогону не
  пробував. **За кодом** мок із Header Auth відповів би 403 (заголовка `x-n8n-token` немає), а
  підписаний колбек за контрактом роут A відхилив би (чекає `Authorization: Bearer`) — це висновок
  з коду, не замір.
- **Час від «Надіслати» до відповіді форми:** не міряли. За кодом: A1 і A3 чекають підтвердження
  n8n до 10 с, A2 — не чекає (`after()`).
- **Що показала `/quotes/<id>`:** не перевірялось наживо.
- **Журнал сервера:** не знімали. За кодом — лише рядок причини від n8n (до 300 символів у A1, до
  500 у A2) і об'єкт помилки `fetch`; тіл, email, токенів і підписів у `console.*` немає.

## B — зі скілом

- **Які скіли бачив агент** (окремий запуск `/context` у кожній копії): `integrating-n8n-webhooks`
  (Project) — єдиний проєктний; решта — ті самі особисті, плагіни й вбудовані, що в A.
- **Чи викликав агент скіл: так, 3 з 3, першим же викликом інструмента** —
  `Skill(integrating-n8n-webhooks)`; запит скіл не називає. Далі — `references/` (`nextjs-patterns`,
  `contract`, `response-modes`, `security-checklist`, `n8n-side-setup`, виклики №4–8) і `scripts/`.
  Усі маркери контракту (`x-n8n-token`, `x-n8n-signature`, `x-n8n-timestamp`, `idempotency-key`,
  `x-correlation-id`, чотири ключі, `timingSafeEqual`, `AbortSignal.timeout`, `server-only`) уперше
  з'являються в результаті виклику №4 — читання `references/nextjs-patterns.md`.
- **Що зробив агент — своїми словами:** та сама фіча, але за розкладкою скіла, однаково в усіх
  трьох: `lib/n8n/{client,envelope,signature}.ts` (кожен починається з `import "server-only"`),
  `app/api/n8n/[event]/route.ts`, `app/quotes/**`, `components/quote-form.tsx`, рядок у
  `docs/n8n-integrations.md`. Server Action зберігає запит зі статусом `queued`, викликає n8n в
  `after()` і перенаправляє на `/quotes/<id>`; n8n має відповісти 202 з `job_id`, результат
  приходить підписаним колбеком. Колбек: подія (404) → медіатип (415) → ліміт тіла 64 КБ (413) →
  вікно ±300 с → HMAC над `${ts}.${raw}` з перевіркою довжини й `timingSafeEqual` (401) → ключ
  ідемпотентності, звірений з `<jobId>:quote-request.completed` із **підписаного** тіла → лише тоді
  `JSON.parse`. Вихідний виклик: `x-n8n-token`, `idempotency-key` (UUID запиту, той самий у
  повторах), `x-correlation-id`, `AbortSignal.timeout(10_000)`, до двох повторів лише на 5xx і
  помилки мережі.
- **Запитання агента і фінальна відповідь** (скорочено): питань під час роботи немає. B1: «…працюють,
  але лише проти офлайн-мока n8n. Проти справжнього воркфлоу `quote-request` я не запускав» — і
  питання, чи переводити старий `lead-created` на новий клієнт окремою задачею. B2: «наскрізного
  прогону з моком n8n я не робив… задачу не можна вважати завершеною, поки їх не прогнати» — з
  командами для ручного прогону й п'ятьма питаннями (старий потік, воркфлоу клієнта, публічна форма
  без rate limit, власник у реєстрі, сховище в пам'яті). B3 фінальної відповіді не дав (обрив).
- **Змінені файли** (`git diff --cached --stat base`): B1 — 17 файлів, +837/−2; B2 — 16 файлів,
  +837/−1; B3 — 16 файлів, +915. Діф прогону B1 — `docs/ab/b-with-skill.diff`.
- **Змінні середовища, які додав агент:** `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`,
  `N8N_CALLBACK_SECRET`, `APP_BASE_URL` — імена з контракту, у всіх трьох; секрети —
  `change-me-…`, адреси — локальні. Старий рядок `N8N_WEBHOOK_URL=…/webhook-test/…` не чіпав
  жоден (запит про нього не просив).
- **`check-contract.mjs --root <копія> --changed-since base`** — однаково в усіх трьох:
  `0 failed, 10 passed, 0 n/a`, код виходу 0. Вивід B1:

  ```
  scope: changed since base (624c12e) - 16 checked file(s): app/api/n8n/[event]/route.ts, app/quotes/actions.ts, …, lib/n8n/client.ts, lib/n8n/envelope.ts, lib/n8n/signature.ts, …, .env.example
  scanned 38 source files; n8n callers: app/actions.ts, lib/n8n/client.ts; callback routes: app/api/n8n/[event]/route.ts

  C1  PASS no /webhook-test/ URL in code or .env.example
  C2  PASS no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
  C3  PASS n8n is called only from lib/n8n/*, which starts with import 'server-only'
  C4  PASS callback route reads the raw body; parses only after the signature check
  C5  PASS signature: length check + timingSafeEqual, never === / !==
  C6  PASS every fetch to n8n has signal: AbortSignal.timeout(...)
  C7  PASS no bodies, payloads or headers in console.* in n8n code
  C8  PASS no runtime = 'edge'
  C9  PASS .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
  C10 PASS every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL

  0 failed, 10 passed, 0 n/a (10 checks)
  ```

  **Увесь проєкт** — `4 failed, 6 passed, 0 n/a` у кожному прогоні: C1 (`.env.example:6`), C3, C6,
  C10 (`app/actions.ts:54`) — лише старий потік `lead-created`; C9 перейшла з FAIL у PASS, C4 і C5 —
  з N/A у PASS. Усі три прогони B **самі запускали** `check-contract.mjs` зі скіла під час роботи.
- **`npm run lint` / `npm run build`** (перевірка стенду після прогону): зелені в усіх трьох.
- **Журнал мока** — лише B1: застосунок на :3100, мок зі скіла (`scripts/mock-n8n.mjs --mode
  respond-202 --delay 5000 --callback-url http://127.0.0.1:3100/api/n8n/quote-request`), секрети —
  плейсхолдери з `.env.example`. Рядки з журналу сесії (sha256 скорочено):

  ```
  [mock-n8n] … header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] … production URLs: POST http://127.0.0.1:5678/webhook/<path>
  [mock-n8n] 2026-09-21T19:10:03.507Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 331 B sha256=6c4498e2…
  [mock-n8n] 2026-09-21T19:10:03.508Z workflow 3debfee9-… running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-21T19:10:08.764Z callback POST http://127.0.0.1:3100/api/n8n/quote-request -> 202 in 254 ms (try 1/3) event=quote-request.completed body 382 B sha256=2bafa377…
  ```

  Далі B1 перезапустив мок із `--delay 600000` і прогнав матрицю `send-signed-callback.mjs` —
  **18 з 18 PASS**. B2 і B3 застосунок не підняли (`npm start` не дозволено): B2 перевірив код
  власним скриптом у процесі (підпис, конверт, ліміт тіла, валідація форми; вивід скрипта в журналі
  сесії — 58 PASS, `0 failed`, у фінальній відповіді агент пише про 59 випадків; скрипт видалено) і
  сам написав, що кроки з моком не виконано; B3 — стендом у процесі, який
  викликав справжній роут: 41 з 41, матриця колбеків 18 з 18, сканування журналу — PASS.
- **Час від «Надіслати» до відповіді форми:** B1 — **~140 мс** при «воркфлоу» на 5 с (замір самого
  агента). B2, B3 — не міряли.
- **Що показала `/quotes/<id>`:** B1 — усі чотири стани наживо: `queued` → `processing` → `ready`, а
  також `failed` після трьох невдалих спроб до недоступного n8n. Сторінка показує статус, компанію й
  посилання, без email і опису.
- **Журнал сервера:** B1 — пошук за тестовими email, компанією, описом, токеном і підписом нічого
  не знайшов; у журналі — подія, статус, тривалість, спроба, correlation id, розмір і префікс sha256.
  B3 — сканування журналу в процесі — PASS. B2 — не знімав.

## Порівняння

| Що дивимось | A — без скіла (A1 · A2 · A3) | B — зі скілом (B1 · B2 · B3) |
|---|---|---|
| Скіл видно на старті | ні | так |
| Скіл викликано | — (0 з 3) | **3 з 3**, першим викликом + `references/` |
| `check-contract.mjs --changed-since base`: FAIL (id) | **5 FAIL у всіх трьох:** C3, C4, C5, C9, C10 | **0 FAIL у всіх трьох** |
| `check-contract.mjs`, увесь проєкт (базова лінія 5 FAIL) | 7 FAIL у всіх трьох (+C4, +C5) | 4 FAIL у всіх трьох — лише старий код |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request`, свій ключ `N8N_QUOTE_WEBHOOK_URL` | `${N8N_WEBHOOK_BASE_URL}/quote-request` |
| Автентифікація колбека | статичний Bearer-секрет, без HMAC і вікна часу | HMAC над `${ts}.${raw}`, ±300 с, ключ із підписаного тіла |
| `auth=` / `idempotency=` у журналі мока | не знімали; за кодом — ні токена, ні ключа | B1: `auth=ok idempotency=new`; B2, B3 — не знімали |
| Колбек дійшов; код відповіді застосунку | не перевірено | B1: 202 наживо + матриця 18/18; B3: 18/18 у процесі; B2: 58 з 58 у процесі (за журналом сесії) |
| Час відповіді форми | не міряли (за кодом A1, A3 — до 10 с, A2 — одразу) | B1: ~140 мс; B2, B3 — не міряли |
| Тіла чи персональні дані в журналі сервера | не знімали; за кодом — немає | B1: немає (пошук у журналі); B3: немає (у процесі) |
| Розкладка коду | `lib/quote-workflow.ts` · `app/quotes/actions.ts` · `lib/n8n.ts`, без `server-only` | `lib/n8n/{client,envelope,signature}.ts` з `server-only`, 3 з 3 |
| Ключі контракту в `.env.example` | 1 з 4 у кожному (решта — свої імена), секрети порожні | 4 з 4, секрети `change-me-…` |
| `npm run lint` · `npm run build` | 2 з 3 · 3 з 3 | 3 з 3 · 3 з 3 |
| Змінених файлів | 15 (+575/−2) · 11 (+523/−2) · 15 (+559/−1) | 17 (+837/−2) · 16 (+837/−1) · 16 (+915) |
| Запитання агента | не ставив; у фіналі — «контракт вигадав сам», звірте | не ставив; у фіналі — про старий потік, n8n клієнта, власника |
| Тривалість | 15,0 · 12,3 · 15,5 хв | 18,3 · 21,4 хв · B3 — обрив на 25 хв |
| Ціна (sonnet + радник opus) | $2,86 ($1,63 + $1,23) · $2,86 ($1,48 + $1,37) · $2,98 ($1,72 + $1,26) | $5,10 ($3,20 + $1,90) · $4,81 ($2,84 + $1,97) · — |

### Три застороги, без яких таблиця бреше

1. **Скіл везе шаблон.** `references/nextjs-patterns.md` — це майже готові модулі, і прогони B
   узяли звідти і розкладку, і назви функцій. Тобто B — якісна адаптація шаблону, а не самостійне
   рішення. Для команди це й добре: той самий код у кожному проєкті.
2. **Скіл везе й екзаменатора.** `scripts/check-contract.mjs`, яким ми оцінюємо результат, лежить у
   самому скілі, і всі три прогони B його запускали. Частково це самооцінка; гілка A такого
   інструмента не мало взагалі. Тому поряд зі скриптом — журнал сесії (звідки взялося кожне рішення)
   і, де був, журнал мока.
3. **Три прогони на гілку — це розкид, а не статистика.** Результат повторився 3 з 3 в обох гілках
   (ті самі п'ять id у кожному A), але «глибина» перевірки різна: наживо — лише B1, решта — у
   процесі або статично, через дозволи стенду.

## Перенесення прогону B у гілку (фіча)

- **Як переносити** (для вас): `git apply --3way docs/ab/b-with-skill.diff` на BASE або копіювання
  змінених файлів руками — спосіб записують у звіт. Діф B1 накочується на `main` (`e3451d2`) без
  конфліктів (`git apply --check`).
- **На `ws04/sample` переносити нічого:** фіча вже в гілці (`app/quotes/**`,
  `app/api/n8n/[event]/route.ts`, `components/quote-form.tsx`, `lib/n8n/**`, `lib/quotes.ts`).
- **Що довелось би доробити руками після перенесення B1** — рівно чотири FAIL на всьому проєкті,
  і всі в старому коді, якого запит не стосувався: перевести `lead-created` з `app/actions.ts:54`
  на `lib/n8n/client.ts` (C3, C6, C10) і прибрати рядок `N8N_WEBHOOK_URL=…/webhook-test/…` з
  `.env.example` (C1). На `ws04/sample` це зроблено. Саме тут видно межу скіла: він дає правильний
  **новий** код, але старий приводить до контракту людина (B1 і B2 самі запропонували це окремою
  задачею).
- **Що прогони B відтворили з коду гілки, а що ні** (порівняння діфів з `ws04/sample`):
  - відтворили 3 з 3: розкладку `lib/n8n/{client,envelope,signature}.ts` +
    `app/api/n8n/[event]/route.ts`, порядок колбека, `Object.hasOwn` для мапи обробників, ліміт тіла
    64 КБ, звірку ключа ідемпотентності з підписаним тілом, `after()` для виклику n8n;
  - **не перевірено:** пастку React 19 зі `<select>` (після невалідної відправки скидається на першу
    опцію; на гілці — `key={values.budget}`). Бюджет у всіх трьох B — числове поле, а не список,
    тож ця пастка тут не виникла — ні підтверджено, ні спростовано.
- **`check-contract.mjs` на фінальному коді гілки:** `0 failed, 10 passed, 0 n/a (10 checks)`,
  код виходу 0 (вивід — у `docs/verification.md`).
- **Сценарій «форма → колбек → `/quotes/<id>`» на гілці:** відпрацював — форма відповіла за 178 мс
  при «воркфлоу» на 3 с, колбек прийнято з 202, сторінка статусу пройшла всі три стани; матриця
  `send-signed-callback.mjs` — 18/18 PASS, разом з колбеком іншої задачі для того самого запиту
  (409; журнали — у `docs/verification.md`).
- **Реєстр інтеграцій** (рекомендований крок, не оцінюється): `docs/n8n-integrations.md`, подія
  `quote-request`. Прогони B додали такий рядок самі, 3 з 3.

## Висновок

Скіл змінив результат, і стабільно: на коді самих прогонів **без скіла — 5 з 10 у кожному з трьох,
зі скілом — 10 з 10 у кожному**. Перевернулись C3, C4, C5, C9, C10 — тека `lib/n8n/` із
`server-only`, сирі байти до розбору, HMAC-підпис, імена ключів, `x-n8n-token` і `idempotency-key`.
Усе загальне (продакшн-URL, таймаут, async замість очікування, секрети поза клієнтом, журнали без
тіл) агент зробив і без скіла — із власних знань, це видно з журналу сесії. Рішень команди він не
знав і не зупинився, а вигадав власний, однаковий у всіх трьох прогонах протокол (Bearer-секрет
замість підпису) — і лише у фінальній відповіді попросив його звірити. Ціна: прогін зі скілом
дорожчий у 1,6–1,8 раза й триває довше (18–21 хв проти 12–15,5), а один із трьох уперся в
обмеження 25 хвилин. Доробляти після B1 довелось би лише старий потік `lead-created`. Що змінити в скілі: нічого з контракту — зате варто
прямо сказати в `SKILL.md`, що старі виклики n8n у проєкті агент не переписує без запиту, а
пропонує окремою задачею (так і зробили B1 і B2, але це їхній вибір, а не правило скіла).
