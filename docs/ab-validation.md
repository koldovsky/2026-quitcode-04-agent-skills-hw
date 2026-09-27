# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

- **Інструмент і версія:** Claude Code (desktop app)
- **Модель і рівень міркування (effort), однакові в обох прогонах:** Sonnet 5, high
- **Код:** BASE = `b1d587c` (коміт після Task C: три скіли й виправлення Task A, ще без `/quotes` і
  змін у виклику n8n) · скіл `integrating-n8n-webhooks` для копії B — з того самого коміту (HEAD на
  момент копіювання)
- **Копії:** `D:\Work\Github\leaddesk-ab-a` (без жодного скіла), `D:\Work\Github\leaddesk-ab-b`
  (лише `integrating-n8n-webhooks`); у кожній — коміт `start` з тегом `base`
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`,
  `.github/` і всі скіли (у B повернуто лише `integrating-n8n-webhooks`). Перевірено:
  `find … -name SKILL.md` → рівно один файл, у B; `ls -A | grep -xE 'tools|materials|docs|README.md|.coderabbit.yaml|.github'`
  → «no hints - ok» в обох; `grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key"` по копії A →
  «no contract - ok».
- **Особисті копії скіла:** `~/.claude/skills/` містить лише один нерелевантний загальний скіл
  `find-skills` (пошук/встановлення скілів, не про n8n) — не видалявся (це глобальне налаштування
  користувача поза цим репозиторієм, і він ніяк не описує контракт n8n чи webhook); `~/.cursor/skills`,
  `~/.agents/skills` — не існують; `~/.codex/skills` — існує, порожній. Отже прогін A не отримав
  жодної підказки про сам контракт n8n через особисті скіли.
- **Запит:** `materials/ab-task.md` без змін, нова сесія на кожен прогін. Обидва прогони: агент не
  зупинявся з питанням і не просив прочитати щось поза текою копії — уточнення «Роби, як вважаєш
  правильним» не знадобилось жодного разу.
