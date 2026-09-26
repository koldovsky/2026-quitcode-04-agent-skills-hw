---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 ↔ n8n: виклик вебхука n8n із серверного модуля
  (production-URL, Header Auth x-n8n-token, idempotency-key, таймаут, повтори), асинхронні
  воркфлоу через 202 + колбек, підписаний колбек-роут (HMAC, timingSafeEqual, вікно 300 с,
  ідемпотентність), змінні N8N_*, мок n8n і скрипт перевірки check-contract.mjs.
  Use when код запускає воркфлоу в n8n або приймає від n8n результат: форма чи Server Action
  «відправляє в n8n», ендпоінт/роут, «який n8n викличе, коли буде готово», статус довгої задачі,
  webhook URL, N8N_WEBHOOK_*, колбек, callback, 524, тестовий vs production URL.
  Тригери: «запусти воркфлоу n8n», «передай лід у n8n», «n8n викличе ендпоінт», «колбек від n8n»,
  «вебхук n8n», «довгий воркфлоу n8n», «результат прийде від n8n пізніше».
  Не для побудови воркфлоу в редакторі n8n, експорту JSON чи коду для вузла Code.
metadata:
  owner: studio-nova-dev
  version: "0.1.0"
---

# Next.js ↔ n8n: контракт команди

Проєкти агенції — Next.js поверх воркфлоу клієнта в n8n. Щоб кожен проєкт не наступав на ті самі
граблі (тестовий URL у `.env`, форма, що чекає 90 с і падає з 524, незахищений колбек, подвійні
оновлення, email клієнта в журналах), зв'язку робимо **лише так**. Відхилення — свідомо й письмово в PR.

```
Next.js                                              n8n
 lib/n8n/client.ts ── POST /webhook/<event> ───────▶ Webhook (Header Auth) → 202 {job_id}
   x-n8n-token, idempotency-key, x-correlation-id     … воркфлоу …
 app/api/n8n/[event]/route.ts ◀── POST, підписаний ── HTTP Request (Crypto HMAC)
   x-n8n-timestamp, x-n8n-signature, idempotency-key
```

## Контракт коротко

