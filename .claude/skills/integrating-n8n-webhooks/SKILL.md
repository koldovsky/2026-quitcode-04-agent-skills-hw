---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 ↔ n8n: виклик вебхука з Server Action (лише серверні
  N8N_* змінні, x-n8n-token, idempotency-key, x-correlation-id, таймаут і повтори, after()),
  асинхронні воркфлоу через 202 + колбек, підписаний колбек-роут (HMAC на сирому тілі,
  timingSafeEqual, вікно 300 с, ідемпотентність), .env.example, журнали без персональних даних;
  скрипт check-contract.mjs перевіряє код. Use when код запускає воркфлоу в n8n, приймає від n8n
  результат чи статус, або змінює такий виклик, змінні N8N_* чи .env.example. Тригери: «запусти
  воркфлоу в n8n», «Server Action, який запускає воркфлоу», «ендпоінт, який n8n викличе», «n8n
  повідомить, коли готово», «вебхук n8n», «колбек від n8n», «передай лід/заявку в n8n», «статус
  запиту з n8n». Не для: побудови чи зміни воркфлоу в редакторі n8n, експорту/імпорту JSON
  воркфлоу, коду для вузла Code в n8n.
metadata:
  owner: studio-nova-dev
  version: "0.1.0"
---

# Next.js ↔ n8n: контракт команди

Форма запускає воркфлоу в n8n, n8n повідомляє про результат колбеком. Контракт нижче — рішення
команди: без нього в `.env` потрапляє тестовий URL, форма висить до 524, колбек без захисту, повтори
оновлюють запис двічі, а в журналах — контакти клієнтів.

## Коли застосовувати

- Код викликає вебхук n8n або приймає від n8n колбек; зміна такого коду, змінних `N8N_*`,
  `.env.example`.
- **Не** застосовувати: воркфлоу в редакторі n8n, JSON воркфлоу, вузол Code (див.
  [references/pitfalls.md](references/pitfalls.md)).

## Контракт коротко

