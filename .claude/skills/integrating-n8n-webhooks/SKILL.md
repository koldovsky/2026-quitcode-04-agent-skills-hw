---
name: integrating-n8n-webhooks
description: >-
  Командний контракт QuitCode для зв'язки Next.js App Router ↔ n8n. Next.js запускає воркфлоу через
  Webhook node (серверний клієнт lib/n8n/client.ts, Header Auth x-n8n-token, idempotency-key, таймаут,
  повтори) і приймає підписані колбеки від HTTP Request node (HMAC-SHA256 над сирим тілом, вікно часу,
  ідемпотентність). Довгі воркфлоу — лише async 202 + колбек. Є офлайн-мок n8n і скрипти перевірки.
  Use when adding or reviewing any Next.js ↔ n8n integration: a Server Action or Route Handler that
  calls an n8n webhook, an endpoint n8n calls back, N8N_* env vars. Тригери: «запусти воркфлоу в n8n»,
  «виклич вебхук n8n», «підключи n8n», «ендпоінт, який викличе n8n», «n8n повідомить, коли буде
  готово», «колбек від n8n», «автоматизація в n8n працює N секунд». Не для побудови воркфлоу в
  редакторі n8n і не для коду Code node.
metadata:
  owner: quitcode
  version: "1.0.0"
---

# Інтеграція Next.js ↔ n8n (контракт команди)

Цей контракт — рішення команди, а не варіанти на вибір. Не вигадуй інших імен заголовків,
змінних чи схем підпису. Якщо задача вимагає відхилення — зупинись і спитай (див. «Правила зупинки»).
Деталі й обґрунтування — у `references/`; тут — те, що треба зробити.

## Контракт коротко

**Змінні середовища — лише серверні (жодного `NEXT_PUBLIC_`):**
`N8N_WEBHOOK_BASE_URL` (закінчується на `/webhook`), `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`,
`APP_BASE_URL`. У `.env.example` — ці ключі: секрети (`N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`) —
лише `change-me-…`, адреси — локальні (`http://127.0.0.1:5678/webhook`, `http://127.0.0.1:3000`),
жодного `/webhook-test/`. Справжні значення — у `.env.local`.

**Next.js → n8n** (`lib/n8n/client.ts`, перший рядок `import "server-only"`):
- `POST ${N8N_WEBHOOK_BASE_URL}/<event>`; `<event>` у kebab-case = шлях вебхука в n8n.
- Заголовки: `content-type: application/json`, `x-n8n-token`, `idempotency-key` (UUID, створений
  один раз на бізнес-операцію й збережений із записом), `x-correlation-id`.
- Тіло — конверт `{ "version": 1, "event", "data", "callbackUrl"? }`; у `data` — мінімум для воркфлоу
  (без IP, user agent, внутрішніх нотаток, сирих даних форми).
- Кожна спроба — `signal: AbortSignal.timeout(10_000)`. Повтори: ≤ 2 (пауза 1 с, 3 с), лише мережева
  помилка / таймаут / 5xx / 524, з тим самим `idempotency-key`. 4xx не повторюємо.
- Дивимось лише на код статусу; текст повідомлення n8n не парсимо. З 202 беремо `job_id`.

**Режим відповіді:** подія «до відома» → Immediately; швидка довідка (секунди) → When Last Node
Finishes; **усе, що може тривати ≥ 100 с або тривалість невідома → Respond to Webhook 202 + колбек**
(n8n Cloud обриває синхронний запит через 100 с кодом 524). Таблиця — `references/response-modes.md`.

**n8n → Next.js** (`app/api/n8n/[event]/route.ts`), порядок саме такий:
1. невідома подія → 404; `content-type` не JSON → 415;
2. тіло як **сирі байти** (`request.text()`/`arrayBuffer()`), > 64 КБ → 413;
3. `x-n8n-timestamp` поза вікном ±300 с → 401;
4. HMAC-SHA256(`N8N_CALLBACK_SECRET`, `` `${ts}.${raw}` ``) проти `x-n8n-signature: sha256=<hex>`:
   спершу довжина, потім `crypto.timingSafeEqual` → інакше 401 без подробиць;
5. «застовпити» `idempotency-key` → уже був: 200 `{"duplicate":true}`;
6. лише тепер `JSON.parse` і перевірка форми → 400. Заголовок `idempotency-key` **не входить у
   підпис**, тому він має дорівнювати `` `${data.jobId}:${event}` `` з підписаного тіла (для шляху
   `quote-request` це `<jobId>:quote-request.completed`) — інакше 400: перехоплений колбек інакше
   можна відтворити в межах вікна з новим ключем. Невідомий запис → 404;
7. мінімальний durable-запис **до** відповіді → 202 `{"ok":true}`; повільне — в `after()`.
   Будь-яка 4xx/5xx на кроках 6–7 **звільняє** ключ — інакше повтор n8n стане «дублікатом», і
   результат загубиться.

Шаблони коду — `references/nextjs-patterns.md`. Заголовки, коди, версії — `references/contract.md`.

## Чекліст (скопіюй у свій план і відмічай)

