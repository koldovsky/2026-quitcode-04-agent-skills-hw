# Code templates (Next.js 16 App Router, TypeScript, no extra dependencies)

Adapt names to the project; keep the structure. Check APIs against `node_modules/next/dist/docs/`.
`server-only` ships with Next.js — `import "server-only"` needs no install.

## `.env.example`

```bash
# n8n — server-only. Real values only in .env.local. Never /webhook-test/ here.
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
```

## `lib/n8n/client.ts` — the only module that talks to n8n

```ts
import "server-only";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries → 3 attempts max

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status: number | null; attempts: number; reason: "config" | "http" | "timeout" | "network" };

type TriggerInput<T> = {
  event: string;            // kebab-case, e.g. "quote-request" → POST {base}/quote-request
  data: T;                  // minimum the workflow needs — never the DB row
  idempotencyKey: string;   // created once per business operation and stored with the record
  correlationId: string;
  withCallback?: boolean;   // async workflows: adds callbackUrl = {APP_BASE_URL}/api/n8n/{event}
};

function readConfig() {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!base || !token || !appBaseUrl) return null;
  if (base.includes("/webhook-test")) return null; // test URLs never in code paths
  return { base: base.replace(/\/+$/, ""), token, appBaseUrl: appBaseUrl.replace(/\/+$/, "") };
}

export function callbackUrlFor(event: string) {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  return appBaseUrl ? `${appBaseUrl}/api/n8n/${event}` : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status: number) {
  return status >= 500; // includes 524 from n8n Cloud; 4xx are configuration errors
}

export async function triggerWorkflow<T>(input: TriggerInput<T>): Promise<TriggerResult> {
  const config = readConfig();
  if (!config) {
    console.error(`n8n config missing or invalid event=${input.event}`); // names only, no values
    return { ok: false, status: null, attempts: 0, reason: "config" };
  }

  const body = JSON.stringify({
    version: 1,
    event: input.event,
    data: input.data,
    ...(input.withCallback ? { callbackUrl: `${config.appBaseUrl}/api/n8n/${input.event}` } : {}),
  });

  let last: TriggerResult = { ok: false, status: null, attempts: 0, reason: "network" };
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${config.base}/${input.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": config.token,
          "idempotency-key": input.idempotencyKey,
          "x-correlation-id": input.correlationId,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Status code only — never parse the message text.
      console.info(
        `n8n out event=${input.event} corr=${input.correlationId} attempt=${attempt} status=${response.status} ms=${Date.now() - started}`,
      );
      if (response.ok) return { ok: true, status: response.status, attempts: attempt };
      last = { ok: false, status: response.status, attempts: attempt, reason: "http" };
      if (!isRetryable(response.status)) return last;
    } catch (error) {
      const name = error instanceof Error ? error.name : "Error";
      const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      console.warn(
        `n8n out event=${input.event} corr=${input.correlationId} attempt=${attempt} error=${name} ms=${Date.now() - started}`,
      );
      last = { ok: false, status: null, attempts: attempt, reason };
    }
    const pause = RETRY_DELAYS_MS[attempt - 1];
    if (pause !== undefined) await sleep(pause);
  }
  return last;
}
```

## Server Action — record first, n8n in `after()`

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";
// + the project's session helper, validation and storage

