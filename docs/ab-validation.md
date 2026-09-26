# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> **A — без скіла, B — зі скілом.** Замість одного прогону на плече зроблено **по три** (A1–A3, B1–B3) з того самого
> BASE, тим самим запитом і з тими самими налаштуваннями — щоб побачити розкид, а не один випадок. Фіча в гілці — це
> перенесений результат **B1**; діфи A1 і B1 — `docs/ab/a-without-skill.diff` і `docs/ab/b-with-skill.diff`, решта —
> `docs/ab/{a2,a3}-without-skill.diff`, `docs/ab/{b2,b3}-with-skill.diff`.
>
> **Коротко:** `check-contract.mjs --changed-since base` — **7, 7 і 8 FAIL у прогонах A, 0 / 0 / 0 у прогонах B**. З моком,
> налаштованим як n8n клієнта, жоден прогін A не запустив воркфлоу (`403 auth=missing` двічі, `404` на тестовому URL один
> раз); усі три B отримали `202 auth=ok idempotency=new`, підписаний колбек прийнято з першої спроби, сторінка показала
> «Готово» з посиланням на PDF.

- **Інструмент:** Claude Code 2.1.283, неінтерактивно — `claude -p --output-format stream-json --verbose`, запит у stdin (UTF-8).
- **Модель і рівень міркування, однакові в усіх шести:** `--model claude-opus-5-5 --effort high`.
- **Дозволи, однакові в усіх шести:** `--permission-mode acceptEdits --allowedTools "Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(ls:*),Bash(git status),Bash(git diff:*)"`.
  Це дозвіл, а не пісочниця: `node`, `npx tsc`, `python3`, складені команди, запуск сервера й моків агент не міг виконати
  (поле `permission_denials` у підсумку сесії: A1 — 6, A2 — 6, A3 — 6, B1 — 6, B2 — 4, B3 — 3).
- **Код:** BASE = `9f608e4` (коміт після Task C: шість із семи виправлень Task A — `async-suspense-boundaries` зроблено пізніше —
  і три скіли, ще без `/quotes` і змін у виклику n8n);
  скіл для копій B — з того самого коміту.
- **Копії:** окрема тека на кожен прогін (`../leaddesk-ab-a`, `-a2`, `-a3`, `-b`, `-b2`, `-b3`), у кожній
  `git archive BASE`, `git init`, коміт `start` з тегом `base`, `npm install` (`package-lock.json` не змінився).
  `base` у копіях: A1 `f1d652d`, A2 `f32cd43`, A3 `079ccdf`, B1 `85bbf6e`, B2 `8e6f243`, B3 `66e4893`.
- **Що видалено з усіх копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/` і вся тека
  `.claude/skills` (у B повернуто лише `integrating-n8n-webhooks`). Перевірено перед прогонами: `find … -name SKILL.md` —
  у копіях A нічого, у кожній B рівно `.claude/skills/integrating-n8n-webhooks/SKILL.md`; `ls -A … | grep …` — «no hints - ok»;
  `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key"` по копіях A — «no contract - ok».
- **Особисті копії скіла:** немає. `~/.claude/skills` містить лише `synced/` (docx, pdf, pptx, xlsx, docs, google-workspace,
  import-memory, morning, skill-creator); `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills` не існують.
- **Запит:** текст між лініями з `materials/ab-task.md` без змін (sha256 `498a125e1d02…`; побайтово звірено з файлом),
  нова сесія на кожен прогін. Двома хвилями: A1 і B1 паралельно о 13:52, A2, A3, B2, B3 паралельно о 14:22.
- **Відповідь на уточнення:** у режимі `-p` агент питань не ставить; усі шість зробили припущення й описали їх у фінальній
  відповіді.
