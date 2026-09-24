---
name: integrating-n8n-webhooks
description: >-
  Контракт команди Studio Nova для зв'язки Next.js 16 ↔ n8n: виклик вебхука n8n з серверного модуля
  (Header Auth x-n8n-token, idempotency-key, x-correlation-id, конверт, таймаут і повтори), довгі
  воркфлоу — лише 202 + підписаний колбек, ендпоінт колбека з перевіркою HMAC на сирому тілі, вікном
  300 с та ідемпотентністю, серверні змінні N8N_*. Має скрипт перевірки контракту й локальний мок n8n.
  Use when код запускає воркфлоу в n8n, приймає колбек чи вебхук від n8n, показує статус задачі з n8n
  або чіпає змінні N8N_* / .env.example. Тригери: «n8n», «вебхук», «webhook», «воркфлоу в n8n»,
  «запусти воркфлоу», «опублікований воркфлоу», «ендпоінт, який n8n викличе», «колбек від n8n»,
  «n8n повідомить, коли готово», «воркфлоу працює N секунд», «статус з n8n». Не для побудови чи
  редагування воркфлоу в редакторі n8n і не для коду вузла Code.
metadata:
  owner: "Studio Nova dev"
  version: "0.2.0"
---

# Integrating n8n webhooks

Наші проєкти — Next.js поверх воркфлоу клієнта в n8n: форма запускає воркфлоу, n8n повідомляє про
результат. Без спільного контракту кожен проєкт наступає на ті самі граблі — тестовий URL у `.env`,
спінер на 90 секунд і 524, незахищений колбек, подвійне оновлення після повтору, email клієнта в
журналі. Цей контракт обов'язковий; відхилення — лише свідомо й письмово в PR.

## Коли застосовувати

- Будь-який код, що викликає n8n, приймає від нього запит чи показує статус його задачі.
- Зміни змінних `N8N_*`, `APP_BASE_URL` або `.env.example`.
- **Не** застосовувати: побудова воркфлоу в редакторі n8n, експорт JSON, код вузла Code.

## Контракт коротко