export async function requestQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // 1. session / permissions (server-auth-actions) — public forms: skip, but still validate
  // 2. validation
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  // 3. record first — with the idempotency key that every retry will reuse
  const quote = await saveQuote({
    ...parsed.data,
    status: "queued",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // 4. the user does not wait for n8n (server-after-nonblocking)
  after(async () => {
    const result = await triggerWorkflow({
      event: "quote-request",
      data: { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
      idempotencyKey: quote.idempotencyKey,
      correlationId: quote.correlationId,
      withCallback: true,
    });
    if (!result.ok) await markQuoteFailed(quote.id, result.reason); // shown on /quotes/[id]
  });

  // 5. only { status, … } — not the row
  return { status: "ok", id: quote.id };
}
```

After success either `redirect(`/quotes/${quote.id}`)` from the action (works without JS) or
return `{ status: "ok", id }` and render a link to the status page. Do not return the row.

## `app/api/n8n/[event]/route.ts` — signed callback

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
// + storage: claimIdempotencyKey / releaseIdempotencyKey / applyQuoteCallback

const MAX_BODY_BYTES = 64 * 1024;
const MAX_SKEW_SECONDS = 300;
const EVENTS = new Set(["quote-request"]); // path events we accept

type CallbackBody = {
  version: 1;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    correlationId?: string;
    requestIdempotencyKey: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
    completedAt?: string;
  };
};

function isCallbackBody(value: unknown): value is CallbackBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const d = v.data as Record<string, unknown> | undefined;
  return (
    v.version === 1 &&
    typeof v.event === "string" &&
    typeof d === "object" && d !== null &&
    typeof d.jobId === "string" &&
    (d.status === "completed" || d.status === "failed") &&
    typeof d.requestIdempotencyKey === "string"
  );
}

function signatureMatches(secret: string, timestamp: string, raw: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex"));
  const given = Buffer.from(header.slice("sha256=".length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const json = (status: number, body: unknown) => Response.json(body, { status });

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  // 1. before reading the body
  if (!EVENTS.has(event)) return json(404, { error: "not_found" });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "unsupported_media_type" });
  }
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return json(500, { error: "not_configured" });

  // 2–3. raw text, size
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "too_large" });

  // 4. timestamp window
  const timestamp = request.headers.get("x-n8n-timestamp") ?? "";
  const now = Math.floor(Date.now() / 1000);
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return json(401, { error: "unauthorized" });
  }

  // 5. signature — timingSafeEqual, never ===
  if (!signatureMatches(secret, timestamp, raw, request.headers.get("x-n8n-signature"))) {
    return json(401, { error: "unauthorized" });
  }

  // 6. idempotency
  const key = request.headers.get("idempotency-key");
  if (!key) return json(400, { error: "bad_request" });
  if (!(await claimIdempotencyKey(key))) return json(200, { duplicate: true });

  try {
    // 7. parse only now, then check shape, event and key against the signed body
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      await releaseIdempotencyKey(key);
      return json(400, { error: "bad_request" });
    }
    if (
      !isCallbackBody(body) ||
      !body.event.startsWith(`${event}.`) ||
      key !== `${body.data.jobId}:${body.event}`
    ) {
      await releaseIdempotencyKey(key);
      return json(400, { error: "bad_request" });
    }

    // 8. minimal state BEFORE responding
    const saved = await applyQuoteCallback(body.data); // finds the record by requestIdempotencyKey
    if (!saved) {
      await releaseIdempotencyKey(key);
      return json(400, { error: "bad_request" });
    }
    console.info(
      `n8n callback event=${body.event} corr=${body.data.correlationId ?? "-"} status=${body.data.status} bytes=${raw.length}`,
    );

    // 10. slow work after the response
    after(async () => {
      // notify the manager, send the PDF link by email, …
    });

    // 9.
    return json(202, { ok: true });
  } catch (error) {
    await releaseIdempotencyKey(key);
    console.error(`n8n callback event=${event} error=${error instanceof Error ? error.name : "Error"}`);
    return json(500, { error: "internal" });
  }
}
```

## Idempotency store (demo)

```ts
import "server-only";
// Demo only: process memory. Production: a table/KV with a UNIQUE constraint on the key.
const claimed = new Set<string>();
export async function claimIdempotencyKey(key: string) {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}
export async function releaseIdempotencyKey(key: string) {
  claimed.delete(key);
}
```

## Status page `/quotes/[id]`

Server Component: read the record from our own storage and render `queued` / `ready` (link to
the document) / `failed`. Never call n8n from the page. The record is the source of truth; the
callback only updates it. If the page should refresh itself while `queued`, a tiny Client
Component with `router.refresh()` on an interval is enough.