- **Вихід за межі копії:** читань чужих файлів поза своєю текою в журналах немає (A1 один раз прочитав власний файл
  виводу інструмента в `~/.claude/projects/…/tool-results/` — службовий файл самої сесії). Три прогони A **записали** власний мок поза копією
  (A1 — `/tmp/mock-n8n-quote.mjs`, A2 — `/tmp/quote-e2e/mock-n8n.mjs`, A3 — `/tmp/quote-mock-n8n.mjs`) і спробували його
  запустити — запуск відхилено дозволами.
- **Мок, однаковий для всіх шести** (з робочого репозиторію, термінал у теці копії):
  `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  — Header Auth (`N8N_WEBHOOK_TOKEN`) і підписаний колбек через 5 с (`N8N_CALLBACK_SECRET`), як налаштований n8n клієнта;
  `--callback-url` не знадобився — усі шість передають `callbackUrl`. `.env.local` кожної копії = ключі з її
  `.env.example` (адреси як у агента, секрети замінено згенерованими) + дві змінні мока. Застосунок —
  `npm run build && npm start` з копії. Форму відправляли як браузер без JS (multipart POST з прихованими полями дії),
  час — від POST до відповіді.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`) — однакова в усіх шести:
  3 PASS, 7 FAIL (C1, C3, C4, C5, C7, C8, C15 — старий виклик `lead-created` у `app/actions.ts:55` і `.env.example`),
  5 N/A. Це старий код, в оцінку прогонів не йде. Нижче — `--changed-since base`, тобто лише те, що змінив агент.

## A — без скіла

- **Які скіли бачив агент** (окремий `claude -p "/context"` у кожній копії): жодного проєктного; лише вбудовані й synced —
  ті самі, що в копіях B.
- **Що зробив агент (усі три):** повна фіча — `/quotes/new` з формою, Server Action, колбек-роут
  `app/api/quotes/[id]/callback/route.ts`, `/quotes/[id]` зі статусом, що оновлюється кожні 5 с. Синхронно 40–90 с ніхто не
  чекав. A1 викликає n8n в `after()` і одразу робить `redirect`; **A2 і A3 чекають відповідь вебхука в самій дії** (таймаут
  15 с і 10 с) і лише потім відповідають — C8 FAIL.
- **Власний протокол замість контракту — однаковий в усіх трьох:** колбек захищено статичним `Authorization: Bearer
  <callbackToken>` (випадковий токен на запит, передається в n8n у тілі; A2 і A3 зберігають sha256 токена й порівнюють хеші
  через `timingSafeEqual`, A1 зберігає сам токен і порівнює його через `timingSafeEqual`);
  HMAC над тілом немає, `x-n8n-timestamp` і вікна часу немає, ключа ідемпотентності немає в жодному напрямку; вихідний
  виклик — без `x-n8n-token`; тіло — плоский JSON без конверта, **з email клієнта** (PDF-кошторису email не потрібен).
  Змінні — власні: `N8N_QUOTE_WEBHOOK_URL` у всіх трьох, `APP_URL` (A1, A3) або `APP_BASE_URL` (A2).
- **Звідки агент узяв домовленості:** інструмент `Skill` — 0 викликів, `ls .claude/skills` — порожньо (A1–A3 перевірили самі).
  Документацію Next.js у `node_modules/next/dist/docs/` читали A1 (`after.md`) і A3 (`after.md`, `refresh.md`, `route.md`) —
  заради API; A2 переглянув лише список її файлів (`ls`). Усе, що схоже на контракт (production-URL, таймаут, `timingSafeEqual`, UUID у публічному id), — загальні знання.
- **Що правильно зробили самі (3 з 3):** не чекали 40–90 с, таймаут на `fetch`, `callbackUrl` з конфігурації, а не з `Host`,
  без `NEXT_PUBLIC_`, без тіл і персональних даних у журналах, без `runtime = "edge"`; A1 і A2 — production-URL.
