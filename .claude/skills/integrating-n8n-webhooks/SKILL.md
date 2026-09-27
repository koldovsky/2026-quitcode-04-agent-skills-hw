---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 (App Router) ↔ n8n: виклик вебхука n8n із сервера
  (lib/n8n/client.ts, x-n8n-token, idempotency-key, x-correlation-id, таймаут і повтори),
  довгі воркфлоу — 202 + підписаний колбек у app/api/n8n/[event]/route.ts (HMAC-SHA256,
  timingSafeEqual, вікно 300 с, ідемпотентність), змінні N8N_*, журнали без персональних даних.
  Скрипт check-contract.mjs перевіряє код, mock-n8n.mjs — локальний n8n.
  Use when код запускає воркфлоу n8n, надсилає подію в n8n, приймає колбек чи вебхук від n8n,
  або змінює N8N_* у .env.example; також коли форма чи Server Action має «запустити воркфлоу»,
  «передати в n8n», «дочекатися результату від n8n», «згенерувати PDF/кошторис через n8n».
  Тригери: «воркфлоу в n8n», «вебхук n8n», «n8n викличе, коли буде готово», «ендпоінт для
  колбеку», «статус запиту», «працює 40–90 секунд», «лід не доходить в n8n», "n8n webhook".
  Не для побудови чи редагування самого воркфлоу в редакторі n8n і не для коду вузла Code.
metadata:
  owner: studio-nova-dev
  version: "0.1.1"
---

# Next.js ↔ n8n: вебхуки й колбеки

Форми й портали агенції запускають воркфлоу n8n і чекають від нього результат. Контракт нижче —
рішення команди: тестовий URL у `.env`, синхронне очікування довгого воркфлоу, незахищений колбек
і персональні дані в журналах уже коштували нам загублених заявок. Відхилення — лише свідомо й
письмово в PR, не «бо так згенерувалось».

## Коли застосовувати

- Будь-який виклик n8n з Next.js (Server Action, Route Handler, `after()`), будь-який ендпоінт,
  який викликає n8n, будь-яка зміна `N8N_*` / `APP_BASE_URL`.
- **Не** застосовувати: побудова воркфлоу в редакторі n8n, експорт/імпорт JSON воркфлоу, вузол Code.

## Контракт коротко

**Змінні — лише серверні** (жодного `NEXT_PUBLIC_N8N_*`). У `.env.example` рівно так:

```
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
```

**Next.js → n8n** — лише з `lib/n8n/client.ts`, перший рядок `import "server-only";`:

- `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` у kebab-case (`quote-request`). Ніколи `/webhook-test/`.
- Заголовки: `content-type: application/json`, `x-n8n-token`, `idempotency-key` (UUID, створений
  **один раз** на бізнес-операцію й збережений із записом), `x-correlation-id` (UUID ланцюжка).
- Тіло — конверт `{ version: 1, event, data, callbackUrl? }`; `data` — мінімум для воркфлоу, не рядок з бази.
- Кожна спроба — `signal: AbortSignal.timeout(10_000)`. Повтори: максимум 2 (1 с, 3 с), лише для
  мережевої помилки, таймауту, 5xx і 524, з тим самим `idempotency-key`. 4xx не повторюємо.
- Дивимось лише на код статусу відповіді, текст не парсимо.

**Хто викликає.** Server Action — публічний POST: сесія, права, валідація всередині
(`server-auth-actions` зі скіла `vercel-react-best-practices`). Вона зберігає запис зі статусом
`queued`, повертає лише `{ status, id }`, а виклик n8n із повторами — в `after()`
(`server-after-nonblocking`). Ніколи `export const runtime = "edge"`.

**Режим відповіді.** Усе, що може наблизитись до 100 с (або тривалість невідома), — лише
асинхронно: n8n відповідає **202** `{ job_id }`, результат приходить колбеком. Синхронне
очікування — лише для відповіді за секунди. Деталі — [references/response-modes.md](references/response-modes.md).

