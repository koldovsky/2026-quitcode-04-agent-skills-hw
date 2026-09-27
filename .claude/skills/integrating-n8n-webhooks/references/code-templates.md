# Шаблони коду (Next.js 16 App Router, TypeScript)

Читати, коли пишеш код інтеграції. Приклади для асинхронної події `quote-request`; назви полів і сховища
підлаштуй під проєкт. Перевірка — `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` (0 FAIL) і
`node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --help`.

## 1. `lib/n8n/client.ts` — єдине місце, звідки йдуть запити до n8n

```ts
import "server-only";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries -> 3 attempts in total

export type TriggerResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; reason: "rejected" | "unavailable" };

type TriggerOptions = {
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId: string;
  callback?: boolean; // async workflow: n8n answers 202 and calls back later
};

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  { idempotencyKey, correlationId, callback = false }: TriggerOptions,
): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!base || !token) throw new Error("n8n is not configured (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN)");
  if (base.includes("/webhook-test")) throw new Error("N8N_WEBHOOK_BASE_URL must be a production /webhook URL");

  const envelope: Record<string, unknown> = { version: 1, event, data };
  if (callback) {
    const app = process.env.APP_BASE_URL;
    if (!app) throw new Error("APP_BASE_URL is not configured");
    envelope.callbackUrl = `${app.replace(/\/+$/, "")}/api/n8n/${event}`;
  }
  const body = JSON.stringify(envelope);
  const url = `${base.replace(/\/+$/, "")}/${event}`;

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = response.status;
      await response.body?.cancel(); // only the status code matters, never the text
      logCall(event, correlationId, attempt, response.status, started);
      if (response.ok) return { ok: true, status: response.status };
      if (response.status < 500) return { ok: false, status: response.status, reason: "rejected" }; // 4xx: fix, do not retry
    } catch (error) {
      // network error or TimeoutError: retry with the same idempotency key
      logCall(event, correlationId, attempt, error instanceof Error ? error.name : "error", started);
    }
    const pause = RETRY_DELAYS_MS[attempt - 1];
    if (pause !== undefined) await new Promise((resolve) => setTimeout(resolve, pause));
  }
  return { ok: false, status: lastStatus, reason: "unavailable" };
}

// Event, direction, correlation id, attempt, status, duration. Never bodies, tokens, URLs or personal data.
function logCall(event: string, correlationId: string, attempt: number, status: number | string, started: number) {
  console.info(
    JSON.stringify({ n8n: "out", event, correlationId, attempt, status, ms: Date.now() - started }),
  );
}
```

## 2. Сховище (демо — у пам'яті, як `lib/db.ts`; у проді — таблиця з унікальним ключем)

```ts
export type QuoteStatus = "queued" | "sent" | "ready" | "failed";
export type Quote = {
  id: string; // randomUUID(): the status page is public, so the id must not be guessable
  company: string; email: string; description: string; budget: number | null;
  status: QuoteStatus;
  requestKey: string; // idempotency-key of the trigger, stored with the record
  correlationId: string;
  documentUrl: string | null;
  createdAt: string; updatedAt: string;
};
// + insertQuote(), getQuote(id), getQuoteByRequestKey(key)
// + updateQuote(id, patch, ifStatus?: status | status[]): boolean — with ifStatus the check and the write are ONE step
//   (UPDATE … WHERE id = $1 AND status = $ifStatus); a separate read, then a write, loses a callback in between
// + claimCallbackKey(key): boolean  — false if the key was already claimed (unique constraint in prod);
//   keep keys about a day, then prune: n8n re-signs a retried callback, so the 300 s window does not bound retries
// + releaseCallbackKey(key): void   — undo the claim when processing failed after it
```

