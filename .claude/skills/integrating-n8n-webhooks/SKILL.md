---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 ↔ n8n: виклик вебхука n8n із серверного коду
  (production-URL, Header Auth x-n8n-token, idempotency-key, x-correlation-id, конверт
  { version, event, data, callbackUrl }, таймаут і повтори), режими відповіді (Immediately /
  Respond to Webhook 202 + колбек), підписаний колбек n8n → Next.js (HMAC-SHA256, сире тіло,
  timingSafeEqual, вікно 300 с, ідемпотентність), змінні N8N_*, журнали без персональних даних;
  скрипт перевірки контракту й локальний мок n8n. Використовуй, коли форма, Server Action чи Route
  Handler запускає воркфлоу n8n або приймає від нього результат: «відправ заявку в n8n», «запусти
  воркфлоу», «вебхук n8n», «n8n має повернути результат», «колбек від n8n», «запит на кошторис
  через n8n», «PDF генерує n8n», «інтеграція з автоматизацією клієнта». Не для: побудови чи
  експорту воркфлоу в редакторі n8n, коду вузла Code в n8n, черг і фонових воркерів.
metadata:
  owner: QuitCode agency
  version: "0.1.0"
---

# Next.js ↔ n8n: контракт інтеграції

Форма в Next.js запускає воркфлоу клієнта в n8n, n8n повідомляє про результат колбеком. Контракт
нижче — узгоджене рішення команди: відхилятися лише свідомо й письмово (у PR з поясненням).
Без нього заявки губляться на тестовому URL, користувач чекає на довгий воркфлоу, а колбек може
підробити будь-хто.

## Коли застосовувати

- Код, що надсилає щось у n8n (вебхук), або ендпоінт, що приймає колбек від n8n.
- Змінні `N8N_*`, `.env.example`, налаштування мока n8n для локальної розробки.
- **Не** застосовувати: зміни воркфлоу в редакторі n8n, експорт/імпорт JSON воркфлоу, код для
  вузла Code, черги й воркери — це поза межами (див. [n8n-setup.md](references/n8n-setup.md)).

## Контракт коротко

| | Next.js → n8n | n8n → Next.js (колбек) |
|---|---|---|
| Хто | лише `lib/n8n/client.ts` (`import "server-only"` першим рядком) | Route Handler `app/api/n8n/[event]/route.ts` |
| URL | `POST ${N8N_WEBHOOK_BASE_URL}/<event>` — завжди `/webhook/…`, ніколи `/webhook-test/…` | `POST ${APP_BASE_URL}/api/n8n/<event>` |
| Захист | заголовок `x-n8n-token` = `N8N_WEBHOOK_TOKEN` (Header Auth; неправильний → 403) | `x-n8n-signature: sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "<x-n8n-timestamp>.<сире тіло>")>` |
| Ідемпотентність | `idempotency-key` — UUID, один на бізнес-операцію, зберігається з записом, той самий у повторах | `idempotency-key` = `<data.jobId>:<event з тіла>`; повтор → 200 `{"duplicate":true}` |
| Трасування | `x-correlation-id` — UUID ланцюжка, у журнали обох систем | той самий `x-correlation-id` |
| Тіло | `{ version: 1, event, data: <мінімум>, callbackUrl? }` | `{ version: 1, event: "<event>.completed", data: { jobId, status, … } }` |
| Відповідь | довге (або невідомо скільки) → 202 `{ job_id }` + колбек; дивимось лише на код статусу | 202 `{"ok":true}` після збереження стану |

Деталі й «чому»: [contract.md](references/contract.md) (змінні, запит, режими, повтори, ліміти),
[callback.md](references/callback.md) (порядок обробки колбека),
[code-templates.md](references/code-templates.md) (готові `client.ts`, `route.ts`, Server Action),
[n8n-setup.md](references/n8n-setup.md) (що налаштувати в n8n, відомі пастки).

## Як робимо

1. **Змінні:** `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_TOKEN`, `N8N_CALLBACK_SECRET`, `APP_BASE_URL` —
   лише серверні, без `NEXT_PUBLIC_`. У `.env.example` — секрети `change-me-…`, адреси локальні
   (`http://127.0.0.1:5678/webhook`, `http://127.0.0.1:3000`); справжні — у `.env.local`.
2. **Виклик n8n** — лише через `lib/n8n/client.ts`: заголовки з таблиці, `signal:
   AbortSignal.timeout(10_000)` на кожну спробу, до 2 повторів (1 с, 3 с) лише на мережеву
   помилку, таймаут, 5xx і 524 — з тим самим `idempotency-key`; 4xx не повторюємо.
3. **Хто викликає:** дія з UI — Server Action з перевіркою сесії, прав і валідацією всередині
   (`server-auth-actions` зі скіла `vercel-react-best-practices`). Дія зберігає запис зі статусом
   `queued` і повертає `{ status, id }`; виклик n8n з повторами — в `after()`
   (`server-after-nonblocking`). Користувач на n8n не чекає.
4. **Колбек** — строго в порядку з [callback.md](references/callback.md): подія зі шляху → 404,
   тип медіа не рівно `application/json` → 415, сире тіло з лімітом 64 КБ ще під час читання
   (`readRawBody` → `.text()`, не `.json()`) → 413, час поза ±300 с →
   401, HMAC + `timingSafeEqual` (спершу довжини) → 401, «застовпити» ключ (дубль → 200
   `{"duplicate":true}`), лише тоді `JSON.parse` і звірка тіла з шляхом і ключем → 400, зберегти
   стан, 202. Впало після «застовпити» — ключ звільнити. Повільне — в `after()`.