```
- [ ] 1. Класифікував виклик: подія / довідка / довга задача → режим відповіді (response-modes.md)
- [ ] 2. lib/n8n/client.ts: import "server-only", заголовки, конверт, таймаут, повтори, лог без тіл
- [ ] 3. Хто викликає: дія з UI → Server Action (auth + валідація всередині, повертає лише {status, id});
        не-React клієнт → Route Handler. Виклик n8n — в after(), не в очікуванні користувача
- [ ] 4. Довга задача: запис зі статусом queued ДО виклику; callbackUrl = ${APP_BASE_URL}/api/n8n/<event>
- [ ] 5. Колбек-роут у порядку «сирі байти → час → підпис → ключ → parse → запис → 202 → after()»
- [ ] 6. .env.example: 4 ключі — секрети change-me-…, адреси локальні, без /webhook-test/;
        .env* у .gitignore (крім .env.example)
- [ ] 7. Рядок у docs/n8n-integrations.md: event | напрям | шлях n8n | режим | власник
- [ ] 8. Налаштування на боці n8n — текстом для людини з references/n8n-side-setup.md (без JSON воркфлоу)
- [ ] 9. Перевірка (нижче) — усе зелене
```

Два правила зі скіла Vercel React Best Practices діють тут повністю — не переписуй їх, застосовуй:
`server-auth-actions` (Server Action — публічний ендпоінт: сесія, права й валідація всередині) і
`server-after-nonblocking` (повільне — в `after()` з `next/server`). Якщо скіл
`vercel-react-best-practices` встановлений — відкрий ці два `rules/*.md`.

## Правила зупинки — зупинись і спитай людину, якщо:

- URL містить `/webhook-test/` у коді, `.env.example` чи налаштуваннях деплою (тестовий URL живе 120 с);
- секрет чи токен мав би потрапити в `NEXT_PUBLIC_*`, query string, Client Component чи журнал;
- просять синхронно чекати воркфлоу, який може тривати ≥ 100 с або тривалість невідома;
- у журнали мали б потрапити персональні дані (ім'я, email, телефон, IP) чи тіла запитів;
- задача вимагає змінити сам воркфлоу чи його JSON — це поза межами: опиши потрібні зміни текстом;
- немає `N8N_CALLBACK_SECRET` — колбек-роут тоді відхиляє все (500), а не «пропускає без підпису».

**Ніколи, за жодних умов:**
- не логуй тіла, токени, підписи, повні URL з query string — лише подію, напрям, статус, тривалість,
  номер спроби, `x-correlation-id`, довжину тіла і sha256;
- не викликай `request.json()` і не роби `JSON.parse` до перевірки підпису;
- не порівнюй підписи через `===`/`!==`;
- не вір заголовку `idempotency-key` як є — звіряй його з полями підписаного тіла;
- не додавай `export const runtime = "edge"` (застарілий у Next.js 16, немає `node:crypto`);
- не показуй у UI посилання з колбека, не перевіривши, що це `https:` URL.

## Перевірка (задача готова, лише коли все зелене)

1. Статична перевірка контракту — 0 FAIL:
   ```bash
   node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs
   ```
2. Мок n8n з авторизацією і колбеком (Git Bash і PowerShell однаково; секрети — з `.env.local`):
   ```bash
   npm run build && npm start                      # застосунок на :3000 (в іншому терміналі)
   node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs \
     --mode respond-202 --delay 5000 --callback-url http://127.0.0.1:3000/api/n8n/<event>
   ```
   Надішли форму. У журналі мока: `POST /webhook/<event> -> 202`, `auth=ok`, `idempotency=new`,
   серед імен заголовків — `idempotency-key`, `x-correlation-id`, `x-n8n-token`; далі `callback POST … -> 202`.
   Відповідь форми — < 1 с, хоча воркфлоу «триває» 5 с. Сторінка статусу показує результат.
3. Матриця підписаних колбеків — усі PASS (неправильний підпис, прострочений час, переформатоване
   тіло, повтор із тим самим ключем, повтор тих самих байтів з іншим ключем). `--request-key` —
   ключ справжньої задачі, для кошторисів це id запиту:
   ```bash
   node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs \
     --url http://127.0.0.1:3000/api/n8n/<event> --request-key <id>
   ```
4. У журналі сервера немає тіл, email, телефонів, токенів і підписів.
5. `npm run lint` і `npm run build` — без помилок.
6. Для справжнього n8n (не мока): воркфлоу **опублікований**, опублікована версія містить останні
   правки (n8n 2.x), виклик іде на production URL, credential Header Auth і Crypto підключені.

Якщо щось не сходиться — `references/troubleshooting.md` (404, 403, 524, ECONNREFUSED, «підпис не
збігається», дублікати).

## Файли скіла

- `references/contract.md` — заголовки, конверт, коди відповідей, версіонування конверта.
- `references/response-modes.md` — чотири режими, ліміти 100 с / 120 с / 16 МБ / 1 МБ / 64 КБ.
- `references/nextjs-patterns.md` — шаблони `lib/n8n/client.ts`, Server Action, колбек-роуту, сховища ключів.
- `references/n8n-side-setup.md` — що налаштувати в n8n, словами (Webhook, Remove Duplicates, Respond,
  Crypto, HTTP Request, Publish).
- `references/security-checklist.md` — безпека одним списком.
- `references/troubleshooting.md` — симптом → причина → що робити.
- `scripts/check-contract.mjs` — статична перевірка C1–C10 (`--help`).
- `scripts/send-signed-callback.mjs` — матриця колбеків (`--help`).
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (`--help`); той самий файл, що `tools/mock-n8n.mjs` у
  навчальному репозиторії. В інший проєкт копіюй усю теку скіла.
