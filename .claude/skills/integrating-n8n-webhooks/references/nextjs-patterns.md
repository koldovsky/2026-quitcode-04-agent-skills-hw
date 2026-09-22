# Шаблони для Next.js 16 (App Router)

Три файли покривають обидва напрямки. Імена подій, змінних і заголовків — із контракту; решту
підлаштуй під проєкт. Перед зміною перевір актуальний API в `node_modules/next/dist/docs/`.

Правила зі скіла Vercel React Best Practices, на яких тримаються шаблони (не дублюю їх тут):
`server-auth-actions` — Server Action автентифікує й валідує всередині; `server-after-nonblocking` —
повільна робота в `after()` з `next/server`.

## 1. `lib/n8n/client.ts` — єдине місце, звідки йдуть запити до n8n

```ts
import "server-only";
import { createHash, randomUUID } from "node:crypto";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // at most 2 retries

export type TriggerOptions = {
  idempotencyKey: string; // UUID created once per business operation, stored with the record
  correlationId?: string;
  callbackUrl?: string; // async workflows only
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null; reason: "not-configured" | "rejected" | "unavailable" };

export function n8nCallbackUrl(event: string): string | null {
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/+$/, "")}/api/n8n/${event}` : null;
}

const retryable = (status: number) => status >= 500; // 5xx incl. 524; never 4xx

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const correlationId = options.correlationId ?? randomUUID();
  if (!baseUrl || !token) {
    console.warn(`n8n -> ${event} skipped: N8N_WEBHOOK_BASE_URL or N8N_WEBHOOK_TOKEN is not set corr=${correlationId}`);
    return { ok: false, status: null, reason: "not-configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/${event}`;
  const envelope = JSON.stringify({ version: 1, event, data, ...(options.callbackUrl ? { callbackUrl: options.callbackUrl } : {}) });
  const size = `${Buffer.byteLength(envelope)} B sha256=${createHash("sha256").update(envelope).digest("hex").slice(0, 16)}`;
  const tries = RETRY_DELAYS_MS.length + 1;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= tries; attempt++) {
    const started = Date.now();
    let outcome: string;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const answer = await response.text(); // only job_id is read, and only from a 202
      lastStatus = response.status;
      outcome = String(response.status);
      console.info(`n8n -> ${event} ${outcome} in ${Date.now() - started} ms (try ${attempt}/${tries}) corr=${correlationId} ${size}`);
      if (response.ok) return { ok: true, status: response.status, jobId: response.status === 202 ? readJobId(answer) : null };
      if (!retryable(response.status)) return { ok: false, status: response.status, reason: "rejected" };
    } catch (error) {
      outcome = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error";
      console.warn(`n8n -> ${event} ${outcome} after ${Date.now() - started} ms (try ${attempt}/${tries}) corr=${correlationId}`);
    }
    if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
  return { ok: false, status: lastStatus, reason: "unavailable" };
}

function readJobId(answer: string): string | null {
  try {
    const value = JSON.parse(answer) as { job_id?: unknown };
    return typeof value.job_id === "string" ? value.job_id : null;
  } catch {
    return null;
  }
}
```

## 2. Server Action: зберегти → відповісти → n8n в `after()`

```ts
// app/quotes/actions.ts
"use server";

