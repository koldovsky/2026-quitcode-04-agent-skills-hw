---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 (App Router) ↔ n8n: виклик вебхука воркфлоу з Server Action
  чи Route Handler (серверний модуль lib/n8n/client.ts, Header Auth x-n8n-token, idempotency-key,
  x-correlation-id, таймаут, повтори), асинхронні воркфлоу через 202 + підписаний колбек (HMAC,
  timingSafeEqual, вікно 300 с, ідемпотентність), змінні N8N_*, журнали без персональних даних,
  локальний мок n8n і скрипт перевірки контракту. Use when код запускає воркфлоу n8n або приймає
  виклик від n8n: форма чи дія, що «відправляє в n8n», вебхук, колбек або ендпоінт, який викличе n8n,
  статус задачі, яку робить n8n, змінні N8N_* у .env. Тригери: «запусти воркфлоу n8n», «надішли лід /
  заявку / кошторис у n8n», «n8n викличе ендпоінт, коли буде готово», «вебхук n8n», «колбек від n8n»,
  «воркфлоу працює хвилину», «n8n повертає 403 / 404 / 524». Не для: побудови чи зміни воркфлоу в
  редакторі n8n, імпорту/експорту JSON воркфлоу, коду для вузла Code в n8n, інших інтеграцій (Zapier, Make).
metadata:
  owner: studio-nova-web
  version: "0.1.4"
---

# Next.js ↔ n8n: контракт команди

Форма запускає воркфлоу в n8n, n8n повідомляє, коли результат готовий. Контракт — URL, заголовки, підпис,
режими відповіді, повтори — узгоджено один раз і однаковий у всіх проєктах. Відхилятися можна лише
свідомо й письмово (у PR), а не «бо так згенерувалось». Скрипт `scripts/check-contract.mjs` перевіряє, що
код його дотримується.

## Коли застосовувати

- Код надсилає щось у n8n (вебхук) або приймає виклик від n8n (колбек), або змінює змінні `N8N_*`.
- **Не** застосовувати: воркфлоу в редакторі n8n, JSON воркфлоу, вузол Code, інші платформи автоматизації.

## Контракт коротко