## 3. Server Action: зберегти, відповісти, n8n — в `after()`

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { triggerWorkflow } from "@/lib/n8n/client";

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // Public form: no session on purpose. Otherwise: session + permissions first (server-auth-actions).
  const parsed = parseQuoteForm(formData); // trim, length limits; budget: /^\d+(?:[.,]\d{1,2})?$/ after removing spaces, else a form error (never strip commas: "1500,50" is not 150050)
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const quote = await db.insertQuote({
    ...parsed.data,
    id: randomUUID(),
    status: "queued",
    requestKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // The workflow takes 40-90 s: the user never waits for n8n (server-after-nonblocking).
  after(async () => {
    const result = await triggerWorkflow(
      "quote-request",
      { quoteId: quote.id, company: quote.company, description: quote.description, budget: quote.budget },
      { idempotencyKey: quote.requestKey, correlationId: quote.correlationId, callback: true },
    );
    // Only if still queued, checked in the same write: with a fast workflow the callback may already have
    // set "ready", also between a separate read and this write.
    await db.updateQuote(quote.id, { status: result.ok ? "sent" : "failed" }, "queued");
  });

  redirect(`/quotes/${quote.id}`); // works without JavaScript; after() still runs
}
```

- `data` — лише те, з чого воркфлоу будує кошторис. Email клієнта — тільки якщо воркфлоу сам надсилає
  лист; тоді запиши це рішення в `docs/n8n-integrations.md`.
- Сторінка `/quotes/[id]` — Server Component, що читає запис і показує статус (`queued` / `sent` —
  «готуємо», `ready` — посилання на документ, `failed` — «не вдалося»). Не показуй `requestKey`,
  `correlationId` і будь-що з колбека, крім результату.

## 4. `app/api/n8n/[event]/route.ts` — колбек

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

type Callback = {
  version: 1;
  event: string;
  data: { jobId: string; status: "completed" | "failed"; requestIdempotencyKey: string;
          result?: { documentUrl?: string }; error?: { code?: string } };
};
// The status page renders documentUrl as a link: keep only https URLs from the callback.
function safeDocumentUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

// One handler per event; returns false if the record does not exist.
const HANDLERS: Record<string, (data: Callback["data"]) => Promise<boolean>> = {
  "quote-request": async (data) => {
    const quote = await db.getQuoteByRequestKey(data.requestIdempotencyKey);
    if (!quote) return false;
    if (data.status === "completed") {
      await db.updateQuote(quote.id, { status: "ready", documentUrl: safeDocumentUrl(data.result?.documentUrl) });
    } else {
      // "ready" is final: a failed callback of another n8n execution (new jobId) must not take the PDF away
      await db.updateQuote(quote.id, { status: "failed" }, ["queued", "sent"]);
    }
    return true;
  },
};

const reply = (status: number, body: Record<string, unknown> = {}) => Response.json(body, { status });

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const started = Date.now();
  const { event } = await ctx.params;
  const correlationId = request.headers.get("x-correlation-id") ?? "-";
  const done = (status: number, body?: Record<string, unknown>) => {
    console.info(JSON.stringify({ n8n: "in", event, correlationId, status, ms: Date.now() - started }));
    return reply(status, body);
  };

  // 1. Before reading the body
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return done(404, { error: "unknown event" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return done(415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return done(413);

  // 2-3. Raw body, read once; no request.json() and no JSON.parse before the signature
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return done(413);

  // 4. Timestamp window, both directions
  const timestamp = request.headers.get("x-n8n-timestamp") ?? "";
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > WINDOW_SECONDS) {
    return done(401);
  }

  // 5. Signature over "<timestamp>.<raw body>": length first, then timingSafeEqual
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return done(500);
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(request.headers.get("x-n8n-signature") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return done(401);

  // 6. Claim the idempotency key
  const key = request.headers.get("idempotency-key") ?? "";
  if (!key) return done(400);
  if (!(await db.claimCallbackKey(key))) return done(200, { duplicate: true });

  try {
    // 7. Now parse and check the shape; the key must equal fields of the SIGNED body
    let body: Callback;
    try {
      body = JSON.parse(raw);
    } catch {
      await db.releaseCallbackKey(key);
      return done(400);
    }
    const d = body?.data;
    const shapeOk = body?.version === 1 && typeof d?.jobId === "string" && typeof d?.requestIdempotencyKey === "string"
      && (d.status === "completed" || d.status === "failed")
      && body.event === `${event}.${d.status}`; // the event suffix and data.status must agree
    if (!shapeOk || key !== `${d.jobId}:${body.event}`) {
      await db.releaseCallbackKey(key);
      return done(400);
    }
    // 8-9. Save the minimal state BEFORE answering
    if (!(await handler(d))) {
      await db.releaseCallbackKey(key);
      return done(404);
    }
  } catch {
    await db.releaseCallbackKey(key);
    return done(500);
  }

  // 11. Slow side effects after the response
  after(async () => {
    /* notify the manager, send the email, … */
  });
  return done(202, { ok: true }); // 10.
}
```

- Жодного `export const runtime = "edge"` — потрібен `node:crypto`.
- `RouteContext<"/api/n8n/[event]">` — глобальний тип Next.js 16 (генерується `next build` / `next typegen`).
- Відповіді 4xx/5xx без подробиць: ні стеку, ні причини, чому не зійшовся підпис.
