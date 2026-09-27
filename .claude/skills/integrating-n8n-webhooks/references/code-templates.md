# Шаблони коду (Next.js 16, App Router, Node runtime)

Шаблони — відправна точка: імена моделей, полів і `db`-функцій підлаштуйте під проєкт, контракт
(заголовки, порядок перевірок, коди відповіді) — не змінюйте. Після змін —
`node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs`.

## `.env.example`

```
# n8n: production webhooks only (never the test path). Real values live in .env.local.
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
```

Старі змінні з повним URL вебхука (напр. `N8N_WEBHOOK_URL=…/lead-created`) замініть на
`N8N_WEBHOOK_BASE_URL` + шлях події в коді; власний `.env.local` оновіть так само.

## `lib/n8n/client.ts` — єдине місце, звідки йдуть запити до n8n

```ts
import "server-only";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // max 2 retries → 3 attempts

export type TriggerOptions = {
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId: string;
  callback?: boolean; // async workflow: n8n answers 202 {job_id} and calls back later
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null };

function config() {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!baseUrl || !token) throw new Error("n8n is not configured: set N8N_WEBHOOK_BASE_URL and N8N_WEBHOOK_TOKEN");
  if (!baseUrl.endsWith("/webhook")) throw new Error("N8N_WEBHOOK_BASE_URL must be the production base ending with /webhook");
  return { baseUrl, token };
}

export function callbackUrl(event: string) {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!appBaseUrl) throw new Error("APP_BASE_URL is not set");
  return `${appBaseUrl}/api/n8n/${event}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry only transient failures: network errors, timeouts, 5xx (incl. Cloud 524). Never 4xx.
const isRetryable = (status: number) => status >= 500;

export async function triggerWorkflow<T>(event: string, data: T, options: TriggerOptions): Promise<TriggerResult> {
  const { baseUrl, token } = config();
  const body = JSON.stringify({
    version: 1,
    event,
    data, // the minimum the workflow needs — never the whole DB row
    ...(options.callback ? { callbackUrl: callbackUrl(event) } : {}),
  });

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": options.correlationId,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = response.status;
      console.info(`[n8n] out event=${event} attempt=${attempt} status=${response.status} ms=${Date.now() - started} correlation=${options.correlationId}`);
      if (response.ok) {
        // Only the status code and job_id matter; the message text is not a contract.
        const jobId = response.status === 202 ? await readJobId(response) : null;
        return { ok: true, status: response.status, jobId };
      }
      if (!isRetryable(response.status)) return { ok: false, status: response.status };
    } catch (error) {
      // TimeoutError / network error: log the kind only, never the URL, headers or body.
      console.warn(`[n8n] out event=${event} attempt=${attempt} error=${error instanceof Error ? error.name : "unknown"} ms=${Date.now() - started} correlation=${options.correlationId}`);
    }
    if (attempt <= RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
  return { ok: false, status: lastStatus };
}

async function readJobId(response: Response) {
  const json: unknown = await response.json().catch(() => null);
  const jobId = (json as { job_id?: unknown } | null)?.job_id;
  return typeof jobId === "string" ? jobId : null;
}
```

## Server Action: зберегти → відповісти → n8n в `after()`

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // 1. Session and permissions for internal forms (server-auth-actions); public forms skip this step.
  // 2. Validate on the server.
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  // 3. Save first, with the keys that every retry and the callback will reuse.
  const quote = await db.insertQuote({
    ...parsed.data,
    status: "queued",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // 4. The user never waits for n8n (server-after-nonblocking).
  after(async () => {
    const result = await triggerWorkflow(
      "quote-request",
      { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
      { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callback: true },
    );
    // Only queued → processing/failed: a fast callback may already have set "ready".
    await db.markQuoteDispatched(quote.id, result.ok && result.jobId ? { status: "processing", jobId: result.jobId } : { status: "failed" });
  });

  // 5. Only form state goes back to the browser — no DB row, no keys.
  return { status: "ok", id: quote.id };
}
```

- Подія «до відома» (Immediately, напр. `lead-created`) — так само в `after()`, без `callback: true`;
  `idempotencyKey` — теж один на запис і збережений із ним.