| | |
|---|---|
| Змінні (лише серверні, без `NEXT_PUBLIC_`) | `N8N_WEBHOOK_BASE_URL` (закінчується на `/webhook`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL` |
| Виклик | лише з `lib/n8n/client.ts` (`import "server-only"`): `POST ${N8N_WEBHOOK_BASE_URL}/<event-kebab>` |
| Заголовки запиту | `content-type: application/json`, `x-n8n-token`, `idempotency-key` (UUID один раз на операцію, зберігається із записом), `x-correlation-id` |
| Тіло | `{ version: 1, event, data: <мінімум>, callbackUrl? }` — не рядок з БД |
| Таймаут / повтори | `AbortSignal.timeout(10_000)`; ≤ 2 повтори (1 с, 3 с) лише для мережі/таймауту/5xx/524, той самий ключ; 4xx не повторюємо |
| Відповідь n8n | лише код статусу (+ `job_id` у 202), текст не парсимо |
| Довгий воркфлоу (≥ десятків секунд / невідомо) | **лише** 202 + колбек; Server Action не чекає n8n — виклик в `after()` |
| Колбек | `POST /api/n8n/<event>` → `app/api/n8n/[event]/route.ts`; `x-n8n-signature: sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${x-n8n-timestamp}.${rawBody}")>`, `idempotency-key: <data.jobId>:<event>` |
| URL | у коді й `.env.example` — лише `/webhook/`, ніколи `/webhook-test/` |

Повністю, з «чому» — [references/contract.md](references/contract.md).

## Як робимо

1. **Режим.** Визнач режим вебхука: подія «до відома» — Immediately; усе довге або невідомої
   тривалості — Respond to Webhook 202 + колбек ([references/response-modes.md](references/response-modes.md)).
2. **Клієнт.** `lib/n8n/client.ts` з `triggerWorkflow(event, data, { idempotencyKey, correlationId,
   callbackPath })` — шаблон у [references/code-templates.md](references/code-templates.md). Інших
   `fetch` до n8n у проєкті немає; наявні — перенести на клієнт.
3. **Server Action** (публічний ендпоінт — правило Vercel `server-auth-actions`; форма — за скілом
   форм команди, якщо він є): сесія/права/валідація → запис зі `status`, `idempotencyKey`,
   `correlationId` → `after(() => triggerWorkflow(…))` (правило `server-after-nonblocking`) →
   повертає лише `{ status, id }`.
4. **Колбек-роут** — рівно в такому порядку: невідома подія 404 / не JSON 415 → `raw = await
   req.text()` → > 64 КБ 413 → `x-n8n-timestamp` поза ±300 с 401 → HMAC + перевірка довжини +
   `timingSafeEqual`, інакше 401 → застовпити `idempotency-key`, повтор → 200 `{"duplicate": true}` →
   `JSON.parse` + форма + ключ = `${data.jobId}:${event}`, інакше 400 (ключ звільнити) → зберегти стан
   **до** відповіді (помилка → звільнити ключ, 500) → 202 `{"ok": true}` → повільне в `after()`.
5. **Сторінка статусу** читає стан із БД (`queued → processing → ready | failed`), не n8n.
6. **`.env.example`** — 4 ключі, секрети `change-me-…`, адреси локальні; справжні значення — лише
   `.env.local`. Секрет: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
7. **Журнали**: подія, напрям, `x-correlation-id`, статус, тривалість, спроба. Ніколи тіла, контактів,
   токена, підпису.
8. Текст для клієнта про налаштування вузлів n8n — [references/n8n-setup.md](references/n8n-setup.md);
   рядок у `docs/n8n-integrations.md` проєкту.

## Чекліст

```
- [ ] 1. Жодного /webhook-test/ у коді й .env.example; жодної NEXT_PUBLIC_N8N_*.
- [ ] 2. Усі виклики n8n — лише через lib/n8n/client.ts з import "server-only".
- [ ] 3. Кожна спроба з AbortSignal.timeout(10_000); повтори лише мережа/таймаут/5xx/524, той самий idempotency-key.
- [ ] 4. Запит несе x-n8n-token, idempotency-key, x-correlation-id; тіло — конверт з мінімальним data.
- [ ] 5. Server Action не чекає n8n: виклик в after(), повертає { status, id }.
- [ ] 6. Довгий воркфлоу — 202 + колбек, не синхронне очікування.
- [ ] 7. Колбек: req.text(), підпис HMAC на сирому тілі, довжина + timingSafeEqual, вікно 300 с.
- [ ] 8. Колбек: idempotency-key застовплено до обробки, дорівнює <data.jobId>:<event>, звільняється при помилці.
- [ ] 9. Стан зберігається до відповіді 202; повільне — в after().
- [ ] 10. .env.example: 4 ключі, change-me-…, локальні адреси.
- [ ] 11. У журналах немає тіл, контактів, токенів, підписів.
- [ ] 12. node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs → 0 FAIL.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- потрібно вписати в код, `.env.example`, коміт чи журнал **справжній** токен, секрет або URL
  n8n клієнта — ти не просиш, не вгадуєш і не читаєш `.env*` (крім `.env.example`), а питаєш;
- задача вимагає тестовий URL (`/webhook-test/`) поза власним `.env.local` людини;
- секрет чи токен мав би потрапити в Client Component, `NEXT_PUBLIC_*`, query string або журнал;
- воркфлоу довгий або його тривалість невідома, а від тебе хочуть синхронно чекати відповідь у формі;
- невідомо, в якому режимі відповідає вебхук клієнта, яка назва події (шлях) чи які поля потрібні
  воркфлоу в `data`;
- треба змінити воркфлоу в n8n, експортувати чи імпортувати його JSON, або відправити запит на
  справжній (не локальний) n8n;
- перевірку підпису, вікна часу чи ідемпотентності пропонують вимкнути або «спростити» — навіть
  тимчасово, для демо чи «бо мок так не вміє».

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL (у гілці з
      наявним старим кодом — ще й `--changed-since <base>` для своїх змін).
- [ ] Мок: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`
      (`--help` — усі режими). У журналі мока: `POST /webhook/<event> -> 202`, `auth=ok`,
      `idempotency=new`; через 5 с — колбек із відповіддю застосунку **202**.
- [ ] Форма відповідає за частку секунди (DevTools → Network), не через 2–90 с.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event>`
      → усі випадки PASS (неправильний підпис 401, повтор 200 duplicate, переформатоване тіло 401…).
- [ ] Журнал сервера після сценарію: є подія й `correlation=…`, немає тіл, email, телефонів, токенів.

## Файли скіла

- [references/contract.md](references/contract.md) — повний контракт: змінні, заголовки, конверт,
  повтори, 10 кроків колбека, ідемпотентність, журнали, ліміти.
- [references/response-modes.md](references/response-modes.md) — режими вебхука, правило 100 с / 524,
  статуси запису, тестовий vs production URL.
- [references/code-templates.md](references/code-templates.md) — перевірені шаблони: `lib/n8n/client.ts`,
  колбек-роут, сховище ключів, реєстр подій, Server Action (Immediately і 202 + колбек), `.env.example`.
- [references/n8n-setup.md](references/n8n-setup.md) — налаштування вузлів n8n текстом для клієнта,
  реєстр інтеграцій.
- [references/pitfalls.md](references/pitfalls.md) — пастки в документації й чужих скілах, межі скіла.
- `scripts/check-contract.mjs` — статична перевірка контракту (14 перевірок, `--root`,
  `--changed-since`, `--help`); ненульовий код виходу при FAIL.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти роуту (`--help`).
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (Webhook, Header Auth, 202, підписаний колбек; `--help`).