import { after } from "next/server";
import { parseQuoteForm } from "@/lib/quote-form";
import { createQuoteRequest, startQuoteWorkflow } from "@/lib/quotes";

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // Public form: no session. A dashboard action would verify the session and ownership here
  // (server-auth-actions) before touching data.
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const quote = await createQuoteRequest(parsed.data); // status "queued"; quote.id = randomUUID()
  after(() => startQuoteWorkflow(quote.id)); // the user never waits for n8n (server-after-nonblocking)
  return { status: "ok", id: quote.id }; // only status + id, never the DB row
}
```

```ts
// lib/quotes.ts (import "server-only")
export async function startQuoteWorkflow(id: string) {
  const quote = await db.getQuote(id);
  if (!quote || quote.status !== "queued") return;
  const callbackUrl = n8nCallbackUrl("quote-request");
  const result = callbackUrl
    ? await triggerWorkflow(
        "quote-request",
        { quoteId: quote.id, company: quote.company, email: quote.email, description: quote.description, budget: quote.budget },
        { idempotencyKey: quote.id, correlationId: quote.correlationId, callbackUrl },
      )
    : ({ ok: false, status: null, reason: "not-configured" } as const);
  if (result.ok) await db.markQuoteProcessing(quote.id, result.jobId);
  else await db.failQuote(quote.id, `n8n-${result.reason}`);
}
```

- Ключ ідемпотентності тут — id запиту (UUID, створений один раз і збережений із записом); колбек
  повертає його в `data.requestIdempotencyKey`, за ним роут знаходить запис.
- `markQuoteProcessing` змінює лише `queued` → `processing`: колбек швидкого воркфлоу може прийти раніше.
- Подія «до відома» (Immediately): той самий `triggerWorkflow` без `callbackUrl`, у `after()`.

## 3. `lib/n8n/signature.ts` — перевірка підпису над сирими байтами

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_WINDOW_SECONDS = 300;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "bad-timestamp" | "stale-timestamp" | "bad-signature" };

export function verifyN8nSignature(input: {
  rawBody: Uint8Array;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
}): VerifyResult {
  if (!input.secret) return { ok: false, reason: "no-secret" };
  const ts = input.timestamp ?? "";
  if (!/^\d{1,12}$/.test(ts)) return { ok: false, reason: "bad-timestamp" };
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > CALLBACK_WINDOW_SECONDS) {
    return { ok: false, reason: "stale-timestamp" };
  }
  const expected = createHmac("sha256", input.secret).update(`${ts}.`).update(input.rawBody).digest();
  const hex = /^sha256=([0-9a-f]{64})$/i.exec(input.signature ?? "")?.[1];
  const given = hex ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad-signature" };
  return { ok: true };
}
```

## 4. `app/api/n8n/[event]/route.ts` — колбек

```ts
import { after } from "next/server";
import { db } from "@/lib/db";
import { parseCallbackEnvelope, readBodyLimited, type CallbackHandler } from "@/lib/n8n/envelope";
import { verifyN8nSignature } from "@/lib/n8n/signature";
import { handleQuoteCallback } from "@/lib/quotes";

// Callbacks from n8n (HTTP Request node), skill integrating-n8n-webhooks.
// Order: event -> content type -> raw bytes -> timestamp + HMAC -> idempotency claim
// -> parse -> key matches the signed body -> durable write -> 202 -> after().

const MAX_BODY_BYTES = 64 * 1024;
const HANDLERS: Record<string, CallbackHandler> = { "quote-request": handleQuoteCallback };

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  // Object.hasOwn: "toString", "constructor"... must not resolve to a handler via the prototype.
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return Response.json({ error: "unknown event" }, { status: 404 });

  // Media type only, parameters dropped: "application/json; charset=utf-8" is JSON,
  // "application/jsonx" is not (startsWith would have accepted it).
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return Response.json({ error: "unsupported media type" }, { status: 415 });
  }

  const rawBody = await readBodyLimited(request, MAX_BODY_BYTES); // bytes first, never request.json()
  if (!rawBody) return Response.json({ error: "payload too large" }, { status: 413 });

  const correlationId = (request.headers.get("x-correlation-id") ?? "-").slice(0, 64);
  const verified = verifyN8nSignature({
    rawBody,
    timestamp: request.headers.get("x-n8n-timestamp"),
    signature: request.headers.get("x-n8n-signature"),
    secret: process.env.N8N_CALLBACK_SECRET,
  });
  if (!verified.ok) {
    console.warn(`n8n <- ${event} rejected: ${verified.reason} corr=${correlationId} ${rawBody.byteLength} B`);
    return new Response(null, { status: verified.reason === "no-secret" ? 500 : 401 });
  }

  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 200) return Response.json({ error: "idempotency-key required" }, { status: 400 });
  if (!(await db.claimCallbackKey(key))) {
    console.info(`n8n <- ${event} duplicate corr=${correlationId}`);
    return Response.json({ duplicate: true }, { status: 200 });
  }

  try {
    const envelope = parseCallbackEnvelope(rawBody, `${event}.completed`); // parse only after verification
    if (!envelope) {
      await db.releaseCallbackKey(key);
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
    // The header is outside the HMAC: without this, a captured callback could be replayed
    // inside the 300 s window under a fresh key and applied again.
    if (key !== `${envelope.data.jobId}:${event}.completed`) {
      await db.releaseCallbackKey(key);
      console.warn(`n8n <- ${event} rejected: key does not match the signed job corr=${correlationId}`);
      return Response.json({ error: "idempotency-key does not match the signed body" }, { status: 400 });
    }
    const outcome = await handler(envelope.data); // small durable write BEFORE the 2xx
    if (outcome.status === "unknown-job") {
      await db.releaseCallbackKey(key);
      return Response.json({ error: "unknown job" }, { status: 404 });
    }
    if (outcome.status === "other-job") {
      await db.releaseCallbackKey(key);
      console.warn(`n8n <- ${event} rejected: callback for another job corr=${correlationId}`);
      return Response.json({ error: "callback is for another job" }, { status: 409 });
    }
    if (outcome.status === "already-final") {
      console.info(`n8n <- ${event} duplicate (already final) corr=${correlationId}`);
      return Response.json({ duplicate: true }, { status: 200 });
    }
    if (outcome.afterResponse) after(outcome.afterResponse); // slow side effects after the 2xx
    const jobStatus = envelope.data.status;
    console.info(`n8n <- ${event} ${jobStatus} accepted corr=${correlationId}`);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    await db.releaseCallbackKey(key); // let n8n's Retry On Fail try again
    console.error(`n8n <- ${event} failed corr=${correlationId}: ${error instanceof Error ? error.name : "error"}`);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
```