- **`npm run lint` / `npm run build`** на коді кожного прогону (перевірка після прогону): зелені в усіх трьох.
- **Фінальні відповіді** (скорочено): A1 — «Наживо я цей потік не запускав… n8n має надіслати `POST` на `callbackUrl` із
  `Authorization: Bearer <callbackToken>`»; A2 — «Повний сценарій (форма → n8n → відповідь → PDF) я **не перевіряв**: запуск
  серверів вимагав дозволу»; A3 — «Повний цикл із колбеком я не перевірив: запуск dev-сервера і тимчасового мока n8n не
  отримав дозволу».

**`check-contract.mjs --root <копія> --changed-since base`:**

| Прогін | Результат | FAIL | На всьому коді копії |
|---|---|---|---|
| A1 | 7 PASS, 7 FAIL, 1 N/A | C3, C4, C7, C9, C11, C12, C15 | 4 PASS, 10 FAIL |
| A2 | 7 PASS, 7 FAIL, 1 N/A | C3, C4, C7, C8, C11, C12, C15 | 5 PASS, 9 FAIL |
| A3 | 6 PASS, 8 FAIL, 1 N/A | C1, C3, C4, C7, C8, C11, C12, C15 | 5 PASS, 9 FAIL |

Вивід A1:

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
      .env.example:1  missing N8N_WEBHOOK_BASE_URL
      .env.example:1  missing N8N_WEBHOOK_TOKEN
      .env.example:1  missing N8N_CALLBACK_SECRET
      .env.example:1  missing APP_BASE_URL
C8   PASS  Server Actions do not wait for n8n (call runs inside after())
C9   FAIL  callback reads the raw body; no .json()/JSON.parse before the signature check
      app/api/quotes/[id]/callback/route.ts:35  request.json() — read await req.text() and verify first
      app/api/quotes/[id]/callback/route.ts:28  body is not read raw (req.text() / arrayBuffer() / body.getReader())
C10  PASS  callback signature compared with crypto.timingSafeEqual, not ===
C11  FAIL  callback rejects x-n8n-timestamp outside a 300 s window
      app/api/quotes/[id]/callback/route.ts:28  x-n8n-timestamp is never read
C12  FAIL  callback deduplicates by idempotency-key
      app/api/quotes/[id]/callback/route.ts:28  idempotency-key header is never read
      app/api/quotes/[id]/callback/route.ts:28  no {"duplicate": true} response for a repeated key
C13  PASS  no runtime = "edge"
C14  PASS  n8n code does not log bodies, headers, secrets or personal data
C15  FAIL  request body is the envelope {version, event, data}, not a whole DB row
      lib/quote-workflow.ts:23  request body has no envelope version/event

