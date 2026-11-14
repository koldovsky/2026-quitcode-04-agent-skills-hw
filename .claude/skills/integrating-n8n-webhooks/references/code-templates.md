# Шаблони коду (Next.js 16, App Router)

Шаблони — відправна точка: назви подій, полів і сховища підставте під проєкт. Перевіряйте API своєї
версії в `node_modules/next/dist/docs/`.

## `.env.example`

```bash
# n8n — server-only. Real values only in .env.local; never NEXT_PUBLIC_, never /webhook-test/.
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
```

## `lib/n8n/client.ts` — єдиний модуль виклику n8n

```ts
import "server-only";
import { randomUUID } from "node:crypto";

export type N8nEvent = "quote-request"; // kebab-case, one event = one webhook path

const ATTEMPT_TIMEOUT_MS = 10_000;
const RETRY_PAUSES_MS = [1_000, 3_000]; // at most 2 retries = 3 attempts

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`n8n: ${name} is not set`);
  return value;
}

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status: number | null; attempts: number };

/** Starts an n8n workflow. Call it from after(), never while the user waits. */
export async function triggerWorkflow<TData>(input: {
  event: N8nEvent;
  data: TData; // the minimum the workflow needs — not the whole DB row
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId?: string;
  callbackPath?: string; // e.g. "/api/n8n/quote-request" — only for async (202 + callback) workflows
}): Promise<TriggerResult> {
  const base = requireEnv("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "");
  if (!base.endsWith("/webhook")) throw new Error("n8n: N8N_WEBHOOK_BASE_URL must end with /webhook");
  const token = requireEnv("N8N_WEBHOOK_TOKEN");
  const correlationId = input.correlationId ?? randomUUID();
  const body = JSON.stringify({
    version: 1,
    event: input.event,
    data: input.data,
    ...(input.callbackPath && { callbackUrl: new URL(input.callbackPath, requireEnv("APP_BASE_URL")).toString() }),
  });

  let status: number | null = null;
  for (let attempt = 1; attempt <= RETRY_PAUSES_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${base}/${input.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": input.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        cache: "no-store",
      });
      status = response.status;
      await response.body?.cancel(); // status code only; the message text is not a contract
    } catch {
      status = null; // network error or TimeoutError
    }
    console.info(
      `n8n out event=${input.event} correlation=${correlationId} attempt=${attempt} status=${status ?? "network"} ms=${Date.now() - started}`,
    );
    if (status !== null && status >= 200 && status < 300) return { ok: true, status, attempts: attempt };
    const retryable = status === null || status >= 500; // includes 524; 4xx is a bug to fix, not to retry
    if (!retryable || attempt > RETRY_PAUSES_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSES_MS[attempt - 1]));
  }
  return { ok: false, status, attempts: RETRY_PAUSES_MS.length + 1 };
}
```

## `lib/n8n/callback.ts` — підпис і вікно часу

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_MAX_BYTES = 64 * 1024;
export const CALLBACK_WINDOW_SECONDS = 300;

export type SignatureCheck = "ok" | "stale" | "invalid";

/** Raw body as text with the limit applied WHILE reading (request.text() buffers it all). Null = too large. */
export async function readBodyLimited(request: Request, maxBytes = CALLBACK_MAX_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null; // cheap early exit; the header can lie, the loop below cannot
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function verifyCallbackSignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature) return "invalid";
  if (Math.abs(nowSeconds - Number(timestamp)) > CALLBACK_WINDOW_SECONDS) return "stale";
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) throw new Error("n8n: N8N_CALLBACK_SECRET is not set");
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(signature);
  // timingSafeEqual throws on different lengths — compare lengths first
  return given.length === expected.length && timingSafeEqual(given, expected) ? "ok" : "invalid";
}
```

## `app/api/n8n/[event]/route.ts` — колбек

```ts
import { createHash } from "node:crypto";
import { after } from "next/server";
import { readBodyLimited, verifyCallbackSignature } from "@/lib/n8n/callback";
import { claimCallbackKey, releaseCallbackKey, saveQuoteResult } from "@/lib/quotes"; // your storage