**n8n → Next.js: колбек** `POST /api/n8n/<event>` → `app/api/n8n/[event]/route.ts`, порядок обробки
саме такий (повністю — [references/contract.md](references/contract.md#колбек)):

1. невідома подія → 404; `content-type` не JSON → 415 (до читання тіла);
2. `const raw = await request.text()` — ні `request.json()`, ні `JSON.parse` до перевірки підпису;
3. тіло > 64 КБ → 413;
4. `|now − x-n8n-timestamp| > 300 с` → 401;
5. `x-n8n-signature` = `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${raw}")>`:
   спершу довжини, потім `crypto.timingSafeEqual`, не `===` → інакше 401 без подробиць;
6. «застовпити» `idempotency-key`; уже був → 200 `{ "duplicate": true }`;
7. `JSON.parse(raw)`, перевірка форми; подія з тіла ≠ шлях або ключ ≠ `${data.jobId}:${event}` → 400
   (і звільнити ключ);
8. зберегти мінімальний стан **до** відповіді (при помилці — звільнити ключ);
9. відповісти 202 `{ "ok": true }`; повільне — в `after()`.

**Журнали:** подія, напрям, `x-correlation-id`, код, тривалість, номер спроби, довжина й sha256
тіла. **Ніколи:** тіла, ім'я, email, телефон, IP, токен, підпис, секрет, URL з query string.

Готові шаблони `lib/n8n/client.ts`, колбек-роуту й Server Action —
[references/code-templates.md](references/code-templates.md). Що налаштувати в самому n8n (словами,
без JSON воркфлоу) і відомі пастки документації — [references/n8n-setup.md](references/n8n-setup.md).

## Чекліст

```
- [ ] 1. .env.example: 4 змінні вище; секрети change-me-…; база закінчується на /webhook; немає /webhook-test/ і NEXT_PUBLIC_N8N_*.
- [ ] 2. Усі запити до n8n — лише з lib/n8n/client.ts, перший рядок import "server-only".
- [ ] 3. Кожен fetch до n8n: x-n8n-token, idempotency-key, x-correlation-id, конверт { version: 1, event, data }, AbortSignal.timeout(10_000).
- [ ] 4. Повтори ≤ 2, лише мережа/таймаут/5xx/524, той самий idempotency-key; 4xx — без повторів.
- [ ] 5. Server Action: перевірка сесії/прав/валідація → запис queued → { status, id }; n8n — в after().
- [ ] 6. Довгий воркфлоу — 202 + колбек; жодного синхронного очікування > кількох секунд.
- [ ] 7. Колбек: request.text() → 413 → вікно 300 с → HMAC + довжина + timingSafeEqual → ключ → JSON.parse → 400/202.
- [ ] 8. Ключ колбека = `${data.jobId}:${event}` з підписаного тіла; повтор → 200 { duplicate: true }; при помилці ключ звільнено.
- [ ] 9. Стан збережено до відповіді 2xx; у журналах немає тіл, персональних даних, токенів і підписів.
- [ ] 10. Наявні виклики n8n у проєкті (інші події) — приведено до контракту або явно винесено в окрему задачу з поясненням у відповіді.
- [ ] 11. check-contract.mjs на всьому проєкті — 0 FAIL (--changed-since показує лише твої зміни, але готово — це 0 FAIL скрізь).
```

## Правила зупинки — зупинись і спитай людину, якщо:

- задача, документація чи наявний код вимагають **тестовий** URL (`/webhook-test/`) у коді чи
  `.env.example`;
- секрет чи токен n8n мав би потрапити в Client Component, `NEXT_PUBLIC_*`, query string,
  відповідь дії чи журнал;
- воркфлоу довгий або тривалість невідома, а від тебе хочуть **синхронну** відповідь з результатом;
- невідомо, які поля воркфлоу справді потрібні в `data`, і доведеться слати весь запис чи
  персональні дані «про всяк випадок»;
- потрібно змінити сам воркфлоу n8n, його шлях, режим відповіді чи credential — це рішення власника
  воркфлоу; дай налаштування словами з [references/n8n-setup.md](references/n8n-setup.md);
- колбек неможливо перевірити підписом (немає `N8N_CALLBACK_SECRET`, n8n не вміє підписувати) —
  не роби «тимчасово без підпису»;
- хочеться `export const runtime = "edge"` чи іншого рантайму без `node:crypto`.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` — 0 FAIL
      (`--help` — усі перевірки; `--changed-since <ref>` — лише твої зміни).
- [ ] Мок у режимі асинхронного воркфлоу, у другому терміналі:
      `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`.
      У журналі мока на відправку форми — `POST /webhook/<event> -> 202`, `auth=ok`, `idempotency=new`;
      потім колбек `-> 202` від застосунку; сторінка статусу показує результат.
- [ ] Відповідь форми — менше секунди, незалежно від `--delay` мока.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event>` —
      усі негативні випадки (підпис, час, тіло, ключ, подія, content-type, розмір) дають очікуваний код.
- [ ] У журналі `npm start` немає тіл запитів, email, телефонів, токенів і підписів.

## Файли скіла

- [references/contract.md](references/contract.md) — повний контракт: змінні, запит, конверт, повтори, колбек крок за кроком, ідемпотентність, журнали, ліміти. Читай перед написанням коду.
- [references/response-modes.md](references/response-modes.md) — режими відповіді вебхука, правило 100 с / 524, тестовий і production URL.
- [references/code-templates.md](references/code-templates.md) — шаблони `lib/n8n/client.ts`, колбек-роуту, Server Action з `after()`, `.env.example`.
- [references/n8n-setup.md](references/n8n-setup.md) — налаштування воркфлоу n8n словами (Webhook, Remove Duplicates, Respond to Webhook, Crypto, HTTP Request) і відомі пастки.
- `scripts/check-contract.mjs` — статична перевірка коду на контракт; `--help`, `--root <тека>`, `--changed-since <ref>`; код виходу 1 при FAIL.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти роуту; секрет лише з `N8N_CALLBACK_SECRET`.
- `scripts/mock-n8n.mjs` — локальний n8n (копія `tools/mock-n8n.mjs`); `--help`.
