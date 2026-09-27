# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

**A — без скіла, B — зі скілом, дві пари прогонів: A1/A2 і B1/B2, потім A3/B3 — разом по 3 на кожну руку.** Усі числа й цитати нижче взято з файлів у
[`docs/evidence/task-d/`](evidence/task-d/). Твердження про поведінку агента перевірено grep'ом по
`transcript.jsonl` того самого прогону (`report.txt` поруч, генерує `docs/evidence/bin/session-report.mjs`).

> **Як читати посилання на докази.** Щоб PR умістився в ліміт CodeRabbit, дрібні файли кожного прогону
> зібрано в один `summary.md` тієї самої теки (`docs/evidence/bin/pack-evidence.mjs`). Файл, названий нижче
> (`report.txt`, `scenario.txt`, `diffstat.txt`…), — це розділ `summary.md` з таким самим заголовком, наприклад
> `` ## `task-d/run-a1/report.txt` ``. Оригінали й сирі `transcript.jsonl` лежать у
> `docs/evidence/raw-evidence.tar.gz`: 167 файлів першої пари прогонів і решти задач, 36 — другої пари. Повний перелік змінених файлів гілки — таблиця на початку
> [`docs/verification.md`](verification.md#усі-змінені-файли-гілки).

- **Інструмент і версія:** Claude Code 2.1.282, headless (`claude -p`, stream-json).
- **Модель і рівень міркування, однакові в усіх 4 прогонах:** `opus` → `claude-opus-5-5` (поле `model`
  в init кожного транскрипту), `--effort high`.
- **Код:** BASE = `8c6fbeb`. Це коміт після Task C: три скіли й виправлення Task A, ще без `/quotes` і змін у
  виклику n8n. Теку скіла для копій B взято з HEAD на момент створення копій, тобто з `2f4fa4f`.
  Цей коміт після BASE змінив лише `docs/`, тож тека скіла в ньому та сама, що в `8c6fbeb`
  (`git diff 8c6fbeb 2f4fa4f -- .claude` порожній). Скіл у копіях — версії 0.1.0.
- **Копії:** `~/leaddesk-ab/leaddesk-ab-{a1,a2,b1,b2}`. У кожній є коміт `start` з тегом `base`,
  `node_modules` склоновано з робочого репозиторію (`cp -Rc`, без `npm install` з мережі). **Відхилення від
  `../leaddesk-ab-a`:** копії лежать у `~/leaddesk-ab/`, у шляху без пробілів. Так правило deny закриває агенту
  читання всього `~/Desktop`, тобто робочого репозиторію, записки, мока й бази знань (див. «Обв'язка»).
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`
  і всі скіли. У B повернуто лише `integrating-n8n-webhooks`. `git archive` з exclude-pathspec, без `rm`.
  Перевірено в [`isolation.txt`](evidence/task-d/summary.md):
  - `find … -name SKILL.md` дає рівно 2 рядки, `leaddesk-ab-b{1,2}/.claude/skills/integrating-n8n-webhooks/SKILL.md`;
  - «no hints - ok»; «no contract - ok» для a1 і a2;
  - `diff -rq a1 b1` → `Only in leaddesk-ab-b1: .claude`;
  - у документації Next.js в `node_modules` 0 файлів зі словом «n8n».
- **Особисті копії скіла:** `~/.claude/skills` містить 14 чужих скілів, серед них n8n немає. `~/.agents/skills`
  і `~/.codex/skills` без n8n, `~/.cursor/skills` немає. `--setting-sources project` особисті скіли не
  вантажить: у `/context` кожної копії є лише `Built-in` і, у B, `Project`.
- **Запит:** [`prompt.txt`](evidence/task-d/summary.md), `cmp` з `materials/ab-task.md:14-18` показує збіг байт у
  байт, sha256 `498a125e…` однаковий у `meta.txt` усіх 4 прогонів. Кожен прогін — нова сесія.
- **Відповідь на уточнення:** жоден агент не зупинився з питанням. «Роби, як вважаєш правильним» не знадобилось.
- **Мок, однаковий для всіх** (з робочого репозиторію, `.env.local` копії):
  `node --env-file=.env.local <repo>/tools/mock-n8n.mjs --mode respond-202 --delay 5000`, без `--callback-url`.
  Сценарій один скрипт для всіх: [`scenario.sh`](evidence/task-d/scenario.sh).
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код):
  3 PASS, **8 FAIL** (C1, C3, C4, C5, C6, C7, C8, C15), 4 N/A, однаково в A і B
  ([`baseline-a1.txt`](evidence/task-d/summary.md) = [`baseline-b1.txt`](evidence/task-d/summary.md)
  з точністю до назви теки). Це старий виклик n8n з форми ліда, в оцінку прогонів він не йде: прогони
  перевірено з `--changed-since base`.

### Обв'язка сесій і атака на неї

[`docs/evidence/bin/run-ab-session.sh`](evidence/bin/run-ab-session.sh), однакові прапорці для всіх 4:
- `--setting-sources project --strict-mcp-config` — без особистих налаштувань, хуків і MCP;
- `--permission-mode acceptEdits --permission-prompts none` — **без** `bypassPermissions`: класифікатор
  auto mode заборонив такий запуск ще в Task A;
- allowlist: `Skill, Read, Grep, Glob, Edit, Write, Bash(npm run lint), Bash(npm run build),
  Bash(npx tsc --noEmit), Bash(git status*), Bash(git diff*), Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*)`
  (в A цього файлу немає, тож правило однакове, а корисне лише в B);
- deny: `WebFetch, WebSearch, NotebookEdit`, `Read(//Users/…/Desktop/**)`, `Read(~/.claude/**)`, `Read(//private/tmp/**)`,
  `Read(//tmp/**)`, `Read(//private/var/folders/**)`.

**Чи тримає deny.** Пробна сесія з тими самими прапорцями ([`probe/`](evidence/task-d/probe/)) пробувала прочитати
робоче репо дев'ятьма способами. Результат за `tool_result` у транскрипті, а не з відповіді агента:
дозволено лише читання `inside.txt` у власній теці. Відхилено 8 з 8: `Read` README, `Bash head`,
`Bash cat ../../Desktop/…` (відносний шлях теж перехоплено), `Grep`, `Glob`, `Read ~/.claude/CLAUDE.md`,
`ls ~/Desktop`, `git -C <repo> log`. У 4 прогонах шляхів поза копією не було. Було лише `/dev/null` і рядок
`/quotes/[id]` як аргумент пошуку (`report.txt`, «paths outside work dir»). Жоден агент не просився в
робочий репозиторій, тож відмовляти не довелося.

**Обмеження, однакове для обох рук.** Claude Code вантажить `CLAUDE.md` з батьківських тек. Від
`~/leaddesk-ab/…` він доходить до `~/.claude/CLAUDE.md` і показує його в `/context` як «Project»-пам'ять
(687 токенів, про semble і RTK). grep по ньому й по `~/.claude/RTK.md` на
`n8n|webhook|hmac|idempotency|timingSafe|callback` дає 0 збігів. У Task A/B було так само. Перенести копії в
`/Users/Shared`, де такого предка немає, заборонив класифікатор («Modify Shared Resources»), і я цього не
обходив.

## A — без скіла

- **Які скіли бачив агент** ([`context-a1.txt`](evidence/task-d/summary.md), `context-a2.txt`): 16 `Built-in`, проєктних
  немає. `init.skills` у транскриптах — інший перелік: 21 вбудований скіл, склад вбудованих у двох джерелах
  різний. Обидва джерела підтверджують суттєве: в A немає `integrating-n8n-webhooks` і жодного проєктного
  скіла, а в B (нижче) він є в обох.
- **Чи викликав скіл:** ні, `Skill`-викликів 0 і читань `.claude/skills/**` 0. У a1 є
  `Glob {.claude/**/*,tools/**/*,.agents/**/*}`: агент шукав скіли й інструменти, але нічого не знайшов.
- **Що зробив агент.** Обидва повтори сходяться на одній архітектурі:
  - `/quotes/new` — форма з `useActionState`, бюджет — `<select>` з варіантів форми ліда;
  - Server Action зберігає запит і робить `redirect` на `/quotes/<id>`;
  - власний ендпоінт `POST /api/quotes/[id]/callback`;
  - власна схема захисту колбека: одноразовий токен на запит, у базі лише його `sha256`, n8n повертає
    його як `Authorization: Bearer …`, порівняння через `timingSafeEqual` у `lib/quotes.ts` / `lib/quote-callback.ts`;
  - вузол Webhook, на думку агента, має бути в режимі «Respond: Immediately»;
  - сторінка статусу оновлюється кожні 5 с.

  Різниця між повторами: a1 кличе n8n в `after()`, a2 чекає `fetch` у самій дії до `redirect`.
- **Що агент прочитав** (за `report.txt`, «files read»): контракту команди A не бачив ніде.
  - З документації Next.js у `node_modules`: `after.md` (обидва), `server-actions.md` і `route.md` (a1),
    `15-route-handlers.md` (a2). Порядок у транскриптах (номер виклику інструмента): в a1 `Read after.md` — 19-й,
    перший `after()` у коді — 35-й; `Grep RouteContext` по `route.md` — 23-й, перше використання — 42-й. В a2
    `Grep RouteContext` по `15-route-handlers.md` — 17-й, перше використання — 35-й. Тобто ці сторінки агент
    бачив до того, як написав відповідний код.
  - З наявного коду: `lib/lead-form.ts` (варіанти бюджету), `lib/db.ts`, `app/actions.ts`.
  - Схема токена, хешування, `AbortSignal.timeout` і випадкові UUID: у зафіксованих читаннях джерела цих рішень
    не знайдено, у копії такого немає. Ймовірно, агент використав базові знання. Транскрипт показує, що агент
    прочитав, але не доводить, звідки взялося рішення.
- **Запитання агента й фінальна відповідь:**
  - a1 фінальної відповіді не дав. Код дописано, `npm run lint` і `npm run build` пройшли (у транскрипті є
    таблиця маршрутів з `/quotes/new`, `/quotes/[id]`, `/api/quotes/[id]/callback`). Потім агент хотів
    написати e2e-скрипт у свій scratchpad `/private/tmp/…`, мій deny не дав («File is covered by a Read deny
    rule»). Наступним повідомленням стало «You've hit your weekly limit · resets 11am (Europe/Kiev)», exit 1:
    вичерпано тижневий ліміт акаунта. Прогін зараховано як повний за кодом.
  - a2: «**Код жодного разу не запускався:** `tsc`, `npm run lint` і `npm run build` у цій сесії автоматично
    заблоковано». Перевірено в транскрипті: відхилено `npx tsc --noEmit -p <абсолютний шлях>` і
    `npm run lint --prefix <абсолютний шлях>`, бо такі форми не збігаються з allowlist. `npm run lint` без
    `--prefix` a2 не пробував. Обв'язка тут не асиметрична: у b1/b2 і a1 `npm run lint` / `npm run build`
    пройшли, бо агенти викликали їх як є.
- **Змінені файли й діфи:**
  - a1: 12 файлів, +499/−1 ([`diffstat`](evidence/task-d/run-a1/summary.md)), діф
    [`docs/ab/a-without-skill.diff`](ab/a-without-skill.diff);
  - a2: 11 файлів, +507/−1, діф [`docs/ab/a-without-skill-run2.diff`](ab/a-without-skill-run2.diff).
- **Змінні середовища:**
  - a1: `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request`, `APP_BASE_URL`;
  - a2: `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/`**`webhook-test`**`/quote-request`, `APP_URL`.

  Токена для n8n і секрету колбека немає в обох. У `.env.local` для мока я додав `N8N_WEBHOOK_TOKEN` і
  `N8N_CALLBACK_SECRET`: цього вимагає n8n клієнта з Header Auth і підписом.
- **`check-contract.mjs --changed-since base`** ([a1](evidence/task-d/run-a1/summary.md),
  [a2](evidence/task-d/run-a2/summary.md)):

  | | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 | разом |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | a1 | PASS | PASS | FAIL | FAIL | PASS | FAIL | FAIL | PASS | FAIL | FAIL | FAIL | FAIL | PASS | PASS | FAIL | 6 PASS · **9 FAIL** |
  | a2 | **FAIL** | PASS | FAIL | FAIL | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | FAIL | 4 PASS · **11 FAIL** |

  Для C10 скрипт пише «no timingSafeEqual», і для A це неточно: `timingSafeEqual` у них є, але в
  `lib/`, а C10 дивиться лише у файл роуту. Сам FAIL C10 від цього не змінюється: «no HMAC computed»,
  підпису тіла немає зовсім.
- **Журнал мока** ([a1 scenario.txt](evidence/task-d/run-a1/summary.md), [a2](evidence/task-d/run-a2/summary.md)):
  ```
  a1  POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 347 B
  a2  POST /webhook-test/quote-request -> 404 in 1 ms  | body 359 B        # тестовий URL з .env.example агента
  a2* POST /webhook/quote-request -> 403 in 1 ms auth=missing              # * те саме з виправленим URL у .env.local
  ```
  Колбека немає ні в одному A: мок його не шле, бо запит відхилено. Щоб перевірити роут A окремо,
  матриця `send-signed-callback.mjs` послала йому колбеки, підписані за контрактом
  ([a2*](evidence/task-d/run-a2/summary.md)): «valid signed callback expected 202,
  got 401», разом 5/10. Отже навіть із вимкненим Header Auth справжній n8n за контрактом до A не достукається:
  роут чекає власний Bearer-токен, а не HMAC.
- **Час від «Надіслати» до відповіді форми** (no-JS POST, `curl time_total`): a1 **0,135 с** (303), a2 **0,226 с**
  (303). a2 довше, бо чекає n8n у дії (C8). Мок відповідає за 1 мс, а зі справжнім n8n a2 чекав би відповіді
  вебхука, до таймауту 10 с.
- **Що показала `/quotes/<id>`:** в обох «Не вдалося підготувати кошторис». В a1 ще «Ваш запит збережено —
  менеджер підготує кошторис вручну».
- **Журнал сервера:** рядків з email, компанією чи описом із форми 0. Є
  `Failed to start quote workflow for <id> Error: n8n responded with 403` (a1) і
  `n8n rejected quote <id>: HTTP 404` (a2). Тіл, токенів і підписів немає.

## B — зі скілом

- **Які скіли бачив агент** ([`context-b1.txt`](evidence/task-d/summary.md), `context-b2.txt`):
  `integrating-n8n-webhooks | Project | ~340` і ті самі 16 `Built-in`. `init.skills` у транскриптах b1 і b2 —
  `integrating-n8n-webhooks` і ті самі 21 вбудований, що в A.
- **Чи викликав агент скіл:** так, в обох повторах, сам, без назви скіла в запиті.
  - b1: `Skill integrating-n8n-webhooks`, потім `references/code-templates.md`, `contract.md`, `n8n-setup.md`,
    `response-modes.md` і перегляд `scripts/`.
  - b2: `Skill`, `code-templates.md`, `contract.md`, `n8n-setup.md` і `scripts/check-contract.mjs`.
  - Обидва запустили `check-contract.mjs --changed-since HEAD`, b1 ще й повний прогін (7 FAIL, усі в старій
    формі ліда), і відповіли, що старий код не чіпали, бо це поза задачею.
- **Що зробив агент** (обидва повтори майже однаково, за шаблонами скіла):
  - `lib/n8n/client.ts` з `import "server-only"`, таймаутом 10 с, двома повторами й заголовками контракту;
  - `requestQuote`: валідація, запис `queued`, `redirect`, n8n в `after()`, статус `sent`/`failed` лише зі стану `queued`;
  - `app/api/n8n/[event]/route.ts` за 11 кроками контракту;
  - `/quotes/[id]` з автооновленням кожні 5 с;
  - сховище в `lib/db.ts`, 4 змінні в `.env.example`, `docs/n8n-integrations.md`.
- **Запитання й фінальна відповідь** (скорочено). Питань не було. Обидва агенти самі назвали, що лишилося
  неперевіреним: «Проміжок від запиту до колбеку я ще не проганяв: для цього потрібен `.env.local`, а його
  немає» (b1). Обидва помітили старий виклик n8n у формі ліда (`/webhook-test/`, увесь лід з IP і user agent)
  і запропонували перевести його окремою зміною. b2 додав: «це слід узгодити з власником» воркфлоу.
- **Змінені файли й діфи:**
  - b1: 12 файлів, +609/−1, діф [`docs/ab/b-with-skill.diff`](ab/b-with-skill.diff);
  - b2: 12 файлів, +645/−1, діф [`docs/ab/b-with-skill-run2.diff`](ab/b-with-skill-run2.diff).
- **Змінні середовища:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`, `N8N_WEBHOOK_TOKEN=change-me-…`,
  `N8N_CALLBACK_SECRET=change-me-…`, `APP_BASE_URL=http://127.0.0.1:3000` (обидва).
- **`check-contract.mjs --changed-since base`** ([b1](evidence/task-d/run-b1/summary.md),
  [b2](evidence/task-d/run-b2/summary.md)): C1–C15 усі PASS, **15 PASS · 0 FAIL · 0 N/A**,
  exit 0, в обох.
- **Журнал мока** (b1; у b2 те саме з точністю до часу й id):
  ```
  POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: …,content-type,idempotency-key,…,x-correlation-id,x-n8n-token | body 256 B
  workflow 88b36247-… running for 5000 ms, then callback event=quote-request.completed
  callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 220 ms (try 1/3) event=quote-request.completed body 382 B
  ```
  Матриця `send-signed-callback.mjs` проти роуту — **7/7**: 404, 415, 413, 401 ×4.
- **Час від «Надіслати» до відповіді форми:** b1 **0,135 с**, b2 **0,135 с** (303 на `/quotes/<uuid>`).
- **Що показала `/quotes/<id>`:** до колбека «Готуємо кошторис… Сторінка оновиться сама», після нього «Кошторис
  готовий. Завантажити PDF». У b2 ще бюджет і опис задачі.
- **Журнал сервера:** рядків з email, компанією чи описом із форми 0. n8n-рядки — лише
  `{"n8n":"out"|"in","event",…,"correlationId",…,"status",…,"ms",…}` (b2 ще розмір і sha256 тіла, як дозволяє
  контракт).

## Порівняння

Перша пара — A1/A2 і B1/B2 (скіл v0.1.0). Друга пара, A3 і B3, — розділ «Друга пара» нижче: той самий BASE і
запит, скіл v0.1.3, ширші однакові дозволи на перевірки.

| Що дивимось | A1 | A2 | B1 | B2 | A3 | B3 |
|---|---|---|---|---|---|---|
| Скіл у копії | — | — | v0.1.0 | v0.1.0 | — | v0.1.3 |
| Скіл викликано | — (його немає) | — | **так**, `Skill` + 4 references | **так**, `Skill` + 3 references + `check-contract.mjs` | — | **так**, `Skill` першим викликом + 4 references |
| `check-contract --changed-since base`: FAIL | **9**: C3 C4 C6 C7 C9 C10 C11 C12 C15 | **11**: C1 C3 C4 C6 C7 C8 C9 C10 C11 C12 C15 | **0** | **0** | **9**: ті самі, що в A1 | **0** |
| URL вебхука | `/webhook/` | **`/webhook-test/`** | `/webhook/` | `/webhook/` | `/webhook/` | `/webhook/` |
| `auth=` / `idempotency=` у моку | `missing` / — | 404 до auth; з prod-URL `missing` | `ok` / `new` | `ok` / `new` | `missing` / — | `ok` / `new` |
| Колбек дійшов; код застосунку | ні (403); підписаний колбек не надсилали | ні (404/403); підписаний колбек → 401 (a2\*) | так, **202** | так, **202** | ні (403); підписаний колбек → 401 | так, **202** |
| Сторінка статусу після сценарію | «Не вдалося…» | «Не вдалося…» | «Кошторис готовий» | «Кошторис готовий» | «Не вдалося…» | «Кошторис готовий» |
| Матриця колбека | 5/7 | 5/7; a2\* (prod-URL) з успішними кейсами 5/10 | 7/7 | 7/7 | 5/7; з успішними кейсами 5/10 | 7/7 |
| Час відповіді форми | 0,135 с | 0,226 с (чекає n8n) | 0,135 с | 0,135 с | 0,137 с | 0,135 с |
| Тіла / персональні дані в журналі сервера | немає | немає | немає | немає | немає | немає |
| Email клієнта йде в n8n | так | так | ні (лише `quoteId`, компанія, опис, бюджет) | ні | так | ні |
| Три дефекти з аудиту (`audit-regress`) | не застосовно | не застосовно | **10 FAIL** | **10 FAIL** | не застосовно | **0 FAIL** |
| Змінених файлів | 12 | 11 | 12 | 12 | 11 | 12 |
| `lint` / `build` агент запустив | так / так | ні (форми з `--prefix`/`-p` відхилено) | так / так | так / так | так / так (`--prefix`) | так / так (`--prefix`) |
| `check-contract` агент запустив після змін | — | — | так | так | — | ні (форму з `; echo` відхилено) |
| Запитання агента | — | — | — | — | — | — |
| Ходів · час · вартість | 49 · 280 с · $1.24 (обірвано лімітом) | 46 · 292 с · $1.29 | 45 · 225 с · $1.19 | 40 · 240 с · $1.44 | 55 · 290 с · $1.70 | 44 · 224 с · $1.56 |

«Не застосовно» для A: `audit-regress` шле підписані за контрактом колбеки на `/api/n8n/quote-request`, а роут A
інший і чекає власний токен, тож перевірка зламалася б на контракті раніше, ніж дійшла б до цих дефектів.

Спільне в A і B, отже не заслуга скіла: форма без JS (303 + `redirect`), валідація в дії, випадкові id сторінки
статусу, журнал без персональних даних, автооновлення сторінки. Усе це агент бере з наявного коду
(`lead-form`, `actions.ts`) і з документації Next.js у `node_modules`.

## Друга пара (A3/B3): однакові дозволи на перевірки

**Навіщо.** У першій парі a1 обірвався через ліміт акаунта, а a2 не зміг запустити `lint`/`build`: його форми
команд не збіглися з allowlist. Через це можливості самоперевірки в A і B фактично різнились. Друга пара —
завершений прогін A і B з однаковими й ширшими дозволами на перевірки. Перша пара і її обмеження лишаються як є.

**Що зафіксовано** ([`pair2/`](evidence/task-d/pair2/summary.md), розділи `isolation.txt`, `run-a3.launch.log`,
`run-b3.launch.log`, `context-a3.txt`, `context-b3.txt`, `prompt.txt`):
- **Код:** BASE — той самий `8c6fbeb`. `diff -r` дерев тегу `base` старої копії a1 і нової a3 порожній: друга пара
  стартує з того самого коду, що й перша.
- **Копії:** `~/leaddesk-ab/leaddesk-ab-{a3,b3}`, `git archive` з тими самими виключеннями. `.claude` в a3 немає
  зовсім, у b3 лише `.claude/skills/integrating-n8n-webhooks` з `fea2443`, тобто **v0.1.3** з виправленими
  шаблонами. `diff -rq a3 b3` → `Only in leaddesk-ab-b3: .claude`.
- **Модель і запит:** Claude Code 2.1.282, `opus` → `claude-opus-5-5`, `--effort high`. Запит той самий, sha256
  `498a125e…` у `meta.txt` обох. Обидві сесії стартували одночасно (16:17:26Z) і завершились з exit 0: a3 за 291 с,
  b3 за 226 с (це wall-час з launch-логу; у таблиці — тривалість сесії з `report.txt`, 290 і 224 с).
- **Дозволи, однакові для обох:** та сама обв'язка [`run-ab-session.sh`](evidence/bin/run-ab-session.sh) плюс
  `ALLOW_EXTRA="Bash(npm run lint *),Bash(npm run build *),Bash(npx tsc *)"`, тобто форми з аргументами, які в a2
  відхилялись. Рядок `flags:` у двох launch-логах однаковий. Deny той самий.
- **`.env.local` для мока**, однаково для обох: ключі з `.env.example` копії, значення `change-me-…` замінено
  випадковими, `N8N_WEBHOOK_TOKEN`/`N8N_CALLBACK_SECRET` додано, якщо їх не було. Друкувались лише назви ключів.
- **Скіли в сесії:** `/context` a3 — 16 `Built-in`, проєктних немає; b3 — ті самі 16 і
  `integrating-n8n-webhooks | Project | ~340`. `init.skills`: a3 — 21 вбудований, b3 — ті самі 21 і
  `integrating-n8n-webhooks`.

**A3** ([`run-a3/summary.md`](evidence/task-d/run-a3/summary.md), [`transcript.md`](evidence/task-d/run-a3/transcript.md),
діф [`docs/ab/a-without-skill-run3.diff`](ab/a-without-skill-run3.diff)):
- **Скіл:** `Skill`-викликів 0, читань `.claude/skills/**` 0. 17-й виклик — `Glob {.claude/**/*,tools/**/*,.agents/**/*}`
  → «No files found».
- **Що прочитав:** код проєкту (`app/actions.ts`, `lib/db.ts`, `lib/lead-form.ts`…), `after.md` (22-й виклик) і
  `route.md` (23-й) з документації Next.js. Перший запис коду — 27-й виклик.
- **Що зробив:** та сама архітектура, що в A1/A2. Власний роут `/api/quotes/[id]/callback` з Bearer-токеном на
  запит (у базі хеш), n8n в `after()` з очікуванням підтвердження до 15 с, email клієнта в даних для n8n,
  змінні `N8N_QUOTE_WEBHOOK_URL` (`/webhook/`) і `APP_URL`. 11 файлів, +532/−1.
- **Самоперевірка:** `npm run lint --prefix …` (перший раз помилка, агент виправив, другий пройшов) і
  `npm run build --prefix …` пройшли. Відхилено 3 виклики Bash: цикл `for f in … cat` (2-й), `cd … && ls` по
  документації Next.js (19-й) і `npx next typegen && npx tsc …` (46-й), `typegen` немає в allowlist.
  E2e-скрипт у scratchpad `/private/tmp/…` заблоковано deny на читання, як і в a1. У фінальній відповіді агент
  прямо пише, що наскрізь не перевіряв.
- **Результат:** `check-contract --changed-since base` — 6 PASS, **9 FAIL**, той самий набір, що в A1. Мок:
  `POST /webhook/quote-request -> 403 auth=missing`. Сторінка: «Не вдалося підготувати кошторис автоматично».
  Матриця колбека 5/7, з успішними кейсами 5/10: підписаний за контрактом колбек → 401. Форма відповідає за
  0,137 с, персональних даних у журналі сервера 0.

**B3** ([`run-b3/summary.md`](evidence/task-d/run-b3/summary.md), [`transcript.md`](evidence/task-d/run-b3/transcript.md),
діф [`docs/ab/b-with-skill-run3.diff`](ab/b-with-skill-run3.diff)):
- **Скіл:** `Skill integrating-n8n-webhooks` — **перший** виклик сесії. Далі `code-templates.md`, `contract.md`,
  `response-modes.md`, `n8n-setup.md`.
- **Самоперевірка:** `check-contract.mjs` агент запустив лише до змін (8-й виклик): 3 PASS / 8 FAIL / 4 N/A, це
  базова лінія старого коду. Цей виклик теж був складеною командою (`cat …; node …check-contract.mjs --help;
  node …check-contract.mjs; ls …`) і пройшов. Після змін обидві спроби відхилено. 35-й виклик: у відмові названо
  частину `node …check-contract.mjs --changed-since HEAD; echo "exit=$?"; npm run lint 2>&1`. 36-й, з абсолютним
  шляхом і `--root`: відмова лише «This command requires approval». Чому саме ці форми не пройшли, коли 8-й
  виклик пройшов, з відповідей не видно. `lint` (перший раз
  помилка, виправив) і `build` з `--prefix` пройшли. Отже в цій парі обидва агенти перевірили себе однаково:
  `lint` + `build`.
- **Що зробив:** за шаблонами v0.1.3. `lib/n8n/client.ts`, роут `app/api/n8n/[event]/route.ts`, статус одним
  записом `updateQuote(…, "queued")`, строгий `BUDGET_RE`, `` body.event === `${event}.${d.status}` ``, 4 змінні
  контракту, `docs/n8n-integrations.md`, email у n8n не йде. 12 файлів, +599. Старий виклик n8n у формі ліда
  помітив і не чіпав: поза задачею.
- **Результат:** `check-contract --changed-since base` — **15 PASS, 0 FAIL**. Мок:
  `202 auth=ok idempotency=new`, колбек `202`, сторінка «Кошторис готовий», матриця 7/7, форма 0,135 с,
  персональних даних у журналі 0.
- **Три дефекти з аудиту:** `audit-regress.sh` на b3 — 16 ok, **0 FAIL** (`run-b3/audit-regress.txt`). Та сама
  перевірка на старих копіях b1 і b2 (скіл v0.1.0) — по **10 FAIL**: 7 бюджет, 2 `event`/`status`, 1 гонка
  (`pair2/audit-regress-b1-old.txt`, `audit-regress-b2-old.txt`).

**Версія перевіряльника.** Усі шість прогонів ще раз перевірено поточним `check-contract.mjs` v0.1.3
(`pair2/check-contract-v013-all.txt`). Для a1, a2, b1, b2 числа ті самі, що записані вище: 9, 11, 0, 0 FAIL.

**Що показала друга пара.** Вона повторила першу: без скіла A3 має той самий набір із 9 FAIL, що й A1, і з n8n
клієнта не працює. Зі скілом B3 має 0 FAIL і повний ланцюжок до «Кошторис готовий». Нове: з виправленими шаблонами
(v0.1.3) у коді B3 немає трьох дефектів, які аудит знайшов у B1/B2. Межі ті самі: одна модель, одна задача,
по одному прогону на руку в цій парі.

## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --3way docs/ab/b-with-skill.diff` (діф прогону **b1**, без жодної правки),
  коміт `c94da6f` «feat(quotes): … (run B of Task D)». b1, а не b2: обидва дають 0 FAIL, але сторінка статусу в
  b1 показує менше даних запиту. `.env.local` і `node_modules` не переносились. Нових залежностей немає,
  `package.json` не змінювався. Коміт `c94da6f` змінює рівно ті 12 файлів, що й прогін b1, з тими самими
  +609/−1 рядками:
  - нові файли — `app/quotes/new/page.tsx`, `app/quotes/[id]/page.tsx`, `app/quotes/actions.ts`,
    `app/api/n8n/[event]/route.ts`, `components/quote-form.tsx`, `components/auto-refresh.tsx`,
    `lib/n8n/client.ts`, `lib/quote-form.ts`, `docs/n8n-integrations.md`;
  - змінені — `lib/db.ts`, `lib/types.ts`, `.env.example`.
  > Перша копія діфів у `docs/ab/` (коміт `8cf9d4a`) була непридатна: хук RTK переписав `git diff > файл` на
  > свій стислий вивід, і `git apply` відповів «No valid patches in input». Діфи перезняв через
  > `rtk proxy git diff` (коміт `88b2e8b`) і перевірив `git apply --check`. Ще одна моя помилка по ходу:
  > у тій самій команді я запустив `git stash` у копіях. Роботу агентів одразу повернув `git stash pop --index`,
  > і `git diff --cached base` кожної копії байт у байт збігся зі збереженим діфом.
- **Що довелось доробити руками** (кожне — окремим комітом):
  1. `05aecc2` **fix(n8n): форма ліда через `lib/n8n/client` в `after()`**, файли `app/actions.ts` і
     `docs/n8n-integrations.md`. Старий `submitLead` робив
     `await fetch(process.env.N8N_WEBHOOK_URL!)` без токена, таймаут, ключа й конверта і слав увесь лід разом з
     IP, user agent і `rawPayload` (C3–C8). Тепер він викликає `triggerWorkflow("lead-created", …)` у `after()`.
     У `data` лише поля, потрібні CRM. `idempotency-key` = `lead-created:<lead.id>`: ключ виводиться із
     запису, схему `Lead` не змінено. **Це зміна формату для воркфлоу клієнта.** Згідно з правилом зупинки
     скіла її треба погодити з власником воркфлоу до деплою. Записано в `docs/n8n-integrations.md`.
     По ходу C14 зачепився за `error.name` у `console.error` (шаблон `\bname\b`). Перевірку не послаблював:
     переписав лог, як у шаблоні скіла, де назва помилки йде в лог через змінну.
  2. `6832770` **chore(env): прибрати `/webhook-test/` з `.env.example`**, файл `.env.example`. Змінну `N8N_WEBHOOK_URL` більше
     ніхто не читає (C1).

  Після трьох комітів — перенесення `c94da6f` і двох доведень `05aecc2`, `6832770` — **код гілки поза прогоном B
  змінено лише в `app/actions.ts` і `.env.example`**. Усі інші файли застосунку, яких торкається Task D, — рівно
  файли прогону b1. Окремо, у коміті `eab812c`, змінено сам скіл (v0.1.1: `SKILL.md`, `scripts/check-contract.mjs`,
  `scripts/selftest-check-contract.mjs`).

  **Після рев'ю CodeRabbit** (PR #10) доправлено ще два файли прогону b1 — `components/quote-form.tsx` (доступні
  помилки полів) і `components/auto-refresh.tsx` (ліміт оновлень) — та `app/actions.ts` (запис `lead.n8n_failed`).
  Діф `docs/ab/b-with-skill.diff` лишився таким, яким його зробив агент; що і чому змінено після — таблиця
  «Після рев'ю CodeRabbit» у `docs/verification.md`.

  **Після аудиту** (коміти `568ccac`, `9d056af`, `400a450`) виправлено три дефекти коду прогону b1. Кожен
  відтворено перевіркою до виправлення й підтверджено абляцією, деталі — розділ «Після аудиту» в
  `docs/verification.md`:
  - `app/quotes/actions.ts` + `lib/db.ts`: статус читався й записувався двома окремими запитами. Колбек, що
    встиг поставити `ready` між ними, перезаписувався на `sent`: 4 з 21 спроби з різною затримкою;
  - `lib/quote-form.ts` (+ `inputMode` у `components/quote-form.tsx`): коми в бюджеті видалялись, і
    `1500,50` ставало `150050`;
  - `app/api/n8n/[event]/route.ts`: `quote-request.completed` зі `status: "failed"` приймався з 202.

  **Звідки вони.** Гонка й незвірені `event`/`status` дослівно є в шаблонах `references/code-templates.md`
  скіла v0.1.0: `getQuote(…)?.status === "queued"`, потім окремий `updateQuote`, і
  `` body.event === `${event}.completed` || … `` без звірки з `data.status`. Обидва прогони B переписали їх
  звідти (є в `docs/ab/b-with-skill.diff` і `b-with-skill-run2.diff`). Видалення ком у бюджеті обидва B написали
  самі: шаблон про формат лише каже «finite number >= 0». У A бюджет — `<select>` з варіантів форми ліда, а
  статус колбека пишеться інакше. Код A на ці три дефекти окремо я не перевіряв. `check-contract` жодного з
  трьох не ловить: він перевіряє контракт з n8n, а не логіку статусів. Шаблони виправлено у скілі v0.1.3
  (`c3545ea`).

  **Чому скіл цього не дав.** Агент B свідомо не чіпав код поза задачею, і це правильно. Обидва повтори
  знайшли порушення в старому коді `check-contract`-ом, назвали їх і запропонували окрему зміну. Межа скіла
  тут не в знаннях, а в обсязі задачі: «доведення» — це рішення людини про зміну чужого воркфлоу.
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`. Адрес `/webhook-test/` немає. `.env.local` створено скриптом із
  `.env.example`: значення `change-me-…` замінено на `randomBytes(32)`, друкуються лише назви ключів. Він у
  `.gitignore`, `git ls-files ".env*"` показує лише `.env.example`. grep значень секретів по `docs/` дає 0 файлів.
- **`npm run lint`, `npm run build` на гілці:** без помилок. У маршрутах є `/api/n8n/[event]`, `/quotes/[id]`,
  `/quotes/new`.
- **`check-contract.mjs` на фінальному коді (увесь проєкт, без `--changed-since`):**
  [`branch/check-contract-final.txt`](evidence/task-d/branch/summary.md)
  ```
  n8n callers: app/actions.ts, lib/n8n/client.ts · callback routes: app/api/n8n/[event]/route.ts
  C1–C15: 15 PASS, 0 FAIL, 0 N/A
  exit=0
  ```
- **Сценарій ще раз, уже на гілці** ([`branch/scenario/scenario.txt`](evidence/task-d/branch/summary.md)):
  - форма: 303 за 0,135 с;
  - мок: `POST /webhook/quote-request -> 202 auth=ok idempotency=new`, потім
    `callback POST …/api/n8n/quote-request -> 202`;
  - сторінка: «Готуємо кошторис», а після колбека «Кошторис готовий»;
  - матриця колбеків 7/7, персональних даних у журналі сервера 0.

  Форма ліда ([`branch/lead-check.txt`](evidence/task-d/branch/summary.md)):
  `POST /webhook/lead-created -> 200 auth=ok idempotency=new`, у журналі сервера
  `{"n8n":"out","event":"lead-created",…,"status":200}`, email, телефону й тексту 0. Відповідь 0,43 с дають
  штучні затримки `insertLead`/`logAudit` у демо-«базі», n8n уже не чекаємо.
- **`docs/n8n-integrations.md`:** розділ `quote-request` дописав агент b1, розділ `lead-created` і примітку про
  зміну формату — я. Пізніше я доповнив обидва розділи: `lead.n8n_failed` після рев'ю CodeRabbit (`a362951`), а
  формат `budget`, звірку `event` ↔ `status` і правило запису `sent`/`failed` після аудиту (`3b22311`).

## Висновок

Скіл змінив результат там, де контракт не виводиться з коду. Без скіла обидва агенти написали справну на вигляд
фічу з продуманим захистом: хешований одноразовий токен і `timingSafeEqual`. Але це їхній власний протокол,
тож з n8n клієнта він не працює. Мок відхилив запит (403 без `x-n8n-token`; у a2 ще й 404 через `/webhook-test/`),
колбек не прийшов, а підписаний за контрактом колбек роут A відхиляє з 401 (перевірено на a2 і a3; на a1 успішні кейси матриці не запускали). `check-contract` на коді A дає 9 і
11 FAIL. Зі скілом обидва повтори викликали його самі, взяли шаблони з `references/` і перевірили себе його ж
скриптом: 0 FAIL, повний ланцюжок «форма → 202 → підписаний колбек → готово» за 0,135 с відповіді форми.

Що скіл **не** змінив: форма без JS, валідація, випадкові id, чисті журнали. Це агент бере з наявного коду й
документації Next.js в обох руках. Одразу після перенесення довелося доробити лише старий виклик n8n форми ліда,
який агент B свідомо лишив поза задачею. Пізніше код прогону b1 змінено ще тричі, окремими комітами: після рев'ю
CodeRabbit (`8dc7c03`: доступні помилки форми, ліміт автооновлення), після аудиту (`568ccac`, `9d056af`,
`400a450`: три дефекти, див. «Після аудиту» в розділі перенесення) і після код-рев'ю (`bcb9c05`, `01f2951`,
`45f20f5`, `01c9f39`, див. `docs/verification.md`, «Після код-рев'ю»).

Що змінено в скілі після цих прогонів (v0.1.1, окремий коміт):
- C14 більше не спрацьовує на `error.name`. У selftest додано два кейси: `console.error(error.name)` дає PASS,
  `console.error(body.name)` досі FAIL;
- C10 тепер прямо каже «in the route file (helpers it imports are not followed)». Вердикт для A той самий:
  HMAC над тілом немає. Ходити за імпортами роуту скрипт поки не вміє, це наступний крок.

Чого A/B не показує: 0 FAIL `check-contract` означає, що дотримано контракт з n8n, а не що в коді немає
дефектів. Аудит знайшов у коді B три дефекти, два з них прийшли з шаблонів самого скіла (див. «Після аудиту»
вище). Висновок стосується цієї задачі й цієї моделі: у збережених прогонах скіл допоміг виконати контракт,
універсальність ефекту не перевірено.

Друга пара (A3/B3, однакові дозволи на `lint`/`build` з аргументами, скіл v0.1.3) дала той самий результат:
A3 — 9 FAIL і 401 на підписаний колбек, B3 — 0 FAIL і «Кошторис готовий». До того ж у B3 немає трьох дефектів
аудиту.

Обмеження: по 3 прогони на руку у двох парах, одна модель, одна задача. a1 лишився без фінальної відповіді через
тижневий ліміт акаунта, a2 не запускав `lint`/`build`. У другій парі обидва агенти перевірили себе лише `lint` і
`build`: B3 не зміг запустити `check-contract` після змін, наскрізну перевірку не зробив жоден.