| Тема | Правило | Деталі |
|---|---|---|
| Змінні | `N8N_WEBHOOK_BASE_URL` (…`/webhook`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL` — лише серверні, без `NEXT_PUBLIC_`; у `.env.example` секрети — `change-me-…` | [contract.md](references/contract.md) |
| Де код | Лише `lib/n8n/client.ts` з `import "server-only"`; ніякого `fetch` до n8n деінде; без `runtime = "edge"` | [contract.md](references/contract.md) |
| Запит | `POST ${N8N_WEBHOOK_BASE_URL}/<event>`; заголовки `x-n8n-token`, `idempotency-key` (один на операцію), `x-correlation-id`; тіло `{ version: 1, event, data (мінімум), callbackUrl }` | [contract.md](references/contract.md) |
| Надійність | `AbortSignal.timeout(10_000)` на спробу; ≤ 2 повтори (1 с, 3 с) лише на мережу / таймаут / 5xx / 524 з тим самим ключем; 4xx не повторюємо; дивимось лише на код статусу | [contract.md](references/contract.md) |
| Довгі воркфлоу | Може наблизитися до 100 с або тривалість невідома → **лише** 202 + колбек; дія відповідає `{ status, id }`, виклик n8n — в `after()` | [contract.md](references/contract.md) |
| URL | У коді й `.env.example` — лише `/webhook/`, ніколи `/webhook-test/` | [contract.md](references/contract.md) |
| Колбек | `POST /api/n8n/[event]`; `sha256=HMAC(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")`; сире тіло; довжина + `timingSafeEqual`; вікно 300 с; `idempotency-key` = `${data.jobId}:${event}`; запис до відповіді; 202 | [callback.md](references/callback.md) |
| Журнали | Подія, напрям, correlation id, статус, тривалість, спроба; ніколи тіла, персональних даних, токенів, підписів | [operations.md](references/operations.md) |

## Як робимо

1. **Змінні.** Додай чотири змінні в `.env.example` (значення — з [contract.md](references/contract.md)),
   прибери застарілі (`N8N_WEBHOOK_URL`) з коду й прикладу. Справжні значення людина кладе в `.env.local`.
2. **Клієнт.** Створи `lib/n8n/client.ts` за шаблоном із [code-templates.md](references/code-templates.md) §1:
   `server-only`, конверт, три заголовки, таймаут, повтори. Решта коду викликає лише `triggerWorkflow`.
3. **Server Action.** Сесія, права й валідація — всередині дії (правило `server-auth-actions`). Збережи
   запис зі `status: "queued"`, `idempotencyKey` і `correlationId`, поверни `{ status, id }`, а
   `triggerWorkflow` виклич в `after()` (правило `server-after-nonblocking`) у `try/catch`; невдача чи
   виняток → `status: "failed"`, щоб запис не завис у `queued`.
   Шаблон — [code-templates.md](references/code-templates.md) §4. Форму роби за скілом форм проєкту, якщо він є.
4. **Колбек.** `app/api/n8n/[event]/route.ts` + `lib/n8n/signature.ts` за [code-templates.md](references/code-templates.md)
   §2–3. Порядок перевірок і коди відповідей — строго за таблицею в [callback.md](references/callback.md).
   Сховище ключів — з унікальністю; пам'ять процесу — лише для демо, з коментарем.
5. **Статус.** Сторінка статусу читає запис з бази (`queued` → `ready` / `failed`, посилання на документ);
   n8n з неї не викликаємо.
6. **n8n.** Налаштування воркфлоу передай людині текстом за [n8n-setup.md](references/n8n-setup.md);
   інтеграцію впиши в реєстр `docs/n8n-integrations.md` ([operations.md](references/operations.md)).
7. **Перевір.** Розділ Verify нижче.

## Чекліст

```
- [ ] 1. Чотири змінні, без NEXT_PUBLIC_; .env.example: /webhook, секрети change-me-…, без старих імен.
- [ ] 2. Уся взаємодія з n8n — у lib/n8n/client.ts з import "server-only".
- [ ] 3. Заголовки x-n8n-token, idempotency-key, x-correlation-id; ключ створено один раз і збережено.
- [ ] 4. Тіло — конверт { version: 1, event, data, callbackUrl }, data без зайвих персональних даних.
- [ ] 5. Таймаут 10 с на спробу; ≤ 2 повтори лише на мережу/таймаут/5xx/524; 4xx не повторюються.
- [ ] 6. Довгий воркфлоу: дія відповідає одразу { status, id }, виклик n8n — в after().
- [ ] 7. Колбек: 404/415 до тіла → req.text() → 413 → 401 (час) → 401 (підпис) → дублікат 200 → 400 → запис → 202.
- [ ] 8. Підпис: довжина + timingSafeEqual; жодного === чи JSON.parse до перевірки.
- [ ] 9. idempotency-key застовплено з унікальністю, звіряється з тілом, звільняється при збої.
- [ ] 10. Немає /webhook-test/, runtime = "edge", тіл і персональних даних у журналах.
- [ ] 11. check-contract.mjs — 0 FAIL.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- просять використати тестовий URL (`/webhook-test/`) у коді, `.env.example` чи конфігурації
  (наявний тестовий URL замінюємо на `N8N_WEBHOOK_BASE_URL` з `/webhook` — це не привід зупинятись);
- секрет чи токен мав би потрапити в Client Component, змінну `NEXT_PUBLIC_*`, query string, журнал
  або відповідь;
- просять синхронно чекати воркфлоу, який може тривати ≥ 100 с або невідомо скільки, чи «просто
  підняти таймаут» замість 202 + колбек;
- тобі пропонують вписати значення секрету, токена чи URL n8n прямо в код, або вигадати його, щоб «запрацювало».
  (Сама відсутність змінних у `.env.local` — не привід зупинятись: код читає їх із `process.env`,
  `.env.example` отримує `change-me-…`, а в підсумку ти перелічуєш людині, які змінні додати.)
- колбек-ендпоінт мав би працювати без перевірки підпису, вікна часу чи ідемпотентності — навіть
  тимчасово;
- контракт (заголовки, формат підпису, `version` конверта, шляхи) доводиться змінити — це рішення
  людини й окремий запис у PR;
- потрібно змінити, експортувати чи імпортувати воркфлоу клієнта в n8n;
- зміна зачіпає `tools/`, `materials/` або `.env*`, крім `.env.example`.

## Verify — задача готова, лише коли:

- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` — 0 FAIL, код виходу 0
      (для змін від певного коміту — `--changed-since <ref>`).
- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Сценарій з моком (команди — [operations.md](references/operations.md)): форма відповідає одразу; журнал
      мока — `POST /webhook/<event> -> 202 … auth=ok idempotency=new`, далі `callback POST … -> 202`;
      сторінка статусу показує результат.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url <колбек>`
      — усі випадки з очікуваними кодами.
- [ ] Журнал сервера: немає тіл, email, телефонів, токенів чи підписів — лише події, id і статуси.

## Файли скіла

- [references/contract.md](references/contract.md) — змінні, вихідний запит, повтори, режими відповіді, test vs production URL.
- [references/callback.md](references/callback.md) — колбек: заголовки, тіло, 10 кроків обробки, ідемпотентність.
- [references/code-templates.md](references/code-templates.md) — шаблони `client.ts`, `signature.ts`, роуту, Server Action, `.env.example`.
- [references/n8n-setup.md](references/n8n-setup.md) — налаштування вузлів n8n словами для людини.
- [references/operations.md](references/operations.md) — журнали, ліміти, локальний мок, відомі пастки, реєстр.
- `scripts/check-contract.mjs` — статична перевірка контракту (`--help`, `--root <тека>`, `--changed-since <ref>`).
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (`--help`).
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти роуту (`--help`).
