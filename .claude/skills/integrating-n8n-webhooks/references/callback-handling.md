# Прийом колбеку: n8n → Next.js

## Ендпоінт

`POST /api/n8n/<path>` — Route Handler `app/api/n8n/[event]/route.ts`. Route Handler —
публічний HTTP-ендпоінт ([backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)),
тож довіряємо лише підпису.

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у секундах, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі |
| `x-correlation-id` | Скопійований із запиту, що запустив воркфлоу |

## Тіло

```json
{
  "version": 1,
  "event": "quote-request.completed",
  "data": {
    "jobId": "5f0c…",
    "status": "completed",
    "correlationId": "9b1e…",
    "requestIdempotencyKey": "c3d4…",
    "result": { "documentUrl": "https://files.example.test/n8n/5f0c….pdf" },
    "completedAt": "2026-09-21T12:00:00.000Z"
  }
}
```

`data.status` — `completed` або `failed` (тоді замість `result` — `error: { code }`).
Мок із `scripts/mock-n8n.mjs` надсилає лише `completed`.

## Порядок обробки — саме такий, без перестановок

1. Подія зі шляху (`[event]`) невідома → **404**; `content-type` не `application/json`
   → **415**. Обидві перевірки — ще до читання тіла.
2. Прочитати тіло як **сирий текст**: `const raw = await req.text()`. Тіло можна
   прочитати лише раз. Ні `req.json()`, ні `JSON.parse` до перевірки підпису —
   повторна серіалізація змінює байти, і підпис не зійдеться.
3. Тіло більше 64 КБ → **413** (колбек несе посилання, не файли).
4. `x-n8n-timestamp` відрізняється від поточного часу більш ніж на **300 секунд**
   (у будь-який бік) → **401**. Вікно — рішення команди проти replay-атак, документація
   n8n його не задає.
5. Порахувати HMAC від `` `${timestamp}.${raw}` ``, порівняти з підписом: спершу
   довжини, потім `crypto.timingSafeEqual` (кидає помилку на різних довжинах;
   [Node.js](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)). **Не `===`.**
   Не збігається → **401** без подробиць у тілі.
6. «Застовпити» `idempotency-key` (унікальний запис у БД). Вже був → **200**
   `{"duplicate": true}`: n8n не повторюватиме, дані не зміняться вдруге.
7. Тепер `JSON.parse(raw)` і перевірка форми. Не та форма, подія в тілі не відповідає
   шляху, або `idempotency-key` не дорівнює `` `${data.jobId}:${event}` `` з тіла →
   **400**.
8. Зберегти мінімальний стан (напр. `status = ready`, посилання на документ) **до**
   відповіді. Якщо після кроку 6 обробка впала (4xx/5xx на кроках 7-8) — **звільнити**
   `idempotency-key`: інакше повтор n8n (Retry On Fail) отримає `{"duplicate": true}`, і
   результат загубиться.
9. Відповісти **202** `{"ok": true}`.
10. Повільне (листи, сповіщення, інтеграції) — в `after()`.

**Чому запис до відповіді (крок 8):** отримавши 2xx, n8n колбек не повторить. Якщо
критичний запис жив би лише в `after()` і впав, результат загубився б назавжди.

**Чому ключ звіряємо з тілом (крок 7):** заголовок `idempotency-key` підписом не
захищений — HMAC рахуємо лише від `${timestamp}.${raw}`. Хто перехопив один підписаний
колбек, міг би в межах вікна 300с надіслати ті самі байти з новим ключем, і застосунок
обробив би їх удруге. Коли ключ має дорівнювати полям підписаного тіла, повтор із тим
самим ключем — дублікат, з іншим — 400.

**Сховище для `idempotency-key`** — база чи KV з унікальним обмеженням. Пам'ять процесу
годиться лише для демо: на serverless-хостингах обробники не ділять стан між запитами.

## Ідемпотентність і повтори — з обох боків

- Next.js → n8n: той самий `idempotency-key` у кожній спробі. В n8n одразу за Webhook —
  **Remove Duplicates** в режимі «Remove Items Processed in Previous Executions» з
  ключем `idempotency-key`
  ([remove duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/)).
- n8n → Next.js: HTTP Request з Retry On Fail повторює колбек; Next.js відсікає повтори
  за `idempotency-key` (крок 6) і приймає лише ключ, що збігається з підписаним тілом
  (крок 7).
- Ідемпотентність — не «приємний бонус»: і наші повтори, і Retry On Fail в n8n роблять
  дублікати неминучими.