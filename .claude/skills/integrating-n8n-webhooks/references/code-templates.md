# Шаблони коду

Шаблони перевірено в тимчасовій копії LeadDesk (Next.js 16.3.5, Node 24) разом з мінімальними
реалізаціями того, що в кожному проєкті своє: `db.insertQuote`, `db.updateQuoteIfStatus`,
`parseQuoteForm` / `QuoteFormState`, збереження стану в `HANDLERS`. Результат: `tsc --noEmit`,
`eslint`, `next build` — без помилок; `check-contract.mjs` — 13 PASS; колбек-роут — усі 11 випадків
`scripts/send-signed-callback.mjs`. Підставте свою подію й збереження стану; решту не спрощуйте.

## `lib/n8n/client.ts` — єдиний модуль, що викликає n8n

```ts
import "server-only";
import { randomUUID } from "node:crypto";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // up to 2 retries → 3 attempts

export type N8nEvent = "quote-request"; // one kebab-case path per event

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | "network" | "timeout"; attempts: number };

export async function triggerWorkflow(
  event: N8nEvent,
  data: Record<string, unknown>,
  options: { idempotencyKey: string; correlationId?: string; callbackPath?: string },
): Promise<TriggerResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const appBaseUrl = process.env.APP_BASE_URL;
  // Without APP_BASE_URL the callback would go to "undefined/api/n8n/…" and never arrive.
  if (!baseUrl || !token || (options.callbackPath && !appBaseUrl)) throw new Error("n8n is not configured");

  const correlationId = options.correlationId ?? randomUUID();
  const payload = JSON.stringify({
    version: 1,
    event,
    data,
    ...(options.callbackPath ? { callbackUrl: `${appBaseUrl}${options.callbackPath}` } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const startedAt = Date.now();
    let status: number | "network" | "timeout";
    try {
      const response = await fetch(`${baseUrl}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = response.status;
      logAttempt(event, correlationId, status, Date.now() - startedAt, attempt);
      if (response.ok) {
        // Only the status code matters; a 202 from "Respond to Webhook" carries {"job_id": …}.
        const jobId =
          response.status === 202
            ? (((await response.json().catch(() => null)) as { job_id?: string } | null)?.job_id ?? null)
            : null;
        return { ok: true, status: response.status, jobId };
      }
    } catch (error) {
      status = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
      logAttempt(event, correlationId, status, Date.now() - startedAt, attempt);
    }

    const retryable = typeof status !== "number" || status >= 500; // network, timeout, 5xx, 524
    if (!retryable || attempt > RETRY_DELAYS_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
}

function logAttempt(event: string, correlationId: string, status: number | string, ms: number, attempt: number) {
  // No bodies, names, emails, tokens or URLs with query strings.
  console.info("n8n.out", { event, correlationId, status, ms, attempt });
}
```

## `lib/n8n/idempotency.ts` — сховище ключів колбеків

```ts
import "server-only";

// Demo store: fine for one local process. In production use a DB/KV table with a UNIQUE key —
// serverless instances do not share memory.
const claimed = new Set<string>();

/** Returns false if the key was already claimed (a duplicate callback). */
export async function claimKey(key: string): Promise<boolean> {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

export async function releaseKey(key: string): Promise<void> {
  claimed.delete(key);
}
```

Для продакшну — таблиця з унікальним ключем (або KV з `SET NX`): `claimKey` = вставка, яка падає на
дублікаті; `releaseKey` = видалення. Якщо такого сховища в проєкті немає — правило зупинки: спитати.

## `app/api/n8n/[event]/route.ts` — колбек

```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { claimKey, releaseKey } from "@/lib/n8n/idempotency";

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

type CallbackBody = {
  version: 1;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    requestIdempotencyKey?: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
  };
};

// One handler per known event; each saves the minimal state BEFORE the response.
const HANDLERS: Record<string, (data: CallbackBody["data"]) => Promise<void>> = {
  "quote-request": async (data) => {
    // e.g. await db.completeQuote({ requestIdempotencyKey: data.requestIdempotencyKey, status: data.status, … })
    void data;
  },
};

