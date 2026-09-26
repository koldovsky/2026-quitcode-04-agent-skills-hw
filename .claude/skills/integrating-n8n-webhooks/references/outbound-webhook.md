# Next.js → n8n: виклик вебхука (деталі й «чому»)

## Змінні середовища

Усі — лише серверні. Next.js вбудовує в клієнтський бандл тільки змінні з префіксом `NEXT_PUBLIC_`,
тому жодна `N8N_*` цього префікса не має
([environment variables](https://nextjs.org/docs/app/guides/environment-variables); локально —
`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`).

| Змінна | Що це | `.env.example` (локально) |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | База **production**-URL вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | Значення заголовка `x-n8n-token` (= credential Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | HMAC-секрет колбеків (= Hmac Secret у Crypto credential в n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | Адреса застосунку, за якою n8n бачить колбек-роути | `http://127.0.0.1:3000` |

- Справжні значення — лише у `.env.local` (git-ignored) і в налаштуваннях хостингу.
- Секрет генеруємо: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- Секрет ніколи не йде в query string, Client Component чи журнал.
- Старий ключ `N8N_WEBHOOK_URL` з повним шляхом події — не використовуємо: одна база + шлях події.

## Де живе код

Один модуль `lib/n8n/client.ts`, перший рядок — `import "server-only"`: імпорт із Client Component
тоді ламає збірку. Прямих `fetch` до n8n поза цим модулем немає (перевірки C3, C4).
Встановлювати пакет `server-only` **не треба**: Next.js 16 сам аліасить цей імпорт
(`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — «installing
`server-only` … is optional»). Не додавай його в `package.json` без потреби.

## Запит

`POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` — kebab-case (`lead-created`, `quote-request`).
Одна подія — один шлях: n8n дозволяє лише один вебхук на пару «шлях + метод».

| Заголовок | Значення |
|---|---|
| `content-type` | `application/json` |
| `x-n8n-token` | `N8N_WEBHOOK_TOKEN` |
| `idempotency-key` | UUID, створений **один раз** на бізнес-операцію і збережений разом із записом; у повторах — той самий |
| `x-correlation-id` | UUID ланцюжка дій; його ж пишемо в журнали |

Тіло — конверт:

```json
{
  "version": 1,
  "event": "quote-request",
  "data": { "quoteId": "q_0042", "company": "Nova Dental", "budget": 1500 },
  "callbackUrl": "http://127.0.0.1:3000/api/n8n/quote-request"
}
```

- `version` — версія конверта. Нове необов'язкове поле — та сама версія; перейменування чи зміна
  сенсу поля — нова версія (воркфлоу якийсь час приймає обидві).
- `data` — **мінімум**, який потрібен воркфлоу. Ніколи весь рядок з бази: IP, user agent, внутрішні
  нотатки, сирі дані форми n8n не потрібні (перевірка C15).
- `callbackUrl` = `${APP_BASE_URL}/api/n8n/<event>` — лише для асинхронних воркфлоу.

## Таймаут і повтори

- Кожна спроба — `fetch(url, { …, signal: AbortSignal.timeout(10_000) })` (C5). В асинхронному режимі
  n8n відповідає одразу після отримання запиту, тож довга відповідь = збій, а не «повільний воркфлоу».
- Повтори: не більше **двох** (разом 3 спроби), паузи 1 с, потім 3 с, **лише** для мережевої помилки,
  `TimeoutError`, 5xx і 524. Завжди з тим самим `idempotency-key`.
- 4xx не повторюємо: 403 — неправильний токен; 404 — воркфлоу не опубліковано або це тестовий URL.
- Відповідь n8n: дивимось лише на **код статусу**. Текст не парсимо (документація пише «Workflow got
  started», а код n8n повертає `Workflow was started`).

## Хто викликає

- Дія з UI — Server Action: сесія, права, валідація — всередині (`server-auth-actions`).
- Користувач **не чекає** на n8n: дія зберігає запис зі статусом (`queued`), повертає `{ status, id }`,
  а виклик n8n із повторами — в `after()` (`server-after-nonblocking`, перевірка C8). Next.js виконує
  Server Actions по одній на клієнта — довге очікування блокує наступну дію того ж користувача.
- Результат виклику (прийнято / помилка) записуємо в стан запису всередині `after()`: `queued` →
  `processing` (n8n відповів 202) або `failed` (4xx чи вичерпані повтори) — щоб сторінка статусу не
  «висіла» вічно.
- Не-React клієнт (cron, інший сервіс) — Route Handler.
- Ніколи `export const runtime = "edge"` (C13): у Next.js 16 edge застарілий, а потрібен `node:crypto`.

## Шаблон `lib/n8n/client.ts`

```ts
import "server-only";

const RETRY_DELAYS_MS = [1_000, 3_000];

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status: number | null; attempts: number };

export async function triggerN8nWebhook(options: {
  event: string;                 // kebab-case, = шлях вебхука
  data: Record<string, unknown>; // мінімум для воркфлоу
  idempotencyKey: string;        // збережений разом із записом
  correlationId: string;
  callback?: boolean;            // true для асинхронних (202 + колбек)
}): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!base || !token) throw new Error("n8n is not configured");

  const body = JSON.stringify({
    version: 1,
    event: options.event,
    data: options.data,
    ...(options.callback ? { callbackUrl: `${process.env.APP_BASE_URL}/api/n8n/${options.event}` } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(`${base}/${options.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": options.correlationId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      status = res.status;
      await res.body?.cancel();          // текст відповіді не парсимо
      if (res.ok) {
        console.info("n8n.webhook", { event: options.event, correlationId: options.correlationId, status, attempt, ms: Date.now() - started });
        return { ok: true, status, attempts: attempt };
      }
    } catch {
      // мережева помилка або TimeoutError — повторюємо
    }
    console.warn("n8n.webhook", { event: options.event, correlationId: options.correlationId, status, attempt, ms: Date.now() - started });
    const retryable = status === null || status >= 500; // 5xx і 524; 4xx — не повторюємо
    if (!retryable || attempt > RETRY_DELAYS_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
  }
}
```

## Шаблон Server Action

```ts
"use server";
import { after } from "next/server";
import { triggerN8nWebhook } from "@/lib/n8n/client";

export async function requestQuote(_prev: State, formData: FormData): Promise<State> {
  // 1. сесія / захист публічної форми; 2. валідація (див. скіл форм, якщо він є в проєкті)
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const quote = await db.insertQuote({ ...parsed.data, status: "queued",
    idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID() });

  after(async () => {
    const r = await triggerN8nWebhook({
      event: "quote-request",
      data: { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
      idempotencyKey: quote.idempotencyKey,
      correlationId: quote.correlationId,
      callback: true,
    });
    await db.updateQuote(quote.id, r.ok ? { status: "processing" } : { status: "failed" });
  });

  return { status: "ok", id: quote.id };   // лише статус і id
}
```
