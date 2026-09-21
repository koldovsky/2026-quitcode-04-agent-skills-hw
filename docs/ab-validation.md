# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

> Еталон автора, формат — `docs/templates/ab-validation.md`. **Стан на 21.09.2026: копії підготовлено
> за протоколом і перевірено, прогонів агента ще не було.** CLI на машині збірки не авторизований:
> `claude auth status` → `"loggedIn": false`. Кожен `claude -p` на цій машині (10 спроб калібрування:
> Vercel A/B/C і n8n B; ще 2 перевірки спрацювання з `docs/verification.md`) зупинявся до першого
> звернення до моделі з
> `Failed to authenticate: OAuth session expired and could not be refreshed` (0 токенів, $0).
> Нижче лише те, що справді виміряно. Поля прогонів позначено «не виконано», а не заповнено з
> пам'яті. Як дозаповнити — у кінці.

- **Інструмент і версія:** Claude Code 2.1.276
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-sonnet-5` (так показує
  `/context` в обох копіях) · effort `xhigh` з `~/.claude/settings.json`; прапорців `--model` і
  `--effort` не передаємо
- **Код:** BASE = `558014e` (`fix(rerender-derived-state-no-effect)`, останнє виправлення Task A;
  код n8n починається з `1230ddf`) · скіли з `accd1c2` (HEAD `ws04/sample` на час підготовки)
- **Копії:** `leaddesk-ab-a` (без `integrating-n8n-webhooks`), `leaddesk-ab-b`; кожна — окремий
  `git init` з одним комітом `start`, у робочій теці автора поза репозиторієм
- **Що видалено з обох копій:** `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/`.
  Перевірка з walkthrough (`ls -A … | grep -xE '…'`) дала `no hints - ok`. Лишилися: `.claude/`,
  `AGENTS.md`, `CLAUDE.md`, `app/`, `components/`, `lib/`, `tools/`, `.env.example`, `skills-lock.json`,
  конфіги
- **Особисті копії скіла** (`~/.claude/skills`, `~/.cursor/skills`, `~/.agents/skills`, `~/.codex/skills`):
  перевірено, копії `integrating-n8n-webhooks` немає в жодній
- **Запит:** `materials/ab-task.md` без змін (sha256 тексту між лініями — `498a125e…c39c`), нова
  сесія на кожен прогін
- **Відповідь на уточнення, однакова в обох:** «Роби, як вважаєш правильним» (заплановано)
- **Мок, однаковий для обох:** `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`
  (заплановано)
- **Базова лінія `check-contract.mjs` на копії до прогону:** однакова в A і B — 5 FAIL (C1, C3, C6,
  C9, C10), 3 PASS (C2, C7, C8) і 2 N/A (C4, C5 — колбек-роуту ще немає), код виходу 1:

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root <копія>
  scanned 27 source files; n8n callers: app/actions.ts; callback routes: none
  C1  FAIL  no /webhook-test/ URL in code or .env.example
        .env.example:6  N8N_WEBHOOK_URL points at a /webhook-test/ URL
  C2  PASS  no NEXT_PUBLIC_ n8n variables; no N8N_* in Client Components
  C3  FAIL  n8n is called only from lib/n8n/*, which starts with import 'server-only'
        app/actions.ts:59  fetch to n8n outside lib/n8n/ (all calls go through lib/n8n/client.ts)
  C4  N/A  callback route reads the raw body; parses only after the signature check  (no callback route found …)
  C5  N/A  signature: length check + timingSafeEqual, never === / !==  (no callback route found)
  C6  FAIL  every fetch to n8n has signal: AbortSignal.timeout(...)
        app/actions.ts:59  fetch without signal: add AbortSignal.timeout(10_000)
  C7  PASS  no bodies, payloads or headers in console.* in n8n code
  C8  PASS  no runtime = 'edge'
  C9  FAIL  .env.example has the contract keys with placeholder secrets; .env.local is git-ignored
        .env.example  key N8N_WEBHOOK_BASE_URL is missing
        .env.example  key N8N_WEBHOOK_TOKEN is missing
        .env.example  key N8N_CALLBACK_SECRET is missing
        .env.example  key APP_BASE_URL is missing
  C10 FAIL  every call to n8n sends idempotency-key + x-n8n-token; no secrets in the URL
        app/actions.ts:59  no idempotency-key header (UUID created once per operation, reused on retries)
        app/actions.ts:59  no x-n8n-token header (n8n Header Auth; a missing or wrong token is a 403)
  5 failed, 3 passed, 2 n/a (10 checks)
  ```

## A — без скіла

- Які скіли бачив агент (окремий запуск `MSYS_NO_PATHCONV=1 claude -p "/context"` у копії, 21.09.2026):
  скіли проєкту — `building-client-form`, `vercel-react-best-practices`; плюс 2 особисті й 12 вбудованих,
  ті самі, що в B. `integrating-n8n-webhooks` у списку немає.
- Що зробив агент — своїми словами: **не виконано**, сесія зупинилась на автентифікації.
- Звідки агент узяв домовленості: **не виконано**. Що в копії A може підказати контракт:
  `tools/mock-n8n.mjs --help` (заголовок `x-n8n-token`, змінні `N8N_WEBHOOK_TOKEN` і
  `N8N_CALLBACK_SECRET`, схема підпису `sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>`)
  і рядок 53 `building-client-form/SKILL.md`, де названо скіл `integrating-n8n-webhooks`, але його
  змісту немає. Під час прогону записати, чи агент читав ці файли.
- Запитання агента і фінальна відповідь: не виконано.
- Змінені файли (`git diff --cached --stat`): не виконано; діф `docs/ab/a-without-skill.diff` ще не створено.
- Змінні середовища, які додав агент: не виконано.
- `check-contract.mjs` (id + PASS/FAIL) після прогону: не виконано (базова лінія — вище).
- Журнал мока (форма → колбек → `/quotes/<id>`): не виконано.
- Час від «Надіслати» до відповіді форми: не виконано.
- Що показала `/quotes/<id>`: не виконано.
- Журнал сервера: чи є тіла запитів, email, телефони, токени, підписи: не виконано.

## B — зі скілом

- Які скіли бачив агент (окремий запуск `/context`, 21.09.2026): скіли проєкту —
  `building-client-form`, `integrating-n8n-webhooks` (~280 токенів опису), `vercel-react-best-practices`;
  особисті й вбудовані — ті самі, що в A.
- **Чи викликав агент скіл** (інструмент `Skill` / читання `references/`, `scripts/`): **не виконано**.
- Що зробив агент — своїми словами: не виконано.
- Запитання агента і фінальна відповідь: не виконано.
- Змінені файли (`git diff --cached --stat`): не виконано; діф `docs/ab/b-with-skill.diff` ще не створено.
- Змінні середовища, які додав агент: не виконано.
- `check-contract.mjs` (id + PASS/FAIL) після прогону: не виконано (базова лінія — вище).
- Журнал мока (форма → колбек → `/quotes/<id>`): не виконано.
- Час від «Надіслати» до відповіді форми: не виконано.
- Що показала `/quotes/<id>`: не виконано.
- Журнал сервера: чи є тіла запитів, email, телефони, токени, підписи: не виконано.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл видно на старті (`/context`) | ні | так |
| Базова лінія `check-contract.mjs` | 5 FAIL: C1, C3, C6, C9, C10 | та сама |
| Скіл викликано | — | не виконано |
| `check-contract.mjs`: FAIL (id), нові порівняно з базовою лінією | не виконано | не виконано |
| URL вебхука: `/webhook/` чи `/webhook-test/` | не виконано | не виконано |
| `auth=` / `idempotency=` у журналі мока | не виконано | не виконано |
| Колбек дійшов; код відповіді застосунку | не виконано | не виконано |
| Час відповіді форми | не виконано | не виконано |
| Тіла чи персональні дані в журналі сервера | не виконано | не виконано |
| Змінених файлів | не виконано | не виконано |
| Запитання агента | не виконано | не виконано |

## Висновок

Висновку про вплив скіла поки немає: жодного прогону агента не було. Перевірено лише, що копії
відповідають протоколу. Скіл є тільки в B. Файлів, що описують контракт (`materials/`, `docs/`,
`README.md`, `.coderabbit.yaml`, `.github/`), немає в обох. Базова лінія й модель однакові. Єдині
джерела контракту в копії A — `--help` мока і назва скіла в `building-client-form`. Їх треба
відстежити в журналі сесії A, бо саме вони можуть пояснити результат «різниці немає».

**Як дозаповнити.** Увійти в CLI у звичайному терміналі (`claude auth login` або `claude` → `/login`)
і перевірити `claude auth status` → `"loggedIn": true`. Потім провести прогони за
`docs/walkthrough.md` (Task D, кроки 3–4) у цих самих копіях, спершу A, потім B, і замінити кожне
«не виконано» на вивід сесії, журнали й діфи в `docs/ab/`.