- Після `ok` форма може перейти на сторінку статусу (`/quotes/<id>`). Сторінка показує статус
  (`queued` → `processing` → `ready`/`failed`) і посилання на документ, але не `idempotencyKey`,
  `correlationId` чи `jobId`.

## `app/api/n8n/[event]/route.ts` — колбек

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { claimCallbackKey, releaseCallbackKey } from "@/lib/n8n/callback-keys";

const MAX_BODY_BYTES = 64 * 1024;
const TIMESTAMP_WINDOW_S = 300;

type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  correlationId?: string;
  requestIdempotencyKey: string;
  result?: { documentUrl?: string };
  error?: { code?: string };
  completedAt?: string;
};

// One entry per event path; returns false when the record is unknown.
const HANDLERS: Record<string, (data: CallbackData) => Promise<boolean>> = {
  "quote-request": (data) => db.completeQuoteFromCallback(data),
};

const reply = (status: number, body: Record<string, unknown> = {}) => Response.json(body, { status });

function signatureMatches(timestamp: string, raw: string, header: string | null) {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function isCallbackData(value: unknown): value is CallbackData {
  const data = value as CallbackData | null;
  return (
    typeof data?.jobId === "string" &&
    (data.status === "completed" || data.status === "failed") &&
    typeof data.requestIdempotencyKey === "string"
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  // Own keys only: "toString" or "__proto__" must be an unknown event, not an Object.prototype method.
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return reply(404, { error: "unknown event" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply(415, { error: "unsupported media type" });
  }

  const raw = await request.text(); // raw bytes: never request.json() before the signature check
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, { error: "payload too large" });

  const timestamp = request.headers.get("x-n8n-timestamp") ?? "";
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!/^\d+$/.test(timestamp) || age > TIMESTAMP_WINDOW_S) return reply(401, { error: "unauthorized" });
  if (!signatureMatches(timestamp, raw, request.headers.get("x-n8n-signature"))) {
    return reply(401, { error: "unauthorized" });
  }

  const key = request.headers.get("idempotency-key");
  if (!key) return reply(400, { error: "bad request" });
  if (!claimCallbackKey(key)) return reply(200, { duplicate: true });

  try {
    let body: { version?: unknown; event?: unknown; data?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      releaseCallbackKey(key);
      return reply(400, { error: "bad request" });
    }
    const allowed = [`${event}.completed`, `${event}.failed`];
    if (body.version !== 1 || typeof body.event !== "string" || !allowed.includes(body.event) || !isCallbackData(body.data)
      || key !== `${body.data.jobId}:${body.event}`) {
      releaseCallbackKey(key);
      return reply(400, { error: "bad request" });
    }

    // Persist before answering: after a 2xx n8n will not retry.
    if (!(await handler(body.data))) {
      releaseCallbackKey(key);
      return reply(404, { error: "unknown job" });
    }
    const correlationId = request.headers.get("x-correlation-id") ?? "-";
    console.info(`[n8n] in event=${body.event} status=202 bytes=${Buffer.byteLength(raw)} correlation=${correlationId}`);
    after(() => {
      // slow side effects (email, notifications) go here
    });
    return reply(202, { ok: true });
  } catch (error) {
    releaseCallbackKey(key);
    console.error(`[n8n] in event=${event} status=500 error=${error instanceof Error ? error.name : "unknown"}`);
    return reply(500, { error: "internal error" });
  }
}
```

- Жодного `export const runtime = "edge"`: потрібен `node:crypto`.
- `db.completeQuoteFromCallback(data)` знаходить запис за `data.requestIdempotencyKey` і ставить
  `ready` + `data.result.documentUrl` (або `failed` + `data.error.code`). Невідомий ключ → `false`.
- Якщо колбек може змінити лише запис, що чекає (`queued`/`processing`), — перевіряйте це там само.

## `lib/n8n/callback-keys.ts` — «застовпити» ключ

```ts
import "server-only";

// Demo only: process memory. In production use a DB/KV table with a unique constraint.
const store = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (store.n8nCallbackKeys ??= new Set<string>());

export function claimCallbackKey(key: string) {
  if (keys.has(key)) return false;
  keys.add(key);
  return true;
}

export function releaseCallbackKey(key: string) {
  keys.delete(key);
}
```