export async function POST(request: Request, context: { params: Promise<{ event: string }> }) {
  const { event } = await context.params;
  const correlationId = readCorrelationId(request);

  // 1. Known event and JSON content type — before reading the body.
  // Object.hasOwn: "constructor", "toString" or "__proto__" in the path must be 404 too.
  const handle = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handle) return reply(404, "unknown", correlationId); // the path is attacker-controlled: not logged
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, event, correlationId);

  // 2–3. Raw body, read once, size-limited.
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, event, correlationId);

  // 4. Timestamp window against replays.
  const timestamp = Number(request.headers.get("x-n8n-timestamp"));
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > WINDOW_SECONDS) {
    return reply(401, event, correlationId);
  }

  // 5. Signature: lengths first, then a constant-time comparison.
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", process.env.N8N_CALLBACK_SECRET ?? "").update(`${timestamp}.${raw}`).digest("hex")}`,
  );
  const received = Buffer.from(request.headers.get("x-n8n-signature") ?? "");
  if (!process.env.N8N_CALLBACK_SECRET || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return reply(401, event, correlationId);
  }

  // 6. Claim the idempotency key; a repeat is acknowledged but not processed again.
  const key = request.headers.get("idempotency-key");
  if (!key) return reply(400, event, correlationId);
  if (!(await claimKey(key))) {
    log(200, event, correlationId, raw);
    return Response.json({ duplicate: true });
  }

  // 7–8. Only now parse, check the shape against the path and the key, save the state.
  try {
    let body: CallbackBody;
    try {
      body = JSON.parse(raw) as CallbackBody;
    } catch {
      await releaseKey(key);
      return reply(400, event, correlationId);
    }
    const data = body?.data;
    const valid =
      body?.version === 1 &&
      typeof body.event === "string" &&
      body.event.startsWith(`${event}.`) &&
      typeof data?.jobId === "string" &&
      key === `${data.jobId}:${body.event}` &&
      // completed carries result, failed carries error — nothing else is accepted
      ((data.status === "completed" && typeof data.result === "object" && data.result !== null) ||
        (data.status === "failed" && typeof data.error === "object" && data.error !== null));
    if (!valid) {
      await releaseKey(key);
      return reply(400, event, correlationId);
    }
    await handle(body.data);
  } catch {
    await releaseKey(key); // otherwise n8n's retry would get {"duplicate":true} and the result is lost
    return reply(500, event, correlationId);
  }

  // 10. Slow follow-ups after the response.
  after(async () => {
    // notifications, e-mails, other integrations
  });

  // 9.
  log(202, event, correlationId, raw);
  return Response.json({ ok: true }, { status: 202 });
}

// The header arrives before anything is verified: log it only in the UUID shape the contract
// promises, so a forged request cannot write arbitrary text into the logs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCorrelationId(request: Request) {
  const value = request.headers.get("x-correlation-id");
  if (value === null) return "none";
  return UUID_RE.test(value) ? value : "invalid";
}

function reply(status: number, event: string, correlationId: string) {
  log(status, event, correlationId);
  return new Response(null, { status }); // no internal details in error responses
}

function log(status: number, event: string, correlationId: string, raw?: string) {
  const size = raw === undefined ? undefined : Buffer.byteLength(raw);
  const sha256 = raw === undefined ? undefined : createHash("sha256").update(raw).digest("hex");
  console.info("n8n.in", { event, correlationId, status, size, sha256 });
}
```

`HANDLERS` знаходить запис за `data.requestIdempotencyKey` (ключ вихідного запиту, збережений у
записі) або за `data.jobId` (збережений після 202) і записує мінімум: статус, посилання на документ.

## Server Action, що запускає воркфлоу

`getSessionUser`, `db` і `parseQuoteForm` — функції проєкту (у LeadDesk — `lib/data.ts`,
`lib/db.ts` і нова `lib/quote-form.ts` за зразком `lib/lead-form.ts`); форма й `QuoteFormState` —
за скілом `building-client-form`, якщо він є в проєкті.

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getSessionUser } from "@/lib/data";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormState } from "@/lib/quote-form";

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // 1. Session, rights and validation inside the action (server-auth-actions).
  const user = await getSessionUser();
  if (!user) return { status: "unauthorized" };
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  // 2. Save first: the record owns the idempotency key and the correlation id.
  const quote = await db.insertQuote({
    ...parsed.data,
    status: "queued",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // 3. n8n after the response (server-after-nonblocking); only the data the workflow needs.
  after(async () => {
    try {
      const result = await triggerWorkflow(
        "quote-request",
        { quoteId: quote.id, company: quote.company, budget: quote.budget },
        { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callbackPath: "/api/n8n/quote-request" },
      );
      // Only from "queued": a fast callback may already have set "ready" — do not overwrite it.
      await db.updateQuoteIfStatus(quote.id, "queued", result.ok ? { status: "processing", jobId: result.jobId } : { status: "failed" });
    } catch (error) {
      // e.g. n8n is not configured: the record must not stay "queued" forever.
      console.error("quote.trigger failed", { quoteId: quote.id, code: error instanceof Error ? error.name : "unknown" });
      await db.updateQuoteIfStatus(quote.id, "queued", { status: "failed" });
    }
  });

  // 4. Only the form state — not the database row.
  return { status: "ok", id: quote.id };
}
```

`updateQuoteIfStatus(id, expected, patch)` — оновлення з умовою на поточний статус (у SQL —
`UPDATE … WHERE id = $1 AND status = $2`): колбек n8n може прийти раніше, ніж `after()` запише
`processing`.

Сторінка результату (`/quotes/[id]`) читає статус запису: `queued` / `processing` — «готуємо»,
`ready` — посилання на документ, `failed` — повідомлення без внутрішніх подробиць.