`lib/n8n/envelope.ts` містить типи `CallbackData` / `CallbackOutcome` / `CallbackHandler`,
`readBodyLimited` (читає `request.body` частинами й зупиняється після ліміту; `content-length` більше
ліміту → одразу `null`) і `parseCallbackEnvelope` (`JSON.parse` у try/catch + перевірка форми:
`version === 1`, `event`, `data.jobId`, `data.status ∈ {completed, failed}`, `data.requestIdempotencyKey`,
`result.documentUrl` лише `https:`). Обробник події (тут `handleQuoteCallback` з `lib/quotes.ts`) знаходить
запис за `requestIdempotencyKey`, звіряє задачу й стан, робить короткий запис і повертає одне з
чотирьох: `applied` (+ `afterResponse?`), `already-final`, `other-job`, `unknown-job`:

```ts
// lib/quotes.ts (import "server-only")
export async function handleQuoteCallback(data: CallbackData): Promise<CallbackOutcome> {
  const quote = await db.getQuote(data.requestIdempotencyKey);
  if (!quote) return { status: "unknown-job" };
  // Bound to the job from the 202; null only if a fast callback beat markQuoteProcessing.
  if (quote.jobId && quote.jobId !== data.jobId) return { status: "other-job" };
  if (quote.status === "ready") return { status: "already-final" }; // a result is final
  const applied =
    data.status === "completed" && data.documentUrl
      ? await db.completeQuote(quote.id, { jobId: data.jobId, documentUrl: data.documentUrl })
      : await db.failQuote(quote.id, data.errorCode ?? "workflow-failed", data.jobId);
  if (!applied) return { status: "already-final" };
  return { status: "applied", afterResponse: async () => { /* e-mail, CRM note... */ } };
}
```

Чому ще й `jobId`: ключ ідемпотентності захищає від повтору **того самого** колбека, але не від
колбека **іншої** задачі з тим самим `requestIdempotencyKey` (другий запуск воркфлоу, старий запуск,
що «прокинувся»). Без звірки такий колбек отримав би 202 і перезаписав би готовий документ. Запис
прив'язаний до `job_id` з відповіді 202 (`markQuoteProcessing`), а `completeQuote`/`failQuote` у
сховищі не чіпають запис зі статусом `ready`.

Ключ ідемпотентності звіряємо з тілом: заголовок `idempotency-key` не входить у HMAC, тому сам по
собі він нічого не доводить. Хто перехопив підписаний колбек, міг би надіслати ті самі байти з новим
ключем у межах вікна 300 с — і обробник виконався б удруге. Звідси `key !== ${data.jobId}:${event}`
→ 400 (зі звільненням ключа).

У журнал — лише похідні значення (`const jobStatus = envelope.data.status`), не сам об'єкт конверта:
`check-contract` (C7) навмисно суворий до `body`, `payload`, `envelope`, `headers` у `console.*`.

## 5. Сховище ключів ідемпотентності

- Продакшн: таблиця з унікальним обмеженням, наприклад `n8n_callback_keys(key text primary key,
  received_at timestamptz)`; «claim» = `INSERT … ON CONFLICT DO NOTHING` і перевірка кількості
  вставлених рядків; «release» = `DELETE`.
- Демо: `Set` у пам'яті процесу (як у `lib/db.ts` навчального репозиторію). На serverless-хостингах
  обробники не ділять стан між запитами — там лише БД/KV.

## 6. Сторінка статусу

- `/quotes/[id]` — Server Component читає запис за UUID; поки статус `queued`/`processing`, маленький
  Client Component раз на кілька секунд викликає `router.refresh()`.
- Показує лише статус, назву компанії й посилання на документ (`https:`), без email і тексту запиту.