const KNOWN_EVENTS = new Set(["quote-request"]);

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  if (!KNOWN_EVENTS.has(event)) return Response.json({ error: "not found" }, { status: 404 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported media type" }, { status: 415 });
  }

  // Raw text first — never request.json() before the signature; the 64 KB limit applies while reading.
  const raw = await readBodyLimited(request);
  if (raw === null) return Response.json({ error: "too large" }, { status: 413 });

  const check = verifyCallbackSignature(raw, request.headers.get("x-n8n-timestamp"), request.headers.get("x-n8n-signature"));
  const correlationId = request.headers.get("x-correlation-id") ?? "-";
  const bodyHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (check !== "ok") {
    console.warn(`n8n in event=${event} correlation=${correlationId} rejected=${check} bytes=${raw.length} sha256=${bodyHash}`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = request.headers.get("idempotency-key");
  if (!key) return Response.json({ error: "bad request" }, { status: 400 });
  if (!(await claimCallbackKey(key))) return Response.json({ duplicate: true }, { status: 200 });

  try {
    const body: unknown = JSON.parse(raw);
    const parsed = parseCallback(body, event, key);
    if (!parsed) {
      await releaseCallbackKey(key);
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    const saved = await saveQuoteResult(parsed); // minimal state BEFORE the response
    if (!saved) {
      await releaseCallbackKey(key);
      return Response.json({ error: "not found" }, { status: 404 });
    }
  } catch {
    await releaseCallbackKey(key); // let n8n's Retry On Fail deliver it again
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  console.info(`n8n in event=${event} correlation=${correlationId} accepted bytes=${raw.length} sha256=${bodyHash}`);
  after(async () => {
    // slow side effects: e-mail, notifications
  });
  return Response.json({ ok: true }, { status: 202 });
}

type QuoteCallback = {
  jobId: string;
  status: "completed" | "failed";
  requestIdempotencyKey: string; // the idempotency-key we sent to n8n — finds the record
  documentUrl: string | null; // http(s) only — it is rendered as a link
};

// The signature proves who sent the body, not that its shape is right: check it all before saving.
function parseCallback(body: unknown, pathEvent: string, key: string): QuoteCallback | null {
  if (typeof body !== "object" || body === null) return null;
  const { version, event, data } = body as Record<string, unknown>;
  if (version !== 1) return null;
  if (event !== `${pathEvent}.completed` && event !== `${pathEvent}.failed`) return null; // exact events only
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.jobId !== "string" || !d.jobId || key !== `${d.jobId}:${event}`) return null; // header is not signed
  if (typeof d.requestIdempotencyKey !== "string" || !d.requestIdempotencyKey) return null;
  if (event !== `${pathEvent}.${String(d.status)}`) return null; // "….failed" with status "completed" — rejected
  if (d.status === "completed") {
    const documentUrl = (d.result as Record<string, unknown> | undefined)?.documentUrl;
    if (!isHttpUrl(documentUrl)) return null; // never javascript:, data: and the like
    return { jobId: d.jobId, status: "completed", requestIdempotencyKey: d.requestIdempotencyKey, documentUrl };
  }
  return { jobId: d.jobId, status: "failed", requestIdempotencyKey: d.requestIdempotencyKey, documentUrl: null };
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
```

Сховище ключів (`claimCallbackKey` / `releaseCallbackKey`) — у продакшні унікальний індекс у БД; для
демо з базою в пам'яті:

```ts
const g = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (g.n8nCallbackKeys ??= new Set());
export async function claimCallbackKey(key: string) { if (keys.has(key)) return false; keys.add(key); return true; }
export async function releaseCallbackKey(key: string) { keys.delete(key); }
```

## Server Action, що запускає воркфлоу

```ts
"use server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { triggerWorkflow } from "@/lib/n8n/client";

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // 1. session / permissions (server-auth-actions); a public form says so explicitly
  // 2. validation → { status: "invalid", errors, values }
  const quote = await quotes.insert({ ...parsed.data, id: randomUUID(), status: "queued", idempotencyKey: randomUUID() });
  after(async () => {
    const result = await triggerWorkflow({
      event: "quote-request",
      data: { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
      idempotencyKey: quote.idempotencyKey,
      callbackPath: "/api/n8n/quote-request",
    });
    // A fast callback may already have stored "completed"/"failed" while we waited for n8n:
    // move ONLY queued → processing | failed, atomically (UPDATE … WHERE id = $1 AND status = 'queued').
    await quotes.markTriggered(quote.id, result.ok);
  });
  redirect(`/quotes/${quote.id}`); // or return { status: "ok", id: quote.id } — never the row
}
```

`markTriggered(id, ok)` — перехід **лише** з `queued`, атомарно: у БД
`UPDATE quotes SET status = $2 WHERE id = $1 AND status = 'queued'`, у пам'яті —
`if (quote.status !== "queued") return;`. Безумовний `update(id, { status: "processing" })` після
`triggerWorkflow` перезаписав би `completed`, який колбек зберіг, поки ми чекали відповідь n8n, — і
нового колбека вже не буде.

Сторінка статусу (`/quotes/[id]`) показує мінімум — статус і посилання на документ; id запису —
випадковий UUID, а не порядковий номер. Поки статус не кінцевий, сторінку можна оновлювати
`<meta httpEquiv="refresh" content="5" />` (працює й без JS) або `router.refresh()` за таймером.