| Що | Як |
|---|---|
| Змінні (лише серверні, без `NEXT_PUBLIC_`) | `N8N_WEBHOOK_BASE_URL` (…`/webhook`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL`. У `.env.example` секрети — `change-me-…`, адреси — `http://127.0.0.1:5678/webhook`, `http://127.0.0.1:3000` |
| Хто говорить з n8n | **лише** `lib/n8n/client.ts`, перший рядок `import "server-only";` (пакет у Next.js 16 не потрібен) |
| Запит | `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` у kebab-case; заголовки `x-n8n-token`, `idempotency-key` (UUID на бізнес-операцію, збережений із записом), `x-correlation-id`; тіло `{ version: 1, event, data, callbackUrl? }`, `data` — мінімум |
| Таймаут і повтори | `signal: AbortSignal.timeout(10_000)`; до 2 повторів (1 с, 3 с) лише на мережеву помилку, таймаут, 5xx, 524 — з тим самим ключем; 4xx не повторювати |
| Відповідь n8n | лише код статусу; текст не парсити |
| Довгий воркфлоу (може наблизитись до 100 с або тривалість невідома) | **асинхронно**: Server Action зберігає запис (`queued`), відповідає одразу, виклик n8n — в `after()`; n8n відповідає 202 і потім кличе колбек |
| Колбек | `POST /api/n8n/<event>` → `app/api/n8n/[event]/route.ts`: 404/415 до тіла → `request.text()` → 413 (> 64 КБ) → 401 (час ±300 с) → 401 (HMAC `sha256=` від `` `${timestamp}.${raw}` ``, довжина + `timingSafeEqual`) → застовпити `idempotency-key` (повтор → 200 `{"duplicate":true}`) → `JSON.parse` + форма, ключ = `` `${data.jobId}:${event}` `` (інакше 400, ключ звільнити) → зберегти стан **до** відповіді → 202 `{"ok":true}` → повільне в `after()` |
| Журнали | подія, напрям, `x-correlation-id`, статус, тривалість, розмір і sha256 тіла; **ніколи** тіла, імена, email, телефони, токени, підписи |
| Runtime | ніколи `export const runtime = "edge"` |

Server Action — публічний POST-ендпоінт: автентифікація, права й валідація всередині (правило
`server-auth-actions` скіла `vercel-react-best-practices`); повільне — в `after()` (`server-after-nonblocking`).
Тут ці правила не переписуємо.

## Як робимо

1. Визнач режим відповіді воркфлоу за тривалістю — [references/response-modes.md](references/response-modes.md).
2. Додай змінні в `.env.example` (плейсхолдери) — і попроси людину заповнити `.env.local`: сам його не відкривай.
3. Напиши `lib/n8n/client.ts`, дію й (для асинхронних) колбек-роут за шаблонами —
   [references/code-templates.md](references/code-templates.md). Деталі й «чому» —
   [references/contract.md](references/contract.md).
4. Сховище: запис із `status`, `requestKey` (idempotency-key запиту), `correlationId`; окремо — застовплені
   ключі колбеків з унікальністю. Id сторінки статусу — `randomUUID()`, не послідовний.
5. Перевір: `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL, далі сценарій з моком (Verify).
6. Налаштування воркфлоу для клієнта — текстом, [references/n8n-setup.md](references/n8n-setup.md).
   Рядок у `docs/n8n-integrations.md`: `event | напрям | шлях n8n | режим | власник`.

## Чекліст

```
- [ ] 1. Жодного /webhook-test/ у коді й .env.example; жодної NEXT_PUBLIC_ змінної для n8n.
- [ ] 2. fetch до n8n — лише в lib/n8n/client.ts з import "server-only" і AbortSignal.timeout.
- [ ] 3. Заголовки x-n8n-token, idempotency-key (збережений із записом), x-correlation-id; тіло { version: 1, event, data }.
- [ ] 4. Повтори лише на мережу / таймаут / 5xx / 524, не більше двох, той самий ключ.
- [ ] 5. Користувач не чекає n8n: запис → відповідь; виклик — в after().
- [ ] 6. Колбек: request.text(), 413, вікно 300 с, HMAC + довжина + timingSafeEqual, ключ застовплено й звірено з jobId:event, стан збережено до 202.
- [ ] 7. Журнали без тіл і персональних даних; відповіді помилок без подробиць.
- [ ] 8. .env.example — чотири ключі, секрети change-me-…, локальні адреси.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- тобі дали або просять вписати тестовий URL (`/webhook-test/…`) у код чи `.env.example`;
- секрет чи токен мав би опинитися в Client Component, `NEXT_PUBLIC_`-змінній, query string, журналі чи відповіді;
- задача вимагає, щоб форма **чекала результату** воркфлоу, який може тривати понад ~10 с — запропонуй 202 + колбек;
- треба прийняти колбек **без** підпису або з іншою схемою підпису, ніж у контракті;
- треба перейменувати чи змінити сенс поля конверта (це нова `version`, її погоджують з власником воркфлоу);
- потрібні справжні значення змінних (`.env.local` не відкривай і не виводь), нова npm-залежність, або
  треба змінити, експортувати чи імпортувати воркфлоу клієнта;
- n8n відповідає 403/404 на production-URL — це токен чи публікація воркфлоу, а не привід повторювати.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL, код виходу 0 (`--help` — що перевіряється;
      `--changed-since <ref>` — лише твої зміни).
- [ ] Мок: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000` →
      у журналі мока `POST /webhook/<event> -> 202`, `auth=ok`, `idempotency=new`, потім
      `callback POST … -> 202`; відповідь форми — без очікування воркфлоу.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --request-key <ключ запису>` →
      усі випадки як очікувано (401 на підпис і час, 413, 415, 404, дублікат → 200, новий ключ → 400).
- [ ] Журнал сервера після сценарію: немає тіл, email, телефонів, токенів, підписів.

## Файли скіла

- [references/contract.md](references/contract.md) — повний контракт: змінні, запит, повтори, колбек по кроках із кодами, журнали, ліміти.
- [references/response-modes.md](references/response-modes.md) — режими Webhook, 100 с / 524, коди відповіді, тестовий vs production URL, мок.
- [references/code-templates.md](references/code-templates.md) — `lib/n8n/client.ts`, сховище, Server Action з `after()`, колбек-роут.
- [references/n8n-setup.md](references/n8n-setup.md) — налаштування воркфлоу на боці n8n текстом для клієнта.
- `scripts/check-contract.mjs` — 15 статичних перевірок (C1–C15), PASS/FAIL/N/A, `файл:рядок`, `--root`, `--changed-since`, `--help`.
- `scripts/selftest-check-contract.mjs` — доводить, що перевірки справжні: шаблони → 0 FAIL, кожна зламана → FAIL.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти запущеного роуту.
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (Webhook, Respond to Webhook, Header Auth, підписаний колбек), `--help`.