**Змінні** (лише серверні, без `NEXT_PUBLIC_`): `N8N_WEBHOOK_BASE_URL` (…`/webhook`, ніколи
`/webhook-test/`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`. У `.env.example` — ці
ключі, секрети `change-me-…`, адреси локальні. Деталі — [references/outbound-webhook.md](references/outbound-webhook.md).

**Виклик n8n:**
1. Один модуль `lib/n8n/client.ts`, перший рядок `import "server-only"`; інших `fetch` до n8n немає.
2. `POST ${N8N_WEBHOOK_BASE_URL}/<event>` (kebab-case), заголовки `content-type: application/json`,
   `x-n8n-token`, `idempotency-key` (UUID, створений раз на операцію і збережений із записом),
   `x-correlation-id`.
3. Тіло — конверт `{ version: 1, event, data, callbackUrl? }`; `data` — мінімум, не рядок з бази.
4. `signal: AbortSignal.timeout(10_000)`; повтори ≤ 2 (1 с, 3 с) лише на мережу/таймаут/5xx/524,
   з тим самим `idempotency-key`; 4xx не повторюємо; текст відповіді не парсимо — лише статус.
5. Server Action: сесія/права/валідація всередині (`server-auth-actions`), запис зі статусом
   `queued` → відповідь `{ status, id }` → виклик n8n в `after()` (`server-after-nonblocking`);
   результат виклику (`processing` / `failed`) — у запис.

**Режим:** усе, що може тривати ~100 с (або тривалість невідома), — **асинхронно**: Respond to
Webhook 202 + колбек. Синхронно чекати не можна. Деталі — [references/response-modes.md](references/response-modes.md).

**Колбек** `POST /api/n8n/<event>` → `app/api/n8n/[event]/route.ts`, суворо в такому порядку:
невідома подія 404 / не JSON 415 → `await req.text()` → > 64 КБ 413 → `x-n8n-timestamp` поза ±300 с
401 → HMAC-SHA256(`N8N_CALLBACK_SECRET`, `${ts}.${raw}`) = `x-n8n-signature` (`sha256=…`), порівняння
довжин + `crypto.timingSafeEqual` 401 → застовпити `idempotency-key`, повтор → 200 `{"duplicate":true}`
→ `JSON.parse` + форма + ключ = `${data.jobId}:${event}` інакше 400 (і звільнити ключ) → зберегти стан (завершений запис не перезаписуємо — 409)
**до** відповіді → 202 `{"ok":true}` → повільне в `after()`. Шаблон і «чому» —
[references/callback-route.md](references/callback-route.md).

**Журнали:** подія, `x-correlation-id`, статус, тривалість, спроба, довжина тіла. Ніколи — тіла,
заголовки, токени, підписи, ім'я/email/телефон/IP.

## Як робимо (порядок роботи агента)

1. Прочитай [references/outbound-webhook.md](references/outbound-webhook.md) і
   [references/callback-route.md](references/callback-route.md) — там шаблони коду.
2. Визнач подію (`quote-request`) і режим (асинхронний, якщо сумніваєшся).
3. `lib/n8n/client.ts` за шаблоном; переведи **всі** наявні виклики n8n на нього.
4. Модель стану запису (`queued` → `processing` → `ready` / `failed`), збережені `idempotencyKey` і
   `correlationId`; Server Action + `after()`.
5. Колбек-роут за шаблоном; сторінка статусу читає стан запису.
6. `.env.example` — ключі контракту; значення для мока — лише в `.env.local` (сам його не читай і не друкуй).
7. Запусти `scripts/check-contract.mjs` і сценарій з моком (Verify).
8. Рядок у `docs/n8n-integrations.md`, текст налаштувань n8n для клієнта — [references/n8n-setup.md](references/n8n-setup.md).

## Чекліст

```
- [ ] 1. У коді й .env.example лише /webhook/, жодного /webhook-test/ (C1)
- [ ] 2. Жодної N8N_* з NEXT_PUBLIC_ (C2)
- [ ] 3. Усі виклики n8n — лише через lib/n8n/client.ts з import "server-only" (C3, C4)
- [ ] 4. fetch до n8n з AbortSignal.timeout(10_000); повтори лише мережа/таймаут/5xx/524 (C5)
- [ ] 5. Заголовки x-n8n-token, idempotency-key (збережений), x-correlation-id (C6)
- [ ] 6. .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL (C7)
- [ ] 7. Server Action повертає { status, id }, n8n — в after() (C8)
- [ ] 8. Колбек: req.text(), підпис до JSON.parse, timingSafeEqual, 300 с, idempotency-key (C9–C12)
- [ ] 9. Жодного runtime = "edge" (C13); у журналах немає тіл і персональних даних (C14)
- [ ] 10. Тіло запиту — конверт { version, event, data } з мінімумом даних (C15)
```

## Правила зупинки — зупинись і спитай людину, якщо:

- Задача чи людина просить **тестовий URL** (`/webhook-test/`) у коді чи `.env.example`, або «поки
  що без токена / без підпису».
- Секрет чи токен мав би потрапити в клієнтський код, `NEXT_PUBLIC_*`, query string, журнал або в
  git (`.env.example` зі справжнім значенням). Не читай і не виводь `.env.local`.
- Воркфлоу довгий (або тривалість невідома), а задача вимагає, щоб користувач **синхронно** дочекався
  результату в тій самій відповіді.
- Потрібно змінити воркфлоу в n8n, експортувати/імпортувати його JSON чи написати код для вузла Code.
- Контракт не покриває випадок: інша схема підпису, n8n вимагає інший auth (Basic/JWT), колбек без
  підпису, файли замість посилань, тіло > 64 КБ.
- Для реалізації потрібна нова залежність (черга, KV, бібліотека) — лише після «так» людини.

Без винятків «якщо задача цього потребує».

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL, код виходу 0
      (для власних змін: `--changed-since <ref>`).
- [ ] Мок у режимі клієнта: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`;
      у журналі мока `POST /webhook/<event> -> 202`, `auth=ok`, `idempotency=new`, далі колбек `-> 202`.
- [ ] Форма відповідає за < 1 с (n8n — в `after()`), сторінка статусу після колбека показує «готово».
- [ ] Матриця колбеків (18 випадків) на запиті, що ще чекає колбека: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event> --request-key <idempotency-key запиту>` → `0 failed`.
- [ ] У журналі сервера немає тіл, email, телефонів, токенів, підписів.

## Файли скіла

- [references/outbound-webhook.md](references/outbound-webhook.md) — змінні, запит, конверт, таймаут, повтори,
  шаблони `lib/n8n/client.ts` і Server Action з `after()`.
- [references/callback-route.md](references/callback-route.md) — колбек: заголовки, тіло, 10 кроків обробки з
  причинами, шаблон `app/api/n8n/[event]/route.ts`.
- [references/response-modes.md](references/response-modes.md) — режими відповіді, правило 100 с, тестовий vs
  production URL, ліміти, журнали, відомі пастки документації.
- [references/n8n-setup.md](references/n8n-setup.md) — налаштування вузлів n8n текстом для клієнта, мок, реєстр інтеграцій.
- `scripts/check-contract.mjs` — статична перевірка C1–C15; `--root <тека>`, `--changed-since <ref>`, `--json`, `--help`.
- `scripts/test-check-contract.mjs` — самотест перевірки на 17 фікстурах (порушення й коректний код); запускати після кожної зміни `check-contract.mjs`.
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (копія `tools/mock-n8n.mjs`); `--help`.
- `scripts/send-signed-callback.mjs` — матриця підписаних/зіпсованих колбеків проти роуту; `--help`.
