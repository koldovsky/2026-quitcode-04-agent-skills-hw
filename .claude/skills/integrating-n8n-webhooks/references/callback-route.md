# n8n → Next.js: колбек-роут (деталі й «чому»)

Route Handler — публічний HTTP-ендпоінт, тож довіряємо **лише підпису**.
Ендпоінт: `POST /api/n8n/<event>` → файл `app/api/n8n/[event]/route.ts` (один роут на всі події,
відомі події — у мапі обробників).

## Заголовки від n8n

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-timestamp` | Unix-час у **секундах**, коли n8n підписав запит |
| `x-n8n-signature` | `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>` |
| `idempotency-key` | `<data.jobId>:<event>` — ті самі значення, що в підписаному тілі |
| `x-correlation-id` | скопійований із запиту, що запустив воркфлоу |

Тіло:

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
Запис знаходимо за `data.requestIdempotencyKey` (= `idempotency-key`, з яким ми викликали вебхук)
або за `jobId`, який повернув n8n у відповіді 202, якщо ми його зберегли.

## Порядок обробки — саме такий

| # | Крок | Відповідь |
|---|---|---|
| 1 | Подія зі шляху невідома → 404; **медіатип** (без параметрів) не `application/json` → 415. `application/json; charset=utf-8` — так, `application/jsonx` — ні (не `startsWith`!). **До** читання тіла | 404 / 415 |
| 2 | Тіло як сирий текст — обмеженим читанням потоку (`readBodyLimited`), не `req.text()`: chunked-запит без `Content-Length` інакше прочитався б у пам'ять повністю. Ні `req.json()`, ні `JSON.parse` до підпису: повторна серіалізація міняє байти | — |
| 3 | `Content-Length` > 64 КБ → 413 **ще до читання тіла**; після читання — ще раз за фактичною довжиною `raw` (колбек несе посилання, не файли) | 413 |
| 4 | `x-n8n-timestamp` відрізняється від «зараз» більш ніж на **300 с** у будь-який бік → 401 (захист від replay) | 401 |
| 5 | HMAC від `` `${timestamp}.${raw}` ``; порівняння: спершу довжини, потім `crypto.timingSafeEqual` (кидає на різних довжинах). **Не** `===`. Не збігається → 401 **без подробиць** | 401 |
| 6 | «Застовпити» `idempotency-key` (унікальний запис). Уже був → 200 `{"duplicate": true}` | 200 |
| 7 | Тепер `JSON.parse(raw)` + перевірка форми. Не та форма, `event` у тілі ≠ `<event зі шляху>.<data.status>` (тобто `.completed` лише з `status: "completed"`, `.failed` — з `"failed"`), або `idempotency-key` ≠ `` `${data.jobId}:${body.event}` `` → 400 | 400 |
| 8 | `data.correlationId` ≠ `correlationId`, збережений у записі (n8n копіює його з нашого запиту в підписане тіло) → 409: колбек не про цей запит. Зберегти мінімальний стан (`status = ready`, посилання) **до** відповіді. Завершений запис (`ready`/`failed`) **не перезаписуємо**: колбек іншої задачі для того самого запиту → 409 (другий чи застарілий запуск воркфлоу). Якщо після кроку 6 обробка не застосувалась (кроки 7–8: 400, 409, 5xx) — **звільнити** ключ, інакше повтор n8n отримає `duplicate` і результат загубиться | 409 |
| 9 | Відповісти **202** `{"ok": true}` | 202 |
| 10 | Повільне (листи, сповіщення) — в `after()` | — |

Чому запис до відповіді: отримавши 2xx, n8n колбек не повторить. Якби критичний запис жив лише
в `after()` і впав — результат загубився б назавжди.

Чому ключ звіряємо з тілом (крок 7): заголовок `idempotency-key` підписом не захищений. Хто
перехопив один підписаний колбек, міг би в межах 300 с надіслати ті самі байти з новим ключем.
Коли ключ мусить дорівнювати полям підписаного тіла — повтор з тим самим ключем = дублікат, з іншим = 400.

Сховище ключів — БД чи KV з унікальним обмеженням. Пам'ять процесу — лише для демо (на serverless
обробники не ділять стан).

## Шаблон `app/api/n8n/[event]/route.ts`

```ts
import crypto from "node:crypto";
import { after } from "next/server";

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;
// відомі події; обробник повертає "applied" або "conflict" (завершений запис не чіпаємо)
const HANDLERS: Record<string, (body: Callback) => Promise<"applied" | "conflict">> = { "quote-request": handleQuoteCallback };

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;   // не з прототипу (/api/n8n/toString)
  if (!handler) return Response.json({ error: "not_found" }, { status: 404 });                  // 1
  const mediaType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json")                          // не startsWith: application/jsonx — 415
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });

  const declared = Number(req.headers.get("content-length"));                                     // 3 (до читання)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  const raw = await readBodyLimited(req, MAX_BODY_BYTES);                                         // 2 (сирі байти)
  if (raw === null) return Response.json({ error: "too_large" }, { status: 413 });                // 3: chunked без Content-Length теж

  const ts = Number(req.headers.get("x-n8n-timestamp"));                                          // 4
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > WINDOW_SECONDS) return unauthorized();

  const secret = process.env.N8N_CALLBACK_SECRET;                                                 // 5
  if (!secret) return Response.json({ error: "not_configured" }, { status: 500 });
  const expected = Buffer.from("sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex"));
  const received = Buffer.from(req.headers.get("x-n8n-signature") ?? "");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return unauthorized();

  const key = req.headers.get("idempotency-key") ?? "";                                           // 6
  if (!key) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!(await claimIdempotencyKey(key))) return Response.json({ duplicate: true }, { status: 200 });

  try {
    const body = parseCallback(raw);   // 7: JSON.parse усередині, у try/catch — не JSON → null → 400, а не 500
    if (!body || body.event !== `${event}.${body.data.status}` || key !== `${body.data.jobId}:${body.event}`) {
      await releaseIdempotencyKey(key);
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    if ((await handler(body)) === "conflict") {                                                   // 8
      await releaseIdempotencyKey(key);
      return Response.json({ error: "conflict" }, { status: 409 });
    }
    const { correlationId } = body.data;                                                          // лог — похідні значення (C14)
    console.info("n8n.callback", { event: body.event, correlationId, bytes: raw.length });
    after(() => { /* листи, сповіщення */ });                                                     // 10
    return Response.json({ ok: true }, { status: 202 });                                          // 9
  } catch {
    await releaseIdempotencyKey(key);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });

// Тіло як текст, але не більше limit байтів: req.text() прочитав би в пам'ять усе, скільки б не надіслали.
async function readBodyLimited(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Сире тіло → типізований колбек або null (не JSON, не та форма). Жодних винятків назовні.
function parseCallback(raw: string): Callback | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  // …перевірка version, event, data.jobId, data.status, data.requestIdempotencyKey, data.correlationId…
  return isCallback(value) ? value : null;
}
```

`RouteContext<"/api/n8n/[event]">` — глобальний тип Next.js 16 (генерується при `next build`/`next dev`);
`params` — Promise, його треба `await`.

## Перевірка роуту

Роут запущено (`npm run build && npm start`), у `.env.local` є `N8N_CALLBACK_SECRET`:

```bash
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs \
  --url http://127.0.0.1:3000/api/n8n/quote-request --request-key <idempotency-key запиту, що чекає колбека> \
  --correlation-id <x-correlation-id того самого запиту>
```

`--request-key` — `idempotency-key`, з яким застосунок викликав n8n для запиту, що ще **чекає** колбека, `--correlation-id` —
його `x-correlation-id` (без них `valid` іде на невідомий запит, а `wrong-correlation` і `other-job-same-request`
пропускаються). 20 випадків: 415 ×2 (`text/plain`, `application/jsonx`), 401 ×9 (без підпису, випадковий/короткий
підпис, інший секрет, час −10 хв / +10 хв / не число, переформатоване тіло, `charset` з поганим підписом), 413, 400 ×2
(не JSON; `.completed` зі `status: "failed"`), 404, `wrong-correlation` 409, `valid` 202, `repeat` 200 `duplicate`,
`replay-new-key` 400, `other-job-same-request` 409. Має бути `0 failed`.
