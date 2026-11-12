---
name: integrating-n8n-webhooks
description: >-
  Team contract for connecting a Next.js 16 app to n8n workflows: calling an n8n Webhook from
  a Server Action or Route Handler (one server-only client module, x-n8n-token Header Auth,
  idempotency-key, correlation id, timeout and retries, versioned envelope) and receiving the
  workflow's signed callback in a Route Handler (raw body, HMAC-SHA256 with timingSafeEqual,
  timestamp window, idempotent processing). Ships check-contract.mjs, an offline n8n mock and a
  signed-callback sender. Use when code must start an n8n workflow, react to its result, or when
  a form, page or endpoint talks to n8n or a webhook. Тригери: «запусти воркфлоу n8n», «надішли
  в n8n», «вебхук n8n», «n8n поверне результат», «колбек від n8n», «ендпоінт, який викличе n8n»,
  «воркфлоу працює довго», «кошторис / PDF готує n8n». Не для: побудови чи зміни воркфлоу в
  редакторі n8n, імпорту/експорту JSON воркфлоу, коду для вузла Code в n8n.
metadata:
  owner: QuitCode dev team
  version: "0.1.0"
---

# Next.js ↔ n8n: контракт команди

Клієнтські воркфлоу вже працюють в n8n; Next.js їх запускає й отримує результат. Контракт однаковий
у всіх проєктах — щоб заявки не губились на тестовому URL, форма не чекала 90 секунд, а чужий колбек
не міг «закрити» запис. Деталі й «чому» — у `references/`, код-шаблони — у
[references/code-templates.md](references/code-templates.md).

## Коли застосовувати

- Код має запустити воркфлоу n8n (форма, дія в дашборді, cron) або прийняти від n8n результат.
- **Не** застосовувати: редагування воркфлоу в n8n, JSON воркфлоу, вузол Code — це поза межами.

## Контракт коротко