5. **Журнали:** подія, напрям, `x-correlation-id`, статус, тривалість, спроба, довжина й sha256
   тіла. Ніколи — тіло, ім'я, email, телефон, IP, токен, підпис, секрет, URL з query.
6. **Runtime** — лише Node.js (потрібен `node:crypto`); `export const runtime = "edge"` не ставимо.
7. **Реєстр:** нова подія — рядок у `docs/n8n-integrations.md` проєкту (event, напрям, шлях n8n,
   режим, власник).

## Чекліст

```
- [ ] 1. Жодного /webhook-test/ у коді й .env.example; жодної N8N_* з префіксом NEXT_PUBLIC_.
- [ ] 2. fetch до n8n — лише в lib/n8n/client.ts, перший рядок — import "server-only".
- [ ] 3. Кожна спроба — з AbortSignal.timeout(10_000); повтори лише мережа/таймаут/5xx/524.
- [ ] 4. Заголовки x-n8n-token, idempotency-key (той самий у повторах), x-correlation-id.
- [ ] 5. data — мінімум для воркфлоу, не рядок з бази (без IP, user agent, нотаток, сирої форми).
- [ ] 6. Server Action не чекає на n8n: запис queued → { status, id } → after().
- [ ] 7. Колбек: сире тіло (.text()) з лімітом під час читання; JSON.parse лише після timingSafeEqual; вікно 300 с.
- [ ] 8. Колбек: idempotency-key застовплено, звірено з тілом, звільнено при збої; 202 після запису.
- [ ] 9. Журнали без тіл, персональних даних і секретів.
- [ ] 10. node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs (з кореня проєкту) — 0 FAIL.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- Потрібен **тестовий** URL (`/webhook-test/`) у коді, `.env.example` чи конфігурації — не став
  його сам; тимчасово його ставить лише людина у свій `.env.local`.
- Секрет чи токен мав би потрапити в клієнтський код, `NEXT_PUBLIC_*`, query string, журнал, git
  або відповідь API. Значень секретів не вигадуй, не друкуй і не читай `.env.local` — попроси людину.
- Хочеться синхронно чекати воркфлоу, тривалість якого невідома або може наблизитись до 100 с —
  спитай про режим; за замовчуванням асинхронно (202 + колбек).
- Невідомо, який режим відповіді (Immediately / Respond to Webhook) і шлях має воркфлоу клієнта.
- Задача вимагає змінити, експортувати чи імпортувати воркфлоу в n8n, або написати код вузла Code.
- Хочеться послабити перевірку колбека (без підпису, без вікна часу, `===` замість
  `timingSafeEqual`, «тимчасово для налагодження»).
- Сховище `idempotency-key` для продакшну — лише пам'ять процесу (serverless її не ділить) —
  спитай, де зберігати.
- Треба відправити в n8n персональні дані понад мінімум, файли замість посилань, або встановити
  пакет (встановлення — лише після «так» людини).

Без винятків «якщо задача цього потребує».

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` — 0 FAIL
      (`--help` — прапорці; `--changed-since <ref>` — лише ваші зміни).
- [ ] Сценарій з моком: `.env.local` з ключами контракту, `npm run build && npm start`, у другому
      терміналі `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`;
      форма відповідає одразу; у журналі мока `POST /webhook/<event> -> 202`, `auth=ok`,
      `idempotency=new`; через ~5 с колбек → `202`; сторінка результату показує готовий стан.
- [ ] Матриця колбеків: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event>`
      — усі 11 випадків `ok` (повтор → 200 `{"duplicate":true}`, невідома подія → 404, зіпсований
      підпис чи старий `x-n8n-timestamp` → 401, чужий ключ чи тіло не тієї форми → 400, > 64 КБ → 413).
- [ ] У журналах застосунку й мока — жодних тіл, email, телефонів, токенів.

## Файли скіла

- [references/contract.md](references/contract.md) — змінні, запит до n8n, режими відповіді,
  тестовий і production URL, повтори, журнали, ліміти. Читати перед будь-яким викликом n8n.
- [references/callback.md](references/callback.md) — колбек крок за кроком і чому саме так.
  Читати перед написанням `app/api/n8n/[event]/route.ts`.
- [references/code-templates.md](references/code-templates.md) — шаблони `lib/n8n/client.ts`,
  `lib/n8n/idempotency.ts`, `app/api/n8n/[event]/route.ts`, Server Action з `after()`.
- [references/n8n-setup.md](references/n8n-setup.md) — що передати людині для налаштування
  воркфлоу (Webhook, Remove Duplicates, Respond to Webhook, Crypto, HTTP Request), відомі пастки.
- `scripts/check-contract.mjs` — статична перевірка контракту (C1–C13, PASS/FAIL, файл:рядок,
  код виходу 1 при FAIL; значень секретів не друкує). `node scripts/check-contract.mjs --help`.
- `scripts/self-test.mjs` — регресія самого `check-contract.mjs`: код як у `main` LeadDesk,
  навмисно поганий код (усі 13 FAIL), шаблони з `code-templates.md` (LF, CRLF, `src/` — 0 FAIL),
  `--changed-since`, коди виходу. Запускати після кожної зміни скрипта чи шаблонів.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти роуту з очікуваним
  кодом на кожен випадок; секрет — лише з `N8N_CALLBACK_SECRET`. `--help`.
- `scripts/mock-n8n.mjs` — офлайн-мок n8n (копія `tools/mock-n8n.mjs`, щоб скіл працював в інших
  проєктах). `node scripts/mock-n8n.mjs --help`.