7 PASS, 7 FAIL, 1 N/A
exit=1
```

A2 і A3 — ті самі id на своїх рядках (`app/quotes/new/actions.ts:32`, `app/quotes/actions.ts:26`), плюс C8 (дія чекає
вебхук); у A3 ще C1 — **тестовий URL** `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/quote-request` у
`.env.example`. C9 у A2 і A3 — PASS: вони читають тіло через `request.text()` уже після перевірки Bearer-токена. C10 у
всіх трьох — PASS: токен порівнюється через `timingSafeEqual` (підпису над тілом як такого немає — це показують C11, C12).

**Сценарій з моком:**

| Прогін | Журнал мока | Відповідь форми | Що показала сторінка | Журнал сервера |
|---|---|---|---|---|
| A1 | `POST /webhook/quote-request -> 403 in 2 ms auth=missing \| headers: accept,accept-language,content-type,user-agent \| body 439 B` | 173 мс (`303` → `/quotes/c6deb987-…`) | «Не вдалося підготувати кошторис. Не вдалося запустити підготовку кошторису…» | `Failed to start quote-request workflow for quote c6deb987-… Error: n8n responded with 403` |
| A2 | `POST /webhook/quote-request -> 403 in 1 ms auth=missing \| … \| body 451 B` | 329 мс (`200`, помилка на самій формі — дія дочекалась 403) | сторінки статусу не дійшли: «Не вдалося запустити підготовку кошторису. Спробуйте ще раз за хвилину.» | `quote.trigger_failed quote_fc2ee2b1-… Error: n8n responded 403` |
| A3 | `POST /webhook-test/quote-request -> 404 in 1 ms \| … \| body 487 B` | 268 мс (`303` → `/quotes/quote_46205e54-…`) | «Не вдалося підготувати кошторис» | `Quote quote_46205e54-…: failed to start the n8n workflow Error: n8n responded with 404` |

Колбеків немає: жоден воркфлоу не запустився. Навіть якби запустився, підписаний колбек n8n (без `Authorization: Bearer`,
з тілом `{version, event, data}`) роути A відхилили б — схеми несумісні. Тіл, email, телефонів, токенів і підписів у
журналах сервера — 0 у всіх трьох (`grep -ciE 'olena.test@|Nova Dental|онлайн-записом|sha256=|x-n8n-token'` по журналу `npm start` → 0; це email, компанія й фрагмент опису, які відправляли у формі).

## B — зі скілом

- **Які скіли бачив агент** (окремий `/context`): `integrating-n8n-webhooks` (Project) + ті самі вбудовані й synced, що в A.
- **Чи викликав агент скіл:** так, **3 з 3 — найпершим викликом інструмента** в сесії (`"skill":"integrating-n8n-webhooks"`).
  Далі всі три прочитали чотири `references/*.md` і всі три скрипти скіла (`mock-n8n.mjs`, `check-contract.mjs`,
  `send-signed-callback.mjs`) — по 7 різних файлів. Кожен пробував запустити `check-contract.mjs` (B1 — у 4 викликах, B2 і
  B3 — у 2) — усі відхилено дозволами; B1 після цього «пройшов перевірку вручну за кодом скрипта» і сам виправив одне
  порушення C14 у своєму роуті.
- **Що зробив агент (усі три):** `lib/n8n/client.ts` за шаблоном скіла (`import "server-only"`, конверт `{version, event,
  data, callbackUrl}`, `x-n8n-token`, `idempotency-key`, `x-correlation-id`, таймаут 10 с, до 2 повторів лише на мережу/5xx);
  Server Action зберігає запит `queued` з `idempotencyKey`/`correlationId`, повертає `{ status, id }`, n8n — в `after()`,
  результат виклику → `processing`/`failed`; колбек `app/api/n8n/[event]/route.ts` за 10 кроками (404/415 → `req.text()` →
  413 → вікно 300 с → HMAC + перевірка довжини + `timingSafeEqual` → застовпити ключ / `duplicate` → парсинг і звірка ключа
  з тілом → запис до відповіді → 202); `/quotes/[id]` з автооновленням; `.env.example` — 4 ключі контракту; усі три
  дописали `docs/n8n-integrations.md` (реєстр інтеграцій зі скіла).
- **Відмінності між B:** B1 і B2 переробили й старий `lead-created` на той самий клієнт (контракт вимагає одного модуля) і
  попередили у відповіді, що воркфлоу лідів клієнта треба оновити; B3 старий виклик не чіпав (його код чистий, але на всьому
  проєкті лишились 6 FAIL базової лінії). B1 і B3 шлють у n8n мінімум без контактів клієнта; **B2 передає контакти**: у `lead-created` —
  `fullName`, `email`, `phone`, `website`, `message`, `consentMarketing` (плюс `company`, `budget`, `source`), у `quote-request` —
  `email` і `description` (скіл казав «мінімум для воркфлоу», але не забороняв контакти явно — див. висновок). B2 **без JavaScript** не веде на сторінку
  статусу: після відправки — «Запит прийнято. Відкриваємо сторінку статусу…», а перехід робить лише `router.push` у
  `useEffect`; з JS — працює. У B1 і B3 відповідь форми містить посилання на статус.
- **`npm run lint` / `npm run build`** на коді кожного прогону: зелені в усіх трьох.
- **Фінальні відповіді** (скорочено): B1 — «Решту перевірок я не запустив: скрипт перевірки контракту, сервер і мок n8n
  потребують вашого дозволу… **Я змінив наявну відправку лідів у n8n (`lead-created`).** Цього вимагає скіл… Воркфлоу клієнта
  для лідів треба оновити до злиття цієї зміни»; B2 — «Сценарій із моком n8n я не запускав, тож від початку до кінця зв'язка
  ще не перевірена»; B3 — «перевірки контракту, які вимагає скіл (статичний `check-contract.mjs`, прогін із моком n8n і
  матриця підписаних колбеків), я **не запускав**: виклик … потребував підтвердження».

**`check-contract.mjs --root <копія> --changed-since base`:**

| Прогін | Результат | На всьому коді копії |
|---|---|---|
| B1 | 15 PASS, 0 FAIL, 0 N/A | 15 PASS, 0 FAIL |
| B2 | 15 PASS, 0 FAIL, 0 N/A | 15 PASS, 0 FAIL |
| B3 | 15 PASS, 0 FAIL, 0 N/A | 9 PASS, 6 FAIL (старий `lead-created` і `.env.example`-рядок `N8N_WEBHOOK_URL` з базової лінії) |

Вивід B1 (у B2, B3 — такий самий):

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

**Сценарій з моком** (ті самі умови, що в A):

| Прогін | Журнал мока | Відповідь форми | Що показала сторінка |
|---|---|---|---|
| B1 | `POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new \| headers: …,content-type,idempotency-key,…,x-correlation-id,x-n8n-token \| body 355 B` → через 5 с `callback POST …/api/n8n/quote-request -> 202 in 268 ms (try 1/3)` | 233 мс (`200`, посилання `/quotes/q_09d40eef-…`) | одразу «Готуємо кошторис», через 9 с «Готово. Кошторис підготовлено.» + «Завантажити PDF» |
| B2 | `-> 202 in 2 ms auth=ok idempotency=new \| … \| body 389 B` → `callback … -> 202 in 258 ms (try 1/3)` | 235 мс (`200`; посилання на статус без JS немає — див. вище; id узято з RSC-відповіді) | «Готуємо кошторис» → «Готово», «Кошторис готовий» + PDF |
| B3 | `-> 202 in 1 ms auth=ok idempotency=new \| … \| body 355 B` → `callback … -> 202 in 226 ms (try 1/3)` | 222 мс (`200`, посилання `/quotes/q_4446a851-…`) | «Готуємо кошторис» → «Кошторис готовий» + «Завантажити PDF» |

Журнал сервера для сценарію (B1) — подія, correlation id, статус, тривалість, довжина тіла; ні email, ні назви компанії, ні
токена, ні підпису. У B2 і B3 поля ті самі, лише в `n8n.callback` вони пишуть HTTP-статус відповіді (`status: 202`), а B1 —
статус задачі (`status: 'completed'`):

```
n8n.webhook { event: 'quote-request', correlationId: '6795f63e-…', status: 202, attempt: 1, ms: 19 }
n8n.callback { event: 'quote-request.completed', correlationId: '6795f63e-…', status: 'completed', bytes: 382 }
```

(Попередження `Missing origin header from a forwarded Server Actions request` у журналах усіх прогонів — від тестового
POST без заголовка `Origin`, до коду прогонів не стосується.)

## Порівняння

| Що дивимось | A (A1 / A2 / A3) — без скіла | B (B1 / B2 / B3) — зі скілом |
|---|---|---|
| Скіл викликано | — | 3 з 3, першим кроком |
| `check-contract.mjs --changed-since base`, FAIL | 7 / 7 / 8 (C3, C4, C7, C11, C12, C15 у всіх; C9 у A1; C8 у A2, A3; C1 у A3) | 0 / 0 / 0 |
| URL вебхука | `/webhook/` / `/webhook/` / **`/webhook-test/`** | `/webhook/<event>` у всіх |
| `auth=` / `idempotency=` у журналі мока | `missing` / `missing` / (404 до перевірки); ключа немає | `ok` / `new` у всіх |
| Колбек | немає в жодному (воркфлоу не запустився); схема колбека несумісна з n8n команди | `202` з першої спроби в усіх |
| Результат для користувача | «не вдалося» у всіх трьох | «Готово» + PDF у всіх трьох |
| Час відповіді форми | 173 / 329 / 268 мс (A2 і A3 чекають вебхук у дії) | 233 / 235 / 222 мс |
| Контакти клієнта в n8n | email / email / email (у `quote-request`) | ні / так (`lead-created`: ім'я, email, телефон, сайт, повідомлення, згода на розсилку; `quote-request`: email, опис) / ні |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Старий `lead-created` за контрактом | ні / ні / ні | так / так / ні |
| Змінених файлів | 11 (+508/−1) / 11 (+561/−1) / 11 (+494/−1) | 13 (+699/−13) / 14 (+732/−12) / 13 (+729/−1) |
| Ходів · час · вартість | 45 · 4,6 хв · $1,42 / 37 · 4,4 хв · $1,35 / 36 · 3,6 хв · $1,20 | 62 · 5,3 хв · $1,81 / 46 · 6,4 хв · $1,91 / 45 · 6,0 хв · $1,92 |

## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --3way docs/ab/b-with-skill.diff` (діф B1; застосувався без конфліктів) → окремий коміт
  **без змін** `54c14bc` «feat(quotes): quote request via n8n — transferred from A/B run B». `.env.local` і `node_modules/`
  не переносили; `package.json`/`package-lock.json` агент не змінював.
- **Що довелось доробити руками** (кожне — окремим комітом):
  - `9896c7b` — коментар у `.env.example` містив рядок «never /webhook-test»; переписано без цього літерала.
  - `a4d9712` `fix(server-after-nonblocking)` — у старому `submitLead` агент переніс n8n в `after()`, але лишив
    `await logAudit("lead.created")` (250 мс) перед відповіддю. Скіл n8n цього не дав: аудит — не n8n.
  - `a341d25` — у формі кошторису B1 помилки полів були звичайним текстом: без `aria-invalid`, `aria-describedby` і підсумку
    `role="alert"`; бюджет-`<select>` після помилки скидався б (React 19 скидає форму після дії). У копії B не було скіла
    форм — це наслідок протоколу A/B, а не межа n8n-скіла. Доведено за патерном `building-client-form`.
  - Колбек-роут — у два заходи; обидва знайшла розширена матриця (перша, на 9 випадків, їх не бачила):
    - `08f5334`: `content-type` перевірявся через `startsWith("application/json")`, тож `application/jsonx` з правильним
      підписом проходив (202 замість 415); правильно підписаний колбек **іншої** задачі повторно «завершував» готовий
      кошторис і міняв посилання на PDF (202 замість 409). Медіатип тепер розбирається без параметрів, завершений запис не
      перезаписується (409, ключ звільняється). Супутньо `1b6ae91`: новий рядок журналу 409 спершу передавав у `console`
      `body.data.correlationId` — C14 це зловив, тепер логується деструктуризоване значення.
    - `5be2f89`: `Content-Length` понад 64 КБ відхиляється (413) **до** читання тіла; `data.status` мусить збігатися з
      подією (`.completed` зі `status: "failed"` раніше приймався, тепер 400); колбек з **чужим** `correlationId` раніше
      «завершував» запит, що ще чекає, і справжній колбек потім отримував 409 — тепер 409 отримує чужий.
    Ці ж діри виправлено в шаблоні скіла (`8b34b4f`, `4ac1c1c`).
  - `73379ce` — клієнт n8n ішов за перенаправленнями: на 3xx `fetch` повторював запит **разом з `x-n8n-token`** на хост із
    `Location`, а чужий 202 застосунок вважав успіхом. Перевірено двійником n8n, що відповідає 307 на інший хост: до
    виправлення той хост отримав токен, після — запит зупиняється на 307 (одна спроба, без повторів), кошторис отримує
    «Не вдалося підготувати», інший хост не отримує жодного запиту. Те саме — у шаблоні скіла (`e8c9f90`).
  - `d4479fe` — сторінка статусу опитувала сервер кожні 5 с безкінечно, якщо колбек не приходив. Тепер через 5 хвилин
    (воркфлоу триває 40–90 с) опитування зупиняється з поясненням. Перевірено в Chrome на запиті, що чекає колбека: зі
    звичайним годинником — 3 оновлення за 17 с і «Сторінка оновлюється сама.»; з годинником сторінки, зсунутим на 6 хвилин
    уперед, — 0 оновлень і «Кошторис готується довше, ніж зазвичай…».
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; жодного `/webhook-test/`. У `.env.local` — ті самі ключі, секрети згенеровано
  `crypto.randomBytes(32)` прямо у файл, ніде не друкувались. `git ls-files ".env*"` → лише `.env.example`.
- **`npm run lint`, `npm run build` на гілці:** без помилок (lint — код виходу 0 на `e8c9f90`) (`/api/n8n/[event]`, `/quotes/[id]`, `/quotes/new` у збірці).
- **`check-contract.mjs` на фінальному коді:** `15 PASS, 0 FAIL, 0 N/A`, `exit=0` (повний вивід — у `docs/verification.md`).
- **Сценарій «форма → колбек → `/quotes/<id>`» на гілці** (фінальний код, мок `respond-202 --delay 5000` з
  `tools/mock-n8n.mjs`):

  ```text
  POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,cache-control,content-type,idempotency-key,pragma,user-agent,x-correlation-id,x-n8n-token | body 355 B sha256=228e9b36…
  workflow 9614a20a-… running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 247 ms (try 1/3) event=quote-request.completed body 382 B sha256=9bdaa038…
  ```

  Прогін на `e8c9f90`. Форма відповіла за 225 мс (посилання `/quotes/q_c2a0cecb-…`); сторінка: «Готуємо кошторис» → «Готово. Кошторис
  підготовлено.» + «Завантажити PDF». Журнал сервера — лише `n8n.webhook { …, status: 202, attempt: 1, ms: 16 }` і
  `n8n.callback { …, status: 'completed', bytes: 382 }`; даних з форми в ньому немає.
- **Те саме в браузері з JavaScript** (Chrome 153 headless):
  - невалідна відправка (email «not-an-email», опис «коротко», вибраний бюджет) → `role="alert"` «Перевірте поля: email,
    опис задачі», `aria-invalid="true"` на email і описі, `aria-describedby` email веде на «Перевірте email»; назва
    компанії, опис і вибраний бюджет лишились у полях;
  - валідна відправка → посилання на статус за 204 мс → сторінка статусу сама (автооновлення, без перезавантаження тестом)
    перейшла в «Готово» з посиланням на PDF; помилок у консолі — 0.
- **Форма ліда на гілці** проти мока `last-node` (2 с): 158 / 141 / 135 мс, у мока `POST /webhook/lead-created -> 200 in
  2001–2002 ms auth=ok idempotency=new … body 112 B` (на `main` — 2451 / 2402 / 2399 мс і `body 1010 B` без токена).
- **Матриця колбеків** проти `app/api/n8n/[event]/route.ts` на гілці — для запиту, який ще **чекає** колбека (тестовий
  приймач на :5678 відповідає 202 і не шле колбек; `--request-key` і `--correlation-id` — заголовки, з якими застосунок
  викликав n8n):

  ```text
  $ node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs \
      --url http://127.0.0.1:3000/api/n8n/quote-request --request-key <key> --correlation-id <id>
  PASS  wrong-content-type      expected 415  got 415
  PASS  json-lookalike-type     expected 415  got 415
  PASS  json-with-charset       expected 401  got 401
  PASS  oversized-body          expected 413  got 413
  PASS  missing-signature       expected 401  got 401
  PASS  bad-signature           expected 401  got 401
  PASS  short-signature         expected 401  got 401
  PASS  wrong-secret            expected 401  got 401
  PASS  stale-timestamp         expected 401  got 401
  PASS  future-timestamp        expected 401  got 401
  PASS  non-numeric-timestamp   expected 401  got 401
  PASS  reformatted-body        expected 401  got 401
  PASS  malformed-json          expected 400  got 400
  PASS  status-event-mismatch   expected 400  got 400
  PASS  unknown-event           expected 404  got 404
  PASS  wrong-correlation       expected 409  got 409
  PASS  valid                   expected 202  got 202
  PASS  repeat                  expected 200  got 200  duplicate=true
  PASS  replay-new-key          expected 400  got 400
  PASS  other-job-same-request  expected 409  got 409

  0 failed, 20 passed (20 cases)
  ```

  Прогін на `e8c9f90`. Після матриці сторінка запиту показала «Готово» і `files.example.test/n8n/f51c8ad3-….pdf` — PDF саме
  від задачі `valid` (`jobId f51c8ad3-…`): ні колбек з чужим `correlationId`, ні колбек іншої задачі його не перезаписали. Та сама матриця на роуті до `5be2f89`: `FAIL  status-event-mismatch   expected 400  got 202`; `FAIL  wrong-correlation       expected 409  got 202`; `FAIL  valid                   expected 202  got 409`; `FAIL  repeat                  expected 200  got 409  duplicate=false` —
  `4 failed, 16 passed`: колбек з чужим correlation id «завершив» запит, і справжній (`valid`, `repeat`) уже отримав 409. На
  роуті до `08f5334` (перша розширена версія матриці, 18 випадків): `json-lookalike-type expected 415 got 202`,
  `other-job-same-request expected 409 got 202`.
- **`docs/n8n-integrations.md`:** є — створив агент у прогоні B1 (рядки `lead-created` і `quote-request`, текст
  налаштувань n8n для клієнта); власника вписано вручну (у коміті `4ac1c1c`).

## Висновок

Скіл змінив результат стабільно й вимірювано. Без нього всі три агенти написали робочу на вигляд фічу, але з **власним**
протоколом (Bearer-токен замість HMAC, без часу, без ідемпотентності, без `x-n8n-token`, email у n8n; один — з тестовим
URL), і жоден із трьох не зміг поговорити з n8n, налаштованим за записку команди (`403`, `403`, `404`). Зі скілом — 0 FAIL
у 3 з 3, `202 auth=ok idempotency=new`, колбек прийнято, «Готово» з PDF у всіх трьох. Загальні знання дали агентам без
скіла те, що є в документації (`after()`, таймаут, `timingSafeEqual`, непередбачуваний id), а командні рішення — ні.
Межу скіла теж видно: він не вберіг від речей поза n8n (B2 без JS не веде на статус; аудит у `after()` довелось доробити) і
в кількох місцях його шаблон колбека був недостатньо суворим — це знайшла розширена матриця, і скіл виправлено разом із
кодом. Після прогонів у скіли додано й решту уроків (`4ac1c1c`): «email і контакти в n8n — лише якщо воркфлоу їх справді
використовує» (B2), посилання або `redirect()` на сторінку статусу у відповіді форми без JS (B2), `values` за будь-якої
невдачі дії й `key` для `<select>` (форма B1).