- **Мок, однаковий для обох** (з робочого репозиторію, значення секретів згенеровані один раз і
  використані в обох копіях):
  `node --env-file=.env.local tools/mock-n8n.mjs --port <5679|5680> --mode respond-202 --delay 5000`
  з `N8N_WEBHOOK_TOKEN`/`N8N_CALLBACK_SECRET` — тими самими в обох `.env.local`.
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`, на
  копії A): 3 FAIL — `C1` (тестовий URL у `.env.example`), `C3` і `C5` (прямий `fetch` у
  `app/actions.ts` поза `lib/n8n/`, без таймауту). Це старий код (той самий, що на `main`), в оцінку
  прогонів не йде.
- **Побічна знахідка:** під час підготовки копій виявилось, що мій власний підготовчий `npm install`
  у щойно ініціалізованих копіях (крок, який виконується **після** тегу `base`) перезаписував
  `package-lock.json` — та сама нормалізація метаданих (`"libc": ["glibc"]`), що траплялась і в
  Task A. Це не робота агента; перед кожним прогоном я звіряв і відкочував `package-lock.json` до
  стану `base`, щоб діф відображав лише зміни агента.

## A — без скіла

- Які скіли бачив агент (окремий запуск, перед прогоном): жодного проєктного скіла — «Проєктних
  скілів у `.claude/skills/` не знайдено... Загальні (Anthropic/системні) скіли...» (лише глобальні).
- Що зробив агент — своїми словами: дослідив структуру проєкту й документацію Next.js в
  `node_modules`, додав сторінку `/quotes/new` з формою, Server Action `requestQuote`, ендпоінт
  колбеку `app/api/quotes/[id]/callback/route.ts` і сторінку статусу `/quotes/[id]` з періодичним
  опитуванням. Сам перевірив у вбудованому браузері весь цикл: порожня форма, валідна відправка,
  колбек з неправильним і правильним токеном, оновлення сторінки без перезавантаження.
- Звідки агент узяв домовленості: **загальні знання й документація Next.js** (`node_modules/next/dist/docs`) —
  жодних специфічних для команди рішень (HMAC-підпис, `idempotency-key`, заголовок `x-n8n-token`,
  window на replay) агент не застосував, бо ніде про них не міг дізнатись: винайшов власну, по-своєму
  логічну, але нестандартну схему — одноразовий `callbackToken` (UUID) на кожен запит, що
  повертається в тілі колбеку як `Authorization: Bearer <token>`.
- Запитання агента і фінальна відповідь: не зупинявся, нічого не питав, не просив прочитати щось
  поза текою копії.
- Змінені файли (`git diff --cached --stat base`, після відкату шуму `package-lock.json`): 15 файлів,
  +487/-6. Діф: `docs/ab/a-without-skill.diff`.
- Змінні середовища, які додав агент: `N8N_QUOTE_WEBHOOK_URL` (повний URL з шляхом події, за
  зразком уже наявного `N8N_WEBHOOK_URL`, і так само з тестовим шляхом `/webhook-test/quote-request`
  прямо в `.env.example`), `APP_BASE_URL`. Жодного токена/секрету — авторизація повністю на
  одноразовому `callbackToken` у тілі, без статичних env-змінних.
- `check-contract.mjs --root ../leaddesk-ab-a --changed-since base`:
  ```
  [C1] no test webhook URL (/webhook-test/) outside .env.local: FAIL
    .env.example:6 — test webhook URL (/webhook-test/) outside .env.local
    .env.example:10 — test webhook URL (/webhook-test/) outside .env.local
  [C2] no NEXT_PUBLIC_-prefixed N8N_* variable: PASS
  [C3] n8n calls confined to lib/n8n/: FAIL
    app/quotes/actions.ts:35 — call to n8n outside lib/n8n/ (should live in one server-only module)
  [C4] lib/n8n module starts with import "server-only": PASS (nothing to check yet — no matching file in this root)
  [C5] fetch() to n8n has AbortSignal.timeout(...): FAIL
    app/quotes/actions.ts:35 — fetch() to n8n without AbortSignal.timeout(...)
  [C6] callback route reads raw body before JSON-parsing it: PASS (nothing to check yet — no matching file in this root)
  [C7] callback signature compared via crypto.timingSafeEqual: PASS (nothing to check yet — no matching file in this root)
  [C8] no secret/signature values in console logs: PASS

  4 FAIL(s)
  ```
  Примітка щодо C5: агент **таки** обмежив виклик по часу — `AbortController` + `setTimeout(10000)`,
  просто не тим ідіомом (`AbortSignal.timeout(...)`), який шукає моя перевірка; сам факт таймауту
  присутній, це чесна межа мого статичного чекера, не подвійний рахунок проти агента. Найважливіше,
  чого чекер **не** зловив (бо шукає callback-роут лише за шляхом `api/n8n/`, якого тут нема): виклик
  `fetch` у `app/quotes/actions.ts` виконується синхронно **всередині** Server Action, до `redirect`,
  і його результат (`await fetch(...)`) **ніде не перевіряється** — ні статус, ні `.ok`. Це
  відтворює рівно ту саму мовчазну помилку, яку ми спостерігали в Task 0.
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  [mock-n8n] POST /webhook/quote-request -> 403 in 18 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 347 B sha256=b825a28e...
  ```
  Заголовка `x-n8n-token` немає взагалі (агент не знав про нього) → мок одразу відхилив запит з 403,
  **колбек так і не був відправлений** — воркфлоу ніколи не «запускався».
- Час від «Надіслати» до відповіді форми: швидко (менше секунди; `POST /quotes/new` → `200` з
  редіректом одразу, як і мало бути — форма й справді не чекає на `fetch`, хоч і не з тієї причини,
  що очікувалась: просто `fetch` сам завершився за 18 мс, помилково інтерпретованих кодом як успіх).
- Що показала `/quotes/<id>`: **назавжди** «Готуємо кошторис… Зазвичай це займає 40–90 секунд.
  Сторінка оновиться автоматично» — і оновлюватиметься нескінченно, бо колбек ніколи не прийде.
  Користувач ніколи не дізнається, що щось пішло не так.
- Журнал сервера: жодних тіл запитів чи персональних даних (email/company/опис ніде не залоговані) —
  але й жодного повідомлення про помилку 403 теж немає: `console.error` спрацював би лише при
  мережевій помилці (кинутому винятку), а не при отриманій, але не перевіреній відповіді 403.

## B — зі скілом

- Які скіли бачив агент (окремий запуск, перед прогоном): один проєктний —
  `integrating-n8n-webhooks — контракт для зв'язку Next.js з n8n-воркфлоу (вебхуки, колбеки, підписані
  запити). Використовується для форм/дій, що тригерять зовнішні воркфлоу.` — плюс перелічені загальні
  скіли; агент сам відзначив, що для цього проєкту найрелевантніший саме він.
- **Чи викликав агент скіл:** дуже сильні непрямі докази — точна структура (`lib/n8n/client.ts` з
  `import "server-only"`, `app/api/n8n/[event]/route.ts`), точні назви env-змінних контракту
  (`N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`), явний запуск скрипта скіла
  (`check-contract.mjs`) із власним звітом «passes all 8 contract checks», і навіть створення
  `docs/n8n-integrations.md` — рекомендованої, не обов'язкової практики зі скіла — все це специфічне
  для файлів скіла, а не загальновідоме. Застереження чесності: у наданому мені уривку транскрипту
  немає буквального рядка виклику інструмента `Skill` (як був явно видно в Task B, «Ran skill
  /integrating-n8n-webhooks»); якщо потрібна стовідсоткова певність — варто перевірити повний журнал
  сесії B на такий рядок. Судячи з усього іншого, це найімовірніше значить, що скіл був прочитаний
  (through context/tool calls not fully captured in the pasted summary), а не що модель випадково
  вгадала весь контракт.
- Запитання агента і фінальна відповідь: не зупинявся з питаннями. Під час прибирання тестових
  процесів **помилково зупинив чужий процес** (`node tools/mock-n8n.mjs`, PID у робочому
  репозиторії, не запущений ним) — сам це виявив, чесно повідомив і не чіпав більше нічого
  (підтвердив, що dev-сервер користувача на 3000 не зачепив). Це реальний інцидент ізоляції процесів
  на хості, **не** порушення «не читай поза текою копії»: агент лише побачив зайнятий порт через
  системний список процесів, не відкривав і не читав файли робочого репозиторію.
- Змінені файли (`git diff --cached --stat base`): 12 файлів, +627/-1. Діф: `docs/ab/b-with-skill.diff`.
- Змінні середовища, які додав агент: `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`,
  `N8N_CALLBACK_SECRET`, `APP_BASE_URL` — рівно ті самі назви й семантика, що в
  `references/env-and-request.md` скіла.
- `check-contract.mjs --root ../leaddesk-ab-b --changed-since base`:
  ```
  [C1] no test webhook URL (/webhook-test/) outside .env.local: FAIL
    .env.example:6 — test webhook URL (/webhook-test/) outside .env.local
  [C2] no NEXT_PUBLIC_-prefixed N8N_* variable: PASS
  [C3] n8n calls confined to lib/n8n/: PASS
  [C4] lib/n8n module starts with import "server-only": PASS
  [C5] fetch() to n8n has AbortSignal.timeout(...): PASS
  [C6] callback route reads raw body before JSON-parsing it: PASS
  [C7] callback signature compared via crypto.timingSafeEqual: PASS
  [C8] no secret/signature values in console logs: PASS

  1 FAIL(s)
  ```
  Цей 1 FAIL — рядок 6 `.env.example`, **той самий передіснуючий** тестовий URL старого потоку
  `lead-created` (не торканий у цьому прогоні); файл змінився (агент дописав у нього нові рядки), тому
  файловий рівень `--changed-since` включає його цілком, але порушення на рядку 6 — не робота агента
  цього прогону (сам агент це й написав у своєму підсумку). Реальних нових порушень — **0**.
- Журнал мока (форма → колбек → `/quotes/<id>`):
  ```
  [mock-n8n] header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  [mock-n8n] POST /webhook/quote-request -> 202 in 16 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 328 B
  [mock-n8n] workflow ...running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] callback POST http://localhost:3003/api/n8n/quote-request -> 202 in 222 ms (try 1/3) event=quote-request.completed body 356 B
  ```
  Усі очікувані заголовки присутні (`idempotency-key`, `x-correlation-id`, `x-n8n-token`); колбек
  дійшов і прийнятий з 202.
- Час від «Надіслати» до відповіді форми: миттєво (виклик n8n — у `after()`, тобто взагалі поза
  циклом відповіді користувачу; `POST /quotes/new` завершився негайно редіректом).
- Що показала `/quotes/<id>`: спершу «Готується», після ~5 с (затримка мока) автоматично — «Готово.
  Кошторис готовий.» з робочим посиланням «Відкрити PDF».
- Журнал сервера: жодних тіл, email, телефонів, токенів чи підписів — лише структуровані рядки на
  кшталт `n8n:quote-request accepted { correlationId, attempt, status }` і
  `n8n:quote-request callback processed { status: 'completed' }`.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — (проєктних скілів немає) | Дуже ймовірно так (непрямі докази сильні; буквального рядка `Skill` у наданому уривку нема — див. застереження вище) |
| `check-contract.mjs` на коді прогону | 4 FAIL: C1(×2), C3, C5 — усі реальні | 1 FAIL — той самий передіснуючий рядок бази, 0 нових |
| URL вебхука | `/webhook-test/quote-request` записано в `.env.example` | `/webhook` (production) в `.env.example`; сам мок отримав запит на `/webhook/quote-request` |
| `auth=` / `idempotency=` у журналі мока | `auth=missing`, ідемпотентності немає (заголовок відсутній) | `auth=ok`, `idempotency=new` |
| Колбек дійшов; код відповіді застосунку | Колбек **не був відправлений** (вебхук відхилено з 403 ще до старту воркфлоу) | Так, `202` |
| Час відповіді форми | Швидко (без наміру — просто `fetch` завершився швидко, а помилка проігнорована) | Миттєво (навмисно, через `after()`) |
| Персональні дані в журналі сервера | Немає, але й немає сигналу про помилку | Немає; чисті структуровані події |
| Змінених файлів | 15 | 12 |
| Запитання агента | Жодних; поза текою копії нічого не читав | Жодних; поза текою копії файлів не читав (лише побачив зайнятий порт на хості й помилково зупинив чужий процес) |

## Перенесення прогону B у гілку (фіча)

- Як переносили: `git apply --3way docs/ab/b-with-skill.diff` з кореня робочого репозиторію (гілка —
  на коді BASE). Застосувалось чисто (частина файлів — через fallback на пряме застосування через
  розбіжності `LF`/`CRLF`, без конфліктів і без файлів `.orig`). Коміти:
  `fa1297a` (фіча як є з прогону B), `2a48303` (ручне доведення — нижче), `07f08e2` (діфи в
  `docs/ab/`).
- Що довелось доробити руками після перенесення (і чому скіл цього не дав): **весь** новий код
  прогону B пройшов контракт одразу (1 FAIL — старий, не новий). Єдине, що довелось доробити руками, —
  **не** частина нової фічі, а стара, ще з main: прямий виклик n8n у `submitLead` (`app/actions.ts`,
  потік `lead-created`) все ще не проходив через `lib/n8n/client.ts`, все ще мав тестовий URL у
  `.env.example`, все ще не перевіряв статус відповіді (той самий баг Task 0) — просто тому, що запит
  прогону B стосувався лише «запиту на кошторис», і агент цілком слушно не займався переписуванням
  непов'язаного, невитребуваного коду. Це і є межа скіла: він формує **новий** код за контрактом, але
  не ретроактивно виправляє старий код, якого задача не торкається. Виправлено окремим комітом:
  `submitLead` тепер викликає `sendN8nEvent()` з мінімальним payload (без IP/user-agent/`rawPayload`),
  через `after()`, з `idempotencyKey`/`correlationId`; стару змінну `N8N_WEBHOOK_URL` прибрано на
  користь спільної `N8N_WEBHOOK_BASE_URL`.
- Ключі контракту в `.env.example`: `N8N_WEBHOOK_TOKEN=change-me-webhook-token`,
  `N8N_CALLBACK_SECRET=change-me-callback-secret`, `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`
  (виключно production-шлях, `/webhook-test/` відсутній). Реальні (тестові, для мока) значення — лише
  в `.env.local`, згенеровані `node -e "console.log(require('node:crypto').randomBytes(...).toString('hex'))"`.
- `npm run lint`, `npm run build` на гілці: обидва чисті.
- `check-contract.mjs` на фінальному коді (без прапорця, увесь код):
  ```
  [C1] no test webhook URL (/webhook-test/) outside .env.local: PASS
  [C2] no NEXT_PUBLIC_-prefixed N8N_* variable: PASS
  [C3] n8n calls confined to lib/n8n/: PASS
  [C4] lib/n8n module starts with import "server-only": PASS
  [C5] fetch() to n8n has AbortSignal.timeout(...): PASS
  [C6] callback route reads raw body before JSON-parsing it: PASS
  [C7] callback signature compared via crypto.timingSafeEqual: PASS
  [C8] no secret/signature values in console logs: PASS

  0 FAIL
  ```
- Сценарій «форма → колбек → `/quotes/<id>`» ще раз, на самій гілці (порт 3004, окремий мок на
  5678): `POST /webhook/quote-request -> 202 in 12 ms auth=ok idempotency=new`, колбек через ~5с —
  `202`, сторінка `/quotes/quote_0001` показала «Готово» з посиланням «Відкрити PDF». Заодно
  перевірено виправлений потік `lead-created`: `POST /webhook/lead-created -> 202 in 2 ms auth=ok
  idempotency=new`, у журналі сервера — чистий рядок `n8n:lead-created accepted { correlationId,
  attempt, status }`, жодних email/імені/тексту повідомлення.
- Рядок у `docs/n8n-integrations.md`: створено самим агентом прогону B (рекомендована, не оцінювана
  практика зі скіла) — залишено як є, з одним рядком для `quote-request`.

## Висновок

Скіл змінив результат кардинально, а не в дрібницях. Без нього агент написав правдоподібний, охайно
протестований, але **несумісний із командним контрактом і функціонально зламаний** код: власна схема
автентифікації колбеку (яку стандартний мок n8n не годен виконати — `403 auth=missing`), синхронний
виклик усередині Server Action без перевірки статусу відповіді — це відтворює точнісінько ту саму
мовчазну помилку, яку команда вперше зустріла в Task 0 з формою заявки. Домовленостей команди (заголовок
`x-n8n-token`, HMAC-підпис, `idempotency-key`, вікно проти replay) агент без скіла не взяв **ніде** —
у копії A таких відомостей просто не було, і він розумно, але даремно винайшов свою версію. Зі скілом
той самий запит, та сама модель — і результат до дрібниць збігається з контрактом: правильний модуль,
правильні заголовки, HMAC через `timingSafeEqual`, ідемпотентність, `after()`, і навіть самостійний
запуск `check-contract.mjs` для самоперевірки. Доробляти після прогону B довелось рівно одну річ —
поширити контракт на старий, **не пов'язаний із запитом** код (`lead-created`), і це очікувано: скіл
формує те, що агент пише у відповідь на задачу, а не заднім числом переписує весь застосунок. Зі скіла
нічого виправляти за результатами цього прогону не довелось — він відпрацював саме так, як задумано.