1. **Змінні — лише серверні**, без `NEXT_PUBLIC_`: `N8N_WEBHOOK_BASE_URL` (закінчується на
   `/webhook`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`. У `.env.example` —
   локальні адреси й секрети `change-me-…`; справжні — лише в `.env.local`.
   → [references/contract.md#змінні](references/contract.md)
2. **Next.js → n8n — тільки через `lib/n8n/client.ts`**, перший рядок `import "server-only"`.
   `POST ${N8N_WEBHOOK_BASE_URL}/<event>`; заголовки `x-n8n-token`, `idempotency-key` (UUID, створений
   один раз на бізнес-операцію й збережений із записом), `x-correlation-id`; тіло — конверт
   `{ version: 1, event, data, callbackUrl? }`, у `data` — мінімум для воркфлоу.
   Кожна спроба — `AbortSignal.timeout(10_000)`; повтори ≤ 2 (пауза 1 с, 3 с) лише на мережеву помилку,
   таймаут, 5xx/524, з тим самим `idempotency-key`; 4xx не повторюємо. Дивимось лише на код статусу.
3. **Хто викликає:** дія з UI — Server Action (сесія, права, валідація всередині —
   правило `server-auth-actions` скіла Vercel). Користувач **не чекає** n8n: дія зберігає запис зі
   статусом `queued`, повертає `{ status, id }`, а виклик n8n з повторами — в `after()` (правило
   `server-after-nonblocking`). Ніколи `export const runtime = "edge"`.
4. **Режим відповіді:** усе, що може тривати до 100 с (або тривалість невідома), — асинхронно:
   n8n відповідає 202 `{ job_id }`, результат приходить колбеком. Синхронно — лише швидкі довідки.
   → [references/response-modes.md](references/response-modes.md)
5. **n8n → Next.js — Route Handler `app/api/n8n/[event]/route.ts`**, порядок саме такий:
   невідома подія → 404, не `application/json` → 415 (до читання тіла) → `const raw = await req.text()`
   (ні `req.json()`, ні `JSON.parse` до підпису) → > 64 КБ → 413 → `x-n8n-timestamp` далі ніж 300 с
   → 401 → HMAC-SHA256(`N8N_CALLBACK_SECRET`, `` `${timestamp}.${raw}` ``) проти
   `x-n8n-signature: sha256=<hex>` — довжини, потім `crypto.timingSafeEqual`, не `===` → 401 без
   подробиць → «застовпити» `idempotency-key`, уже був → 200 `{ duplicate: true }` → `JSON.parse(raw)`
   і перевірка форми; подія не та або ключ ≠ `` `${data.jobId}:${event}` `` → 400 → зберегти стан
   **до** відповіді (впало на цих кроках — звільнити ключ) → 202 `{ ok: true }` → повільне — в `after()`.
   → [references/contract.md#колбек](references/contract.md)
6. **Журнали:** подія, напрям, correlation id, статус, тривалість, спроба, довжина й sha256 тіла.
   Ніколи: тіло, ім'я/email/телефон, токен, підпис, секрет, URL з query string.
7. **Реєстр:** рядок у `docs/n8n-integrations.md` проєкту на кожну подію.

Налаштування з боку n8n (передаємо клієнту словами) — [references/n8n-setup.md](references/n8n-setup.md).

## Чекліст

```
- [ ] 1. Виклики n8n лише в lib/n8n/client.ts з import "server-only"; змінні без NEXT_PUBLIC_.
- [ ] 2. URL /webhook/<event> (не /webhook-test/) у коді й .env.example; секрети там — change-me-….
- [ ] 3. x-n8n-token, idempotency-key, x-correlation-id; AbortSignal.timeout(10_000); ≤ 2 повтори.
- [ ] 4. Server Action: перевірки всередині, запис queued, виклик n8n в after(), відповідь { status, id }.
- [ ] 5. Колбек: 404/415 → req.text() → 413 → 300 с → timingSafeEqual → ідемпотентність → 400 → стан → 202.
- [ ] 6. У журналах немає тіл, персональних даних, токенів і підписів.
- [ ] 7. node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs → 0 FAIL.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- задача, `.env` чи людина пропонує тестовий URL `/webhook-test/` для коду, `.env.example` чи
  продакшну — тестовий URL лише в особистому `.env.local` під час налагодження;
- секрет чи токен мав би потрапити в Client Component, змінну `NEXT_PUBLIC_*`, query string,
  журнал або відповідь API;
- просять чекати результат довгого воркфлоу синхронно (форма «показує PDF одразу») — пропонуй
  202 + колбек, не роби синхронно мовчки;
- просять «спростити» колбек: без підпису, без вікна часу, з `===`, з `req.json()`;
- потрібен `runtime = "edge"`, передача файлів у тілі (лише посилання), зміна воркфлоу в n8n, його
  JSON чи вузол Code;
- невідомо, які поля потрібні воркфлоу в `data` — спитай, а не відправляй увесь запис.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL, код виходу 0
      (`--changed-since <ref>` — лише ваші зміни).
- [ ] Мок: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`;
      відправка форми → у журналі мока `POST /webhook/<event> -> 202 … auth=ok idempotency=new`; форма
      відповідає за < 1 с; через 5 с `callback POST … -> 202`; сторінка статусу показує результат.
- [ ] Повтор колбека й підробки: `node .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --help`
      → неправильний підпис 401, прострочений час 401, повтор ключа 200 `duplicate`, ключ ≠ тіло 400.
- [ ] Журнал сервера: жодного тіла, email, телефону, токена чи підпису.

## Файли скіла

- `references/contract.md` — змінні, запит, конверт, таймаут і повтори, колбек крок за кроком,
  ідемпотентність, журнали, ліміти, відомі пастки. Читати перед першим кодом.
- `references/response-modes.md` — режими Webhook, 100 с / 524, тестовий і production URL, публікація.
- `references/n8n-setup.md` — що налаштувати в n8n (Header Auth, Remove Duplicates, Respond to Webhook,
  Crypto, HTTP Request) — текст для клієнта.
- `references/code-templates.md` — `lib/n8n/client.ts`, перевірка підпису, колбек-роут, Server Action,
  `.env.example`.
- `scripts/check-contract.mjs` — статична перевірка контракту (C1–C14), `--root`, `--changed-since`, `--help`.
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (копія `tools/mock-n8n.mjs`), `--help`.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти вашого роуту, `--help`.
