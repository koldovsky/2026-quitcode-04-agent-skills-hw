# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code, запущений із Cursor.
- **Модель і рівень міркування (effort), однакові в обох прогонах:** Claude Sonnet 5, стандартний рівень міркування (не змінювався між прогонами)
- **Код:** BASE = `c65cf9d` (коміт після Task C: три скіли й виправлення Task A, ще без `/quotes` і змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з того самого коміту (`c65cf9d` = HEAD на момент створення копій)
- **Копії:** `../leaddesk-ab-a` (без жодного скіла), `../leaddesk-ab-b` (лише `integrating-n8n-webhooks`); у кожній — коміт `start` з тегом `base`
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/` і всі скіли (у B повернуто лише `integrating-n8n-webhooks`) — перевірено: `find … -name SKILL.md` дав рівно один рядок (копія B), `ls -A | grep` дав «no hints - ok», `grep` на контрактні терміни в копії A дав «no contract - ok»
- **Особисті копії скіла** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`): перевірено — знайдено лише `~/.claude/skills/synced/...` зі стандартними вбудованими скілами інструмента (`docs`, `docx`, `google-workspace`, `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`, `xlsx`), жодного з наших трьох проєктних скілів там немає
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** прогін A не ставив запитань. Прогін B двічі скористався `AskUserQuestion` (чи встановити пакет `server-only`; чи робити сторінку статусу публічною) — в обох випадках обрано варіант, позначений моделлю як «Recommended» («Так, встановити» / «Публічна»). Це відхилення від протоколу (мало бути «Роби, як вважаєш правильним» без уточнень), але обидва питання стосувались архітектурних дрібниць, не контракту n8n, тому вплив на порівнюваність прогонів мінімальний
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії): `node --env-file=.env.local ../2026-quitcode-04-agent-skills-hw/tools/mock-n8n.mjs --mode respond-202 --delay 5000`
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`): 3 FAIL (C1, C4, C5), 2 PASS (C2, C3) — той самий результат на обох копіях до прогонів (старий тестовий URL у `.env.example`, відсутність `lib/n8n/client.ts` і колбек-роуту); в оцінку прогонів не йде

## A — без скіла

- Які скіли бачив агент (окремий запуск перевірки скілів): жодного проєктного скіла в `.claude/skills/` — лише стандартні вбудовані скіли інструмента
- Що зробив агент — своїми словами: дослідив наявний код проєкту (форма ліда → n8n → колбек-подібна структура вже частково була у вигляді простого fire-and-forget fetch), і за аналогією написав повну фічу «запит на кошторис»: нову сутність у `lib/db.ts`, форму, Server Action з прямим `fetch` до n8n прямо в файлі дії, колбек-роут `app/api/quotes/webhook/route.ts` з власним заголовком `X-Webhook-Secret`, сторінку статусу з client-side поллінгом (`router.refresh()` кожні 5с)
- Звідки агент узяв домовленості: із наявного коду проєкту (`app/actions.ts` з fetch до n8n) та загальних знань про Next.js Server Actions/Route Handlers — жодного специфічного контракту команди (HMAC, ідемпотентність, таймаути, повтори) агент не знав і не відтворив
- Запитання агента і фінальна відповідь: агент не ставив запитань, працював повністю автономно
- Змінені файли (`git diff --cached --stat base`): `.env.example`, `app/api/quotes/webhook/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`, `app/quotes/new/page.tsx`, `components/quote-form.tsx`, `components/quote-status-badge.tsx`, `components/quote-status-poller.tsx`, `lib/db.ts`, `lib/quote-form.ts`, `lib/types.ts` (+ `package-lock.json`, шум); діф: `docs/ab/a-without-skill.diff` (926 рядків)
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL` (з тестовим URL `/webhook-test/quote-request` — повторив стару помилку), `N8N_CALLBACK_SECRET`, `APP_BASE_URL`
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base`:

C1 FAIL — тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example
.env.example:6 N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
.env.example:10 N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/quote-request
C2 PASS — жодна змінна N8N_* не має префіксу NEXT_PUBLIC_
C3 PASS — прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts
C4 FAIL — виклик n8n використовує AbortSignal.timeout
lib\n8n\client.ts:0 lib/n8n/client.ts не знайдено
C5 FAIL — колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual
app\api\n8n[event]\route.ts:0 колбек-роут не знайдено

4 FAIL

  **Важлива примітка:** C3 PASS тут хибний — скрипт шукає порушення лише в очікуваному шляху `lib/n8n/client.ts`, а агент A назвав файл інакше (прямий `fetch` в `app/quotes/actions.ts`), тому реальне порушення C3 (прямий виклик поза виділеним клієнт-модулем) скрипт не побачив. Аналогічно C4/C5 повідомляють «файл не знайдено», а не аналізують фактичний код на інших шляхах. Це виявлена слабкість скрипта — див. висновок.
- Журнал мока (форма → колбек → `/quotes/<id>`):

[mock-n8n] POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 192 B sha256=5565646a...

  Запит відхилено миттєво через відсутність `x-n8n-token` — колбек не надсилався, бо воркфлоу не запустився.
- Час від «Надіслати» до відповіді форми: ~502мс (весь цикл обірвався на 403 від мока)
- Що показала `/quotes/<id>`: бейдж «Помилка» з текстом «n8n відповів статусом 403»
- Журнал сервера: чи є тіла запитів, email, телефони, токени, підписи: ні, чисто — лише `db:insertQuoteRequest: 1`, `db:updateQuoteRequestStatus: 1`, `db:getQuoteRequest: 1`

## B — зі скілом

- Які скіли бачив агент (окремий запуск перевірки скілів): рівно один проєктний скіл — `integrating-n8n-webhooks`
- **Чи викликав агент скіл:** так, явно і одразу — на початку сесії прочитав усі 5 файлів `references/` (`outgoing-contract.md`, `response-modes.md`, `callback-handling.md`, `logging-and-limits.md`, `known-pitfalls.md`) ще до дослідження коду проєкту
- Що зробив агент — своїми словами: після дослідження конвенцій проєкту (окремий subagent) створив повну реалізацію строго за контрактом скіла: окремий `lib/n8n/client.ts` з `import 'server-only'`, таймаутом і повторами; Server Action, що зберігає запис і викликає n8n у `after()`; колбек-роут `app/api/n8n/[event]/route.ts` з точним 10-кроковим порядком обробки (сирий текст → ліміт розміру → вікно часу → HMAC через `timingSafeEqual` → застовплення ідемпотентності → парсинг → збереження → 202); виправив і свій новий тестовий URL, і успадкований старий `N8N_WEBHOOK_URL` у `.env.example`. Додатково провів наскрізне тестування через Playwright (встановив пакет сам), знайшов і виправив реальний баг (невідповідність формату `idempotency-key`), і вручну перевірив edge cases: невірний підпис (401), прострочений timestamp (401), невідома подія (404), порожня форма (валідація)
- Запитання агента і фінальна відповідь: два уточнення через `AskUserQuestion` — «встановити пакет `server-only`?» → «Так, встановити (Recommended)»; «сторінка статусу — публічна чи лише для дашборду?» → «Публічна (Recommended)». Відхилення від протоколу зафіксовано вище
- Змінені файли (`git diff --cached --stat base`): `.env.example`, `app/api/n8n/[event]/route.ts`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`, `app/quotes/new/page.tsx`, `components/quote-request-form.tsx`, `components/quote-status-badge.tsx`, `components/quote-status-poller.tsx`, `lib/data.ts`, `lib/db.ts`, `lib/n8n/client.ts`, `lib/quote-form.ts`, `lib/types.ts` (+ `package.json`/`package-lock.json` через `server-only`); діф: `docs/ab/b-with-skill.diff` (1176 рядків)
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL` (і виправив старий `N8N_WEBHOOK_URL`, прибравши `/webhook-test/`)
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base`:

C1 PASS — тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example
C2 PASS — жодна змінна N8N_* не має префіксу NEXT_PUBLIC_
C3 PASS — прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts
C4 PASS — виклик n8n використовує AbortSignal.timeout
C5 PASS — колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual

0 FAIL

- Журнал мока (форма → колбек → `/quotes/<id>`):

[mock-n8n] POST /webhook/quote-request -> 202 in 8 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 235 B sha256=951e2fcb...
[mock-n8n] workflow ccc7f916-b8e7-4b50-a45a-41cba076ce8c running for 5000 ms, then callback event=quote-request.completed
[mock-n8n] callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 305 ms (try 1/3) event=quote-request.completed body 382 B sha256=f2f37e70...

- Час від «Надіслати» до відповіді форми: ~293мс (початкова відповідь, не блокує користувача); повний цикл до готового кошторису — ~5-6с (відповідає затримці мока 5000мс + інтервал поллінгу)
- Що показала `/quotes/<id>`: спершу бейдж «Готуємо кошторис…», після колбеку автоматично оновилось на «Кошторис готовий» з кнопкою «Завантажити кошторис» (посилання на PDF)
- Журнал сервера: чи є тіла запитів, email, телефони, токени, підписи: ні, чисто — лише лічильники `db:insertQuote`, `db:getQuote` (×3, через поллінг), `db:claimCallbackKey`, `db:getQuoteByIdempotencyKey`, `db:updateQuoteResult`

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — | так, одразу, усі `references/` прочитані |
| `check-contract.mjs` на коді прогону: FAIL (id) | 4 FAIL (C1, C4, C5 + C3 хибний PASS) | 0 FAIL |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/` у виклику, але `/webhook-test/` у `.env.example` (нова змінна) | `/webhook/` всюди, і стару помилку теж виправлено |
| `auth=` / `idempotency=` у журналі мока | `auth=missing`, ідемпотентність відсутня | `auth=ok`, `idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні (запит на n8n відхилено 403, до колбеку не дійшло) | так, 202 з першої спроби |
| Час відповіді форми | ~502мс (обірвалось помилкою) | ~293мс (успішний старт), ~5-6с повний цикл |
| Тіла чи персональні дані в журналі сервера | немає | немає |
| Змінених файлів | 11 (+ package-lock шум) | 13 (+ package.json/lock через нову залежність) |
| Запитання агента | не ставив | 2 уточнення (Recommended-варіанти обрано) |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff`, з кореня робочого репозиторію (гілка на BASE-коді); застосувалось повністю без конфліктів (13 нових/змінених файлів)
- Що довелось доробити руками після перенесення (межа скіла):
  1. **Виправлено сам скіл** (`check-contract.mjs`): перевірка C3 була жорстко прив'язана до конкретних шляхів файлів і давала хибний PASS/непоказовий FAIL, якщо агент (як у прогоні A) назвав файли інакше. Регулярка розширена, щоб ловити будь-яку змінну `N8N_WEBHOOK*_URL` поза `lib/n8n/client.ts`, а не лише буквальний рядок `webhook/` в URL. Окремі коміти: `7a07d39`→`b8e62e4` (прибрано мертвий код), `eb7460b` (виправлено регулярку C3).
  2. **Виправлено старий код** (не з прогону B): форма заявки (`submitLead` в `app/actions.ts`) досі робила прямий `fetch(process.env.N8N_WEBHOOK_URL!, ...)` поза виділеним клієнт-модулем, без таймауту й повторів, і передавала весь об'єкт `lead` (включно з IP, user agent) у payload. Переписано на виклик через `lib/n8n/client.ts` (`callN8nWorkflow`), обгорнуто в `after()`, дані звужено до мінімуму (`leadId`, `company`, `source`). Це і є той шматок, який скіл не міг «дописати сам», бо в прогоні B агент не бачив і не чіпав старий код форми лідів — його довелось довести до контракту вручну, саме так, як передбачає інструкція.
- Ключі контракту в `.env.example`: перевірено — `N8N_WEBHOOK_URL` виправлено на `/webhook/lead-created` (без `/webhook-test/`), додано `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET` (усі `change-me-…`), `APP_BASE_URL` (локальна адреса)
- `npm run lint`, `npm run build` на гілці: обидва чисті, 0 попереджень/помилок
- `check-contract.mjs` на фінальному коді (0 FAIL, код виходу 0):

C1 PASS — тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example
C2 PASS — жодна змінна N8N_* не має префіксу NEXT_PUBLIC_
C3 PASS — прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts
C4 PASS — виклик n8n використовує AbortSignal.timeout
C5 PASS — колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual

0 FAIL
exit=0

- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці: `POST /webhook/quote-request -> 202 in 6 ms auth=ok idempotency=new`, колбек `-> 202 in 373 ms (try 1/3)`, сторінка `/quotes/quote_0001` показала «Кошторис готовий» з кнопкою «Завантажити кошторис». Додатково перевірено й стару форму заявки (`/`): `POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new` — та сама «знахідка №1» із Setup (тестовий URL, відсутність відповіді на реальний виклик) тепер повністю усунена
- Рядок у `docs/n8n-integrations.md`: не додавався (рекомендований, не оцінюється крок; можна додати пізніше)

## Висновок

Скіл `integrating-n8n-webhooks` дав кардинальну, кількісно виміряну різницю: без скіла агент повторив загальну архітектуру наявного коду проєкту, але не відтворив жодного специфічного пункту контракту команди (HMAC-підпис замість `===`, ідемпотентність, таймаути й повтори, окремий `lib/n8n/client.ts`, сирий текст тіла до перевірки підпису) — результат: `check-contract.mjs` дав 4 FAIL, а функціонально фіча одразу зламалась на реалістично захищеному n8n-сервері (403, бо не було заголовка авторизації). Зі скілом агент відтворив контракт практично ідеально (0 FAIL, самостійно провів наскрізне тестування, знайшов і виправив власний баг з ідемпотентністю, перевірив кілька edge cases безпеки) і навіть виправив стару, успадковану помилку (тестовий URL у `.env.example`), яку скіл лише документує як приклад типової пастки. Під час прогону B виявлено слабкість власного скрипта `check-contract.mjs`: перевірки C3-C5 жорстко прив'язані до конкретних шляхів файлів (`lib/n8n/client.ts`, `app/api/n8n/[event]/route.ts`) і дають хибний PASS/непоказову причину FAIL, якщо агент (як у прогоні A) назвав файли інакше — цю слабкість варто виправити в скрипті окремим комітом.