# Перевірка (Task A–C)

> Еталонне виконання для гілки `ws04/sample`, 21.09.2026. Windows 11 + Git Bash, Node 24.18.0,
> Claude Code 2.1.276 для перевірок скілів і 2.1.278 для прогонів агента (CLI оновився під час
> збірки; модель за замовчуванням у свіжій сесії — `claude-sonnet-5`, effort `xhigh`), Next.js 16.3.5.
> Усі числа — з продакшн-збірки (`next build` + `next start` на 127.0.0.1).

> **Про структуру завдань.** Task C — це лише скіл; фічу «запит на кошторис» будує агент у
> прогонах Task D, і в гілку переїжджає результат прогону **B**. Фіча на `ws04/sample` — саме
> такий результат «зі скілом»: автор будував її з `integrating-n8n-webhooks`, і скіл під час
> роботи виправив сам себе (коміт `f3ba25d`). Але це не запис прогону B: самі A/B-прогони (по три
> на плече) — у `docs/ab-validation.md`. Докази по фічі (мок, час форми, журнал сервера) лишились у цьому
> файлі; у студентському звіті їхнє місце — `docs/ab-validation.md`, розділ про перенесення
> прогону B.

> **Обсяг Task A.** Тут виправлено всі посіяні проблеми й заміряно кожну — це еталон і база для
> перевірки робіт. Студентові за рубрикою достатньо **двох** виправлень з id правила, з яких
> числа до/після потрібні для **одного**.

## Скіли видно у свіжій сесії

`claude -p "/context"` у свіжому клоні `ws04/sample` (у Git Bash — з `MSYS_NO_PATHCONV=1`), розділ Skills:

| Skill | Source | Токенів в описі |
|---|---|---|
| `building-client-form` | Project | ~270 |
| `integrating-n8n-webhooks` | Project | ~280 |
| `vercel-react-best-practices` | Project | ~120 |

Решта — вбудовані скіли й два особисті (`course-prep`, `find-skills` з `~/.claude/skills/`); жоден
не стосується форм чи n8n, тож прогони нижче ними не «забруднені».

**Відповідність специфікації** (name = тека, `description` ≤ 1024 символи з «що» + «коли», `SKILL.md`
< 500 рядків, посилання на файли скіла існують): `building-client-form` — 794 символи, 98 рядків;
`integrating-n8n-webhooks` — 822 символи, 151 рядок; `vercel-react-best-practices` — 329 символів,
149 рядків. Усі три — PASS.

> `claude plugin validate .claude/skills` друкує «✔ Validation passed», але з `--json` видно
> `"contents": []`: для теки `.claude/skills` у 2.1.276 він не перевірив жодного скіла. Контрольна тека
> (name ≠ тека, опис на 1100 символів) теж «passed». Маніфест плагіна (`.claude-plugin/plugin.json`)
> він перевіряє, але й там у наших пробах `contents` лишався порожнім. Тому відповідність перевіряли
> власним скриптом за правилами [agentskills.io/specification](https://agentskills.io/specification).

## Task B — `building-client-form`

**Звичайний запит у свіжій сесії** (скіл не названо):

> На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове
> поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.

**Результат: скіл спрацював — але код не пройшов Verify.** Прогін 21.09.2026 у свіжому клоні
`ws04/sample` (`e303748`), з якого прибрано `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`
і `.github/`; сесія `235379fd-b236-4266-964e-d1100e3a13c9`, 46 ходів, 11,9 хв, $2,73.

- **Спрацювання:** найперший виклик інструмента в сесії — `Skill(building-client-form)` (далі 43
  виклики Read/Grep/Edit/Write/Bash). У списку скілів сесії видно всі три скіли проєкту.
- **Що зробив:** `components/lead-note-form.tsx` (`maxLength=500`, `aria-invalid`,
  `aria-describedby="note-error note-hint"`, підсумок у `role="alert"`, введений текст лишається
  після помилки), `lib/lead-note-form.ts` (чиста валідація; `\r\n` зводиться до одного символу, щоб
  сервер рахував так само, як браузер), дія `addLeadNote` у `app/actions.ts`, `db.appendLeadNote`
  у `lib/db.ts`, форма на сторінці ліда — свідомо поза блоком `{lead.internalNotes && …}`.
- **Правила Vercel, на які посилається скіл, дотримані:** дія починається з `findOwnLead` (сесія +
  належність ліда до workspace, `server-auth-actions`), повертає лише `{ status, … }`, тексту
  нотатки в журналі немає — лише `lead note invalid: note` і `lead note added to lead_0001`.
- `npm run lint` і `npm run build` — без помилок; `check-contract.mjs` на клоні — `0 failed, 10 passed`.
- **Verify провалився на пункті «форма працює без JavaScript».** Сам агент написав, що в роботі
  нічого не перевіряв (запуск сервера вимагав підтвердження, якого в сесії не було). Перевірка
  автора на продакшн-збірці клону: відправка форми без JS **виконує дію** (у журналі
  `lead note added to lead_0001`, нотатка видно на наступному GET), але **HTTP-відповідь не
  завершується** — 45 с без заголовків, однаково через `fetch` і через `curl`. Контроль на тому
  самому сервері й тій самій сторінці: попередня дія «Вийти» — 303 за 19 мс, форма `/quotes/new` —
  200 за 18 мс. Отже, це дефект згенерованого коду, а не стенду.
- **Що з цього забираємо в скіл:** спрацювання ≠ правильний код. У розділ Verify скіла
  `building-client-form` треба додати окремим рядком «відправте форму з вимкненим JavaScript і
  переконайтесь, що **відповідь приходить**», бо нинішнє формулювання «форма працює й без JS»
  агент вважає виконаним, щойно у формі немає обов'язкового JS.

**Де патерн уже застосовано й перевірено** — форма `/quotes/new` (`components/quote-form.tsx`,
`app/quotes/actions.ts`, `lib/quote-form.ts`):

- без JS: невалідна відправка → HTTP 200, `aria-invalid="true"` + `aria-describedby="email-error"`,
  текст помилки, підсумок у `role="alert"`, введена назва компанії лишилась;
- з JS (браузер, продакшн-збірка): після невалідної відправки текстові поля зберегли значення, але
  **`<select>` бюджету скинувся на першу опцію**. React 19 скидає форму після дії, а змонтований
  select тримає свій перший `defaultValue`. Виправлено `key={values.budget}` (коміт `833a760`),
  перевірено трьома відправками поспіль; сам скіл виправлено (коміт `947791c`) — порада «для select
  теж `defaultValue`» була хибною;
- валідна відправка → відповідь за 139 мс (попередні прогони — 141–154 мс), повільне (n8n) — в `after()`;
- у журналі сервера лише `quote request invalid: email,description` і `quote request <uuid> queued` —
  без значень полів.

## Task C — `integrating-n8n-webhooks`

Завдання C — сам скіл: `SKILL.md` (151 рядок) з контрактом, чеклістом і правилами зупинки,
`references/` з деталями й `scripts/` (`check-contract.mjs`, `send-signed-callback.mjs`,
`mock-n8n.mjs`). Фічі в цьому завданні немає: її будує агент у прогонах Task D. Основний доказ
спрацювання скіла — **прогони B** у `docs/ab-validation.md` (скіл викликано 3 з 3).

**Додаткова перевірка спрацювання** — звичайний запит у свіжій сесії (скіл не названо;
`materials/n8n-webhooks-brief.md` на час прогону прибрано з клону, щоб контракт міг прийти лише зі
скіла):

> Коли менеджер змінює статус ліда на «Угода» (won), треба запустити в n8n воркфлоу deal-won — він
> створює рахунок у бухгалтерії. Відповідь від n8n нам не потрібна.

**Результат: скіл спрацював.** Прогін 21.09.2026 у такому самому клоні (`e303748`, без `materials/`,
`docs/`, `README.md`, `.coderabbit.yaml`, `.github/`); сесія `31f8df47-86c2-41ce-81a0-eb3bc8e53043`,
41 хід, 6,6 хв, $1,54.

- **Спрацювання:** найперший виклик інструмента — `Skill(integrating-n8n-webhooks)`; далі прочитано
  `references/contract.md`, `references/nextjs-patterns.md`, `references/n8n-side-setup.md` — **і два
  правила з чужого скіла**: `vercel-react-best-practices/rules/server-after-nonblocking.md` та
  `server-auth-actions.md`. Це композиція скілів у дії: наш скіл на ці правила посилається, і агент
  пішов за посиланням.
- **Що зробив:** у `updateLeadStatus` (`app/actions.ts`) виклик іде через `triggerWorkflow` з
  `lib/n8n/client.ts`, всередині `after()`, режим Immediately — без `callbackUrl`, бо відповідь від
  n8n не потрібна. Ключ ідемпотентності `dealWonIdempotencyKey` зберігається на ліді (`lib/types.ts`,
  `lib/db.ts`) і створюється лише тоді, коли лід **уперше** перейшов у «won»: повторний клік або
  повернення статусу назад і знову не створить другого рахунку. У тілі — лише поля для рахунку, без
  телефону, тексту звернення, IP, user agent і внутрішніх нотаток.
- `check-contract.mjs` на клоні — `0 failed, 10 passed, 0 n/a`, код виходу 0; `npm run lint` і
  `npm run build` — без помилок.
- **Чого цей прогін не показав:** рядка в `docs/n8n-integrations.md` — теку `docs/` для прогону
  прибрано з клону (щоб контракт міг прийти лише зі скіла), тож реєстр інтеграцій агенту не було
  куди дописати. Це обмеження протоколу перевірки, а не поведінка агента.

**Як повторити обидва прогони** (по одному, не паралельно — паралельні сесії можуть конфліктувати
під час оновлення OAuth-токена):

```bash
claude auth status                        # має бути "loggedIn": true
git clone --branch ws04/sample <repo> ../trigger-n8n && cd ../trigger-n8n && npm ci
rm -rf materials docs README.md .coderabbit.yaml .github   # щоб контракт міг прийти лише зі скіла
claude -p --output-format stream-json --verbose --permission-mode acceptEdits \
  --allowedTools "Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint:*),Bash(npm run build:*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs:*)" \
  < prompt.txt > run.jsonl                # prompt.txt — запит вище, UTF-8
grep -o '"name":"Skill","input":{[^}]*}' run.jsonl   # чи викликано скіл
```

### Скрипти скіла: що вони показали

**`check-contract.mjs` на `main`** (файли з `git archive main`) — 5 FAIL, exit 1. `app/`, `lib/`,
`components/` і `.env.example` на `main` не змінювались з виміряного `ea73649`; `tools/mock-n8n.mjs`
змінено лише в тексті `--help` (`2454163`), `AGENTS.md` — розділ безпеки курсу (`cf460e1`). На
перевірки й заміри це не впливає:

```
C1  FAIL no /webhook-test/ URL in code or .env.example
      .env.example:6  N8N_WEBHOOK_URL points at a /webhook-test/ URL
C2  PASS no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
C3  FAIL n8n is called only from lib/n8n/*, which starts with import 'server-only'
      app/actions.ts:54  fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)
C4  N/A  callback route reads the raw body; parses only after the signature check  (no callback route found …)
C5  N/A  signature: length check + timingSafeEqual, never === / !==  (no callback route found)
C6  FAIL every fetch to n8n has signal: AbortSignal.timeout(...)
      app/actions.ts:54  fetch without signal: add AbortSignal.timeout(10_000)
C7  PASS no bodies, payloads or headers in console.* in n8n code
C8  PASS no runtime = 'edge'
C9  FAIL .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
      .env.example  key N8N_WEBHOOK_BASE_URL is missing   (+ N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL)
C10 FAIL every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL
      app/actions.ts:54  no idempotency-key header (UUID created once per operation, reused on retries)
      app/actions.ts:54  no x-n8n-token header (n8n Header Auth; a missing or wrong token is a 403)

5 failed, 3 passed, 2 n/a (10 checks)
```

**Чому N/A, а не PASS:** на `main` ще немає колбек-роуту, тож C4 і C5 нічого не перевіряли. Скрипт
каже це прямо — інакше «усе зелене» означало б «нікуди не дивились» (та сама пастка, що й «n8n
callers: none» у проєкті, який очевидно викликає n8n).

**На `ws04/sample`** — `0 failed, 10 passed, 0 n/a (10 checks)`, exit 0 (n8n callers:
`lib/n8n/client.ts`; callback routes: `app/api/n8n/[event]/route.ts`).

**Самоперевірка скрипта** — набір із 31 випадку (автор тримає його поза репозиторієм разом з
іншими тестами, прогін `run-fixtures.mjs`): еталонний проєкт за контрактом, обидві гілки репозиторію,
15 випадків з типових помилок агента, 7 — на `--changed-since` і шість записаних прогонів A/B
першої калібровки — за старим протоколом, з моком у копіях (кожен — і весь проєкт, і
`--changed-since`; у `docs/ab-validation.md` тепер звіт про повторні прогони за чистим протоколом).
Останній прогін — **31 з 31**.
Шість прогонів A/B набір перевіряє, лише поки їхні копії лежать поруч із ним (це великі робочі теки,
не частина набору); без них лишається 25 випадків. Що він ловить:

- навмисно поганий код (`req.json()`, `signature !== expected`, `NEXT_PUBLIC_N8N_WEBHOOK_URL`,
  тестовий URL, лог тіла, `runtime = "edge"`, справжній токен у `.env.example`) — **10 з 10 FAIL**;
- парсинг до перевірки підпису — і `JSON.parse` у самому роуті, і виклик **імпортованої** функції,
  яка парсить (C4 FAIL на рядку виклику), і `POST` у формі `export const POST = async (r) => …`
  з `r.json()` та HMAC від `JSON.stringify(...)`;
- виклик n8n через модуль конфігурації чи типізованого env (`fetch(env.N8N_…)`, `fetch(config.…)`):
  C3, C6 і C10 FAIL, хоча ні URL, ні `process.env` немає поряд із `fetch`;
- токен у query string і відсутній `x-n8n-token` — C10 FAIL;
- **і навпаки**, коректний код, на якому перевірки не мають спрацьовувати: `typeof signature !==
  "string" || signature === ""` (не C5), `const init: RequestInit = { …, signal }; fetch(url, init)`
  і `fetch(url, { ...baseInit, body })` (обидва — не C6).

- довжина підпису, «запінена» регуляркою `/^sha256=([0-9a-f]{64})$/` перед `timingSafeEqual`, —
  теж перевірка довжини (C5 PASS); а `timingSafeEqual` без жодної перевірки довжини поруч з UUID-регуляркою
  (`{8}`, `{12}`, не `{64}`) — C5 FAIL, як і раніше;
- `--changed-since`: старий виклик n8n і тестовий URL, яких робота не торкалась, не рахуються, а
  новий виклик без таймауту в тому самому файлі — рахується (FAIL на новому рядку, не на старому);
  рахуються і незакомічені, і закомічені після `ref` зміни, і нові файли, ще не додані в git; якщо
  нічого не змінилось — усі десять N/A, не PASS; тека не в git або невідомий `ref` — помилка
  використання (exit 2), а не тихий прогін по всьому проєкту.

> Два хибні FAIL виправлено 21.09.2026, кожен — разом з фікстурою, яка на старому скрипті падає, а на
> новому — ні: C6 не йшов за іменем, розпакованим усередині об'єкта (`{ ...baseInit }`,
> `init-spread-signal`); C5 не вважав регулярку `{64}` перевіркою довжини (`regex-length-pin`) —
> саме так прогони A2 і A3 першої калібровки отримали хибний FAIL.

**Фіча «запит на кошторис» (результат «зі скілом») проти мока: 202 + підписаний колбек.**
У студентському варіанті ці рядки йдуть у `docs/ab-validation.md` — як докази прогону B і
перевірка після перенесення фічі в гілку.

```bash
N8N_WEBHOOK_TOKEN=… N8N_CALLBACK_SECRET=… node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs \
  --port <port> --mode respond-202 --delay 3000 --callback-url http://127.0.0.1:<app>/api/n8n/quote-request
```

Відправка форми `/quotes/new` (без JS) → **HTTP 200 за 178 мс** (попередні прогони — 139–183 мс),
хоча «воркфлоу» триває 3 с; сторінка статусу пройшла «У черзі» → «Готуємо кошторис» → «Готово» з
посиланням на PDF одразу після колбека. Журнал мока (sha256 скорочено):

```
POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 366 B sha256=2077642a…
workflow ca4110d5-… running for 3000 ms, then callback event=quote-request.completed
callback POST http://127.0.0.1:<app>/api/n8n/quote-request -> 202 in 177 ms (try 1/3) event=quote-request.completed body 382 B sha256=193eadb0…
```

Журнал застосунку (фрагмент) — подія, статус, тривалість, correlation id, розмір і хеш тіла; ні email,
ні назви компанії, ні токена, ні підпису:

```
quote request 8752a483-… queued
n8n -> quote-request 202 in 11 ms (try 1/3) corr=09546dd5-… 366 B sha256=2077642af9c06cd2
n8n <- quote-request completed accepted corr=09546dd5-…
quote 8752a483-… completed: customer notification queued (demo: no e-mail is sent)
n8n <- quote-request rejected: bad-signature corr=6ed35f57-… 382 B
n8n <- quote-request rejected: stale-timestamp corr=a118f849-… 382 B
n8n <- quote-request rejected: key does not match the signed job corr=b98d72da-…
n8n <- quote-request rejected: callback for another job corr=928cf9f7-…
```

**`send-signed-callback.mjs`** проти `/api/n8n/quote-request` для запиту, який ще **чекає** колбека
(мок перезапущено на тому самому порту з `--delay 600000`, одна відправка форми): `--request-key` = id
запиту, `--job-id` — з рядка мока `workflow <jobId> running`. **18 з 18 PASS**, exit 0:

```
PASS  wrong-content-type     expected 415  got 415   only application/json is accepted
PASS  json-lookalike-type    expected 415  got 415   application/jsonx only starts with application/json - parse the media type
PASS  json-with-charset      expected 401  got 401   application/json; charset=utf-8 passes the media-type gate (401, not 415) and dies on the signature
PASS  oversized-body         expected 413  got 413   callbacks carry links, not files (limit 64 KB)
PASS  missing-signature      expected 401  got 401   no x-n8n-signature header
PASS  bad-signature          expected 401  got 401   random hex instead of the HMAC
PASS  short-signature        expected 401  got 401   wrong length must not crash timingSafeEqual
PASS  wrong-secret           expected 401  got 401   signed with another secret
PASS  stale-timestamp        expected 401  got 401   timestamp 10 min old (window 300 s)
PASS  future-timestamp       expected 401  got 401   timestamp 10 min ahead (window 300 s)
PASS  non-numeric-timestamp  expected 401  got 401   x-n8n-timestamp is not unix seconds
PASS  reserialized-body      expected 401  got 401   signed compact JSON, sent pretty-printed JSON (same data, other bytes)
PASS  malformed-json         expected 400  got 400   valid signature over a body that is not JSON
PASS  unknown-event          expected 404  got 404   valid signature, route for an event the app does not handle
PASS  valid                  expected 202  got 202   fresh, correctly signed callback for a real job
PASS  replay-same-key        expected 200  got 200   same idempotency-key again (n8n Retry On Fail): acknowledged, not applied twice
PASS  replay-new-key         expected 400  got 400   captured callback replayed under a fresh key: the key must equal <jobId>:<event> from the signed body
PASS  other-job-same-request expected 409  got 409   correctly signed callback from another job for the same request: the request is bound to its own job

0 failed, 18 passed (18 cases)
```

Пара `json-lookalike-type` / `json-with-charset` з'явилась після того, як рев'ю знайшло дірку в
воротах типу: роут приймав `content-type`, який лише **починається** з `application/json`, тож
`application/jsonx` проходив. Тепер роут (і шаблон у `references/nextjs-patterns.md`) розбирає
медіатип без параметрів: `application/json; charset=utf-8` — так, `application/jsonx` — 415.

Випадок `replay-new-key` — це саме той сценарій, заради якого ключ звіряється з тілом: ті самі байти,
той самий час і той самий підпис, що й у `valid`, лише з іншим `idempotency-key`. До цієї перевірки
роут приймав такий запит (202) і виконував `after()` ще раз; тепер — 400, а в журналі
`rejected: key does not match the signed job`.

Випадок `other-job-same-request` — з рев'ю 21.09.2026: колбек **іншої** задачі (новий `jobId`, свій
правильний ключ, правильний підпис) для запиту, який уже готовий. Раніше роут шукав запис лише за
`requestIdempotencyKey`, `data.jobId` із записаним `job_id` не звіряв, а `completeQuote` перезаписував
навіть готовий кошторис: три такі колбеки поспіль отримали 202 і щоразу міняли посилання на PDF. Тепер
запит прив'язаний до `job_id` з відповіді 202 (інший `jobId` → 409, ключ звільнено), а готовий
кошторис не перезаписується (`completeQuote`/`failQuote` не чіпають `ready`). Це захист у глибину —
для такого колбека потрібен секрет, — але саме так поводиться другий чи «застарілий» запуск
воркфлоу. Тому ж матриця тепер бере задачу, яка ще чекає колбека: раніше випадок `valid`
«проходив» на вже готовому кошторисі саме завдяки цій дірці.

Додатково: сервер **без** `N8N_CALLBACK_SECRET` на правильно підписаний колбек відповідає 500 (не 2xx і
не 400) — HMAC із порожнім ключем не приймається. Сторінка статусу не показує email і опис задачі;
невідомий чи некоректний id → 404.

**Що скіл змінив сам по собі під час роботи** (коміт `f3ba25d`): шаблон роуту в
`references/nextjs-patterns.md` оновлено за робочим кодом — `Object.hasOwn` для мапи обробників (інакше
`/api/n8n/toString` знаходив «обробник» у прототипі) і лог похідного `jobStatus` замість об'єкта конверта
(C7 навмисно суворий до `envelope`/`body`/`payload`).

## Вимірювання: до (`main`) і після (`ws04/sample`)

| Що | `main` (`ea73649`) | `ws04/sample` | Правило |
|---|---|---|---|
| `/dashboard`, перший байт (3 прогони) | 2266–2277 мс | 645–648 мс | `async-suspense-boundaries` |
| `/dashboard`, уся сторінка (3 прогони) | 2270–2281 мс | 1438–1440 мс | `async-parallel` |
| `db:*` на один запит `/dashboard` | `getUserBySession` 3, `getWorkspace` 3, `getLeads` 1, `getLeadStats` 1, `getSourceBreakdown` 1 | усі по 1 | `server-cache-react` |
| HTML `/dashboard` | 424 592 Б, є `internalNotes`/`rawPayload`/`ipAddress` | 121 220 Б, немає | `server-serialization` |
| RSC-відповідь `/dashboard` (`rsc: 1`) | 315 197 Б | 38 781 Б | `server-serialization` |
| Початковий JS `/dashboard` (чанки з HTML) | 10 чанків, 1828 КБ / 526 КБ gzip | 9 чанків, 571 КБ / 177 КБ gzip | `bundle-dynamic-imports`, `bundle-conditional` |
| Де exceljs і recharts | в одному чанку 1266 КБ, який HTML вантажить одразу | exceljs 909 КБ і recharts 350 КБ — окремі чанки, вантажаться за кліком | те саме |
| Відправка форми ліда проти мока n8n (2 с, `last-node`) | 2403–2428 мс | 130–156 мс | `server-after-nonblocking` |
| `updateLeadStatus` напряму: чужий workspace / довільна cookie | статус змінено / змінено | не змінено / не змінено | `server-auth-actions` |

Як міряли:
- **`/dashboard`**: cookie `leaddesk_session=demo-u_olena`, один прогрівальний запит + 3 виміри. Перший
  байт — момент, коли `fetch()` отримав заголовки (при стрімінгу вони приходять разом з оболонкою), уся
  сторінка — до кінця тіла. `db:*` — різниця лічильників `console.count` у журналі сервера до і після запиту.
- **Початковий JS**: усі `/_next/static/**/*.js` з HTML `/dashboard`, розміри з `.next/static` (gzip —
  Node zlib). Де лежать бібліотеки — пошук характерних рядків (`xl/workbook.xml` для exceljs,
  `recharts-wrapper` для recharts) у кожному чанку.
- **`npx next experimental-analyze --output`** (`.next/diagnostics/analyze/data/dashboard/analyze.data`):
  на обох гілках маршрут `/dashboard` «важить» ≈ 1827 КБ, бо аналізатор рахує і чанки, що вантажаться
  пізніше через `import()`. Різниця — у розкладці: на `main` exceljs (909 КБ) і recharts (227 КБ) сидять в
  одному файлі на 1266 КБ; на `ws04/sample` — два окремі файли (909 КБ лише exceljs; 350 КБ recharts + d3).
  lodash на `main` — 2,6 КБ (Next.js сам переписує імпорт на `lodash/debounce`), на `ws04/sample` — 0.
- **Браузер** (продакшн-збірка): клік «Показати графік джерел» довантажив один чанк і намалював 6 стовпців;
  «Експорт в Excel» довантажив чанк exceljs і згенерував `leads-2026-09-21.xlsx` (18,7 КБ) без помилок у консолі.
- **Форма ліда**: POST форми без JS (як браузер без JavaScript), 3 відправки; мок
  `tools/mock-n8n.mjs --mode last-node` (воркфлоу 2000 мс, викликач чекає). На `main` —
  `N8N_WEBHOOK_URL=…/webhook/lead-created` без авторизації; на `ws04/sample` — `N8N_WEBHOOK_BASE_URL`
  і `N8N_WEBHOOK_TOKEN` (мок з Header Auth: `auth=ok idempotency=new`, n8n отримує 371 Б замість 1083 Б).
- **Server Actions**: POST із заголовком `next-action` = id `updateLeadStatus` з
  `.next/server/server-reference-manifest.json`, тіло `["lead_0001", "<status>"]`.

`npm run build` і `npm run lint` на `ws04/sample` — без помилок.
