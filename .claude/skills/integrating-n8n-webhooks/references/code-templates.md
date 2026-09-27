# Code templates

Starting points that pass `scripts/check-contract.mjs` (14/14), `next build` and `eslint` on
Next.js 16.3.5, and that were run against `scripts/mock-n8n.mjs` end to end (202 → signed callback →
record `ready`; 524 → three attempts with one `idempotency-key`). The event in the examples is
`quote-request`: rename it, and keep one event per path.

## Contents

1. `lib/n8n/client.ts`: the only caller of n8n
2. `lib/n8n/callback.ts`: time window, signature, envelope
3. `lib/n8n/callback-keys.ts`: claim and release callback keys (demo store)
4. `app/api/n8n/[event]/route.ts`: the callback route
5. The Server Action: save, answer, trigger in `after()`
6. What the feature's data layer must provide
7. `.env.example`
8. A row in `docs/n8n-integrations.md`

## 1. `lib/n8n/client.ts`

Add every new event to `N8nEvent`. `callback: true` only for async workflows (202 + callback).

```ts
import "server-only";

import { createHash } from "node:crypto";

// Next.js → n8n. The only module that calls n8n webhooks (contract: skill integrating-n8n-webhooks).

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // at most 2 retries: 3 attempts in total
const ENVELOPE_VERSION = 1;

/** kebab-case event = the Path of the n8n Webhook node. One event, one path. */
export type N8nEvent = "quote-request";

export type TriggerOptions = {
  /** Created once per business operation and stored with the record; the same on every retry. */
  idempotencyKey: string;
  /** One id for the whole chain; it goes into the logs of both systems. */
  correlationId: string;
  /** Async workflows only (Respond to Webhook → 202, result by callback). */
  callback?: boolean;
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null; retryable: boolean };

export async function triggerWorkflow(
  event: N8nEvent,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  const url = `${env("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "")}/${event}`;
  const body = JSON.stringify({
    version: ENVELOPE_VERSION,
    event,
    data,
    ...(options.callback ? { callbackUrl: `${env("APP_BASE_URL").replace(/\/+$/, "")}/api/n8n/${event}` } : {}),
  });
  const headers = {
    "content-type": "application/json",
    "x-n8n-token": env("N8N_WEBHOOK_TOKEN"),
    "idempotency-key": options.idempotencyKey,
    "x-correlation-id": options.correlationId,
  };
  const bytes = Buffer.byteLength(body);
  const sha256 = createHash("sha256").update(body).digest("hex");

  let status: number | null = null;
  let retryable = true;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = response.status;
      // Only the status code counts. The body is read for the job_id of a 202 and nothing else.
      const jobId = status === 202 ? await readJobId(response) : null;
      if (status !== 202) await response.body?.cancel();
      console.info("n8n.request", { event, correlationId: options.correlationId, attempt, status, ms: Date.now() - started, bytes, sha256 });
      if (response.ok) return { ok: true, status, jobId };
      // 5xx and n8n Cloud's 524 may pass on a retry. 4xx is a bug to fix, not to repeat:
      // 403 = wrong x-n8n-token, 404 = workflow not published, wrong path or a test URL.
      retryable = status >= 500;
    } catch (error) {
      // TimeoutError (AbortSignal.timeout) or a network error: retry with the same idempotency-key.
      status = null;
      retryable = true;
      console.warn("n8n.request_failed", {
        event,
        correlationId: options.correlationId,
        attempt,
        error: error instanceof Error ? error.name : "unknown",
        ms: Date.now() - started,
      });
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (!retryable || delay === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return { ok: false, status, retryable };
}

async function readJobId(response: Response): Promise<string | null> {
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null && "job_id" in value) {
      const jobId = (value as { job_id: unknown }).job_id;
      if (typeof jobId === "string" || typeof jobId === "number") return String(jobId);
    }
  } catch {
    // Not JSON: the status code alone is the answer.
  }
  return null;
}

function env(name: "N8N_WEBHOOK_BASE_URL" | "N8N_WEBHOOK_TOKEN" | "APP_BASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`); // the name only, never a value
  return value;
}
```

## 2. `lib/n8n/callback.ts`

```ts
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// n8n → Next.js callbacks: time window, signature, envelope (contract: skill integrating-n8n-webhooks).

export const MAX_CALLBACK_BYTES = 64 * 1024; // a callback carries links, not files
const MAX_CLOCK_SKEW_SECONDS = 300;

export type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  correlationId?: string;
  requestIdempotencyKey: string;
  result?: Record<string, unknown>;
  error?: { code: string };
  completedAt?: string;
};

export type CallbackEnvelope = { version: 1; event: string; data: CallbackData };

/** x-n8n-timestamp: Unix seconds, at most 300 s away from now in either direction. */
export function isFreshTimestamp(timestamp: string | null): timestamp is string {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) <= MAX_CLOCK_SKEW_SECONDS;
}

/** x-n8n-signature = "sha256=" + hex HMAC-SHA256(N8N_CALLBACK_SECRET, `${timestamp}.${rawBody}`). */
export function verifyCallbackSignature(rawBody: string, timestamp: string, signature: string | null): boolean {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !signature) return false;
  const hmac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  // Compare the whole "sha256=<hex>" as bytes: lengths first (timingSafeEqual throws on a
  // mismatch), then constant time. Never ===, never Buffer.from(hex, "hex") (it truncates).
  const expected = Buffer.from(`sha256=${hmac}`);
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Parses the body only after the signature check. null = wrong shape or an event this path doesn't take. */
export function parseCallbackEnvelope(raw: string, events: readonly string[]): CallbackEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || typeof value.event !== "string") return null;
  if (!events.includes(value.event)) return null;
  const data = value.data;
  if (!isRecord(data) || typeof data.jobId !== "string" || !data.jobId) return null;
  if (data.status !== "completed" && data.status !== "failed") return null;
  if (typeof data.requestIdempotencyKey !== "string" || !data.requestIdempotencyKey) return null;
  return { version: 1, event: value.event, data: data as CallbackData };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

## 3. `lib/n8n/callback-keys.ts`

In a project with a database, put these two functions next to the records (for example a table
`n8n_callback_keys` with a UNIQUE `key` column: the insert is the claim, a unique violation means
"duplicate"). The in-memory version below is for demos only.

```ts
import "server-only";

// Claimed idempotency-keys of n8n callbacks.
// DEMO ONLY: process memory, kept on globalThis because a Next.js 16 build doesn't share
// module-level variables between Route Handlers and pages. In production: a table or KV with a
// UNIQUE constraint on the key; serverless instances don't share memory at all.
const store = globalThis as typeof globalThis & { __n8nCallbackKeys?: Set<string> };
const claimed = (store.__n8nCallbackKeys ??= new Set<string>());

/** true = first time (claimed now); false = a repeat → answer 200 {"duplicate": true}. */
export async function claimCallbackKey(key: string): Promise<boolean> {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

/** Processing failed after the claim: free the key so n8n's Retry On Fail is processed again. */
export async function releaseCallbackKey(key: string): Promise<void> {
  claimed.delete(key);
}
```

## 4. `app/api/n8n/[event]/route.ts`

One route for all events. `CALLBACKS` maps the path segment to the events n8n may send there and to
the feature function that saves the result. No `export const runtime`.

```ts
import { createHash } from "node:crypto";
import { after } from "next/server";
import {
  MAX_CALLBACK_BYTES,
  isFreshTimestamp,
  parseCallbackEnvelope,
  verifyCallbackSignature,
  type CallbackData,
  type CallbackEnvelope,
} from "@/lib/n8n/callback";
import { claimCallbackKey, releaseCallbackKey } from "@/lib/n8n/callback-keys";
import { applyQuoteResult } from "@/lib/quotes";

// n8n → Next.js. A Route Handler is a public endpoint: the signature is its only authentication.

type Callback = {
  /** The body events n8n may send to this path. */
  events: readonly string[];
  /** Saves the minimal state (status, document link) BEFORE the 202. false = no such job. */
  apply: (event: string, data: CallbackData) => Promise<boolean>;
  /** Slow follow-ups (emails, notifications): run in after(). */
  afterResponse?: (event: string, data: CallbackData) => Promise<void>;
};

// Path segment → its callback. Unknown path → 404.
const CALLBACKS: Record<string, Callback> = {
  "quote-request": {
    events: ["quote-request.completed", "quote-request.failed"],
    apply: applyQuoteResult,
  },
};

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const started = Date.now();
  const { event: path } = await ctx.params;
  const correlationId = request.headers.get("x-correlation-id");
  const bodyInfo: { bytes?: number; sha256?: string } = {}; // filled once the body is read
  const respond = (status: number, payload: Record<string, unknown>) => {
    console.info("n8n.callback", { path, correlationId, status, ms: Date.now() - started, ...bodyInfo });
    return Response.json(payload, { status });
  };

  // 1. Unknown event → 404, not JSON → 415: both before reading the body.
  const callback = Object.hasOwn(CALLBACKS, path) ? CALLBACKS[path] : undefined;
  if (!callback) return respond(404, { error: "not_found" });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return respond(415, { error: "unsupported_media_type" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CALLBACK_BYTES) return respond(413, { error: "too_large" });

  // 2. The raw text, read once. No request.json() / JSON.parse before the signature check.
  const raw = await request.text();
  bodyInfo.bytes = Buffer.byteLength(raw);
  bodyInfo.sha256 = createHash("sha256").update(raw).digest("hex");
  // 3. 64 KB at most.
  if (bodyInfo.bytes > MAX_CALLBACK_BYTES) return respond(413, { error: "too_large" });

  // 4. ±300 s window. 5. HMAC over `${timestamp}.${raw}` (length check + timingSafeEqual inside).
  const timestamp = request.headers.get("x-n8n-timestamp");
  if (!isFreshTimestamp(timestamp)) return respond(401, { error: "unauthorized" });
  if (!verifyCallbackSignature(raw, timestamp, request.headers.get("x-n8n-signature"))) {
    return respond(401, { error: "unauthorized" });
  }

  // 6. Claim the idempotency-key. A repeat gets 200, so n8n stops retrying and nothing changes twice.
  const key = request.headers.get("idempotency-key");
  if (!key) return respond(400, { error: "bad_request" });
  if (!(await claimCallbackKey(key))) return respond(200, { duplicate: true });

  let envelope: CallbackEnvelope | null;
  try {
    // 7. Parse only now. The key header isn't signed, so it must equal the signed body's `${jobId}:${event}`.
    envelope = parseCallbackEnvelope(raw, callback.events);
    if (!envelope || key !== `${envelope.data.jobId}:${envelope.event}`) {
      await releaseCallbackKey(key);
      return respond(400, { error: "bad_request" });
    }
    // 8. Save the minimal state BEFORE answering: after a 2xx n8n never sends this callback again.
    if (!(await callback.apply(envelope.event, envelope.data))) {
      await releaseCallbackKey(key);
      return respond(404, { error: "unknown_job" });
    }
  } catch (error) {
    await releaseCallbackKey(key);
    console.error("n8n.callback_failed", { path, correlationId, error: error instanceof Error ? error.name : "unknown" });
    return respond(500, { error: "internal_error" });
  }

  // 10. Slow follow-ups after the response, each with its own try/catch.
  const { afterResponse } = callback;
  if (afterResponse) {
    const { event, data } = envelope;
    after(async () => {
      try {
        await afterResponse(event, data);
      } catch (error) {
        console.error("n8n.callback_after_failed", { path, correlationId, error: error instanceof Error ? error.name : "unknown" });
      }
    });
  }
  // 9.
  return respond(202, { ok: true });
}
```

## 5. The Server Action

The form itself (fields, accessible errors, `useActionState`, no JS) follows the team's form
pattern. Only the n8n part is prescribed here. Validation below is shortened.

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";
import { createQuote, markQuoteTriggered } from "@/lib/quotes";

export type QuoteRequestState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<"company" | "description", string>> }
  | { status: "ok"; id: string };

export async function submitQuoteRequest(_prev: QuoteRequestState, formData: FormData): Promise<QuoteRequestState> {
  // Session, permission and validation come first, inside the action (server-auth-actions).
  const company = String(formData.get("company") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budget = Number(formData.get("budget")) || null;
  if (!company || !description) {
    return { status: "invalid", errors: { ...(!company && { company: "Вкажіть компанію" }), ...(!description && { description: "Опишіть задачу" }) } };
  }

  // Both keys are created ONCE and stored with the record: every retry reuses them.
  const quote = await createQuote({ company, budget, description, idempotencyKey: randomUUID(), correlationId: randomUUID() });

  // The user doesn't wait for n8n (server-after-nonblocking): save, answer, then trigger.
  after(async () => {
    try {
      const result = await triggerWorkflow(
        "quote-request",
        { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
        { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callback: true },
      );
      await markQuoteTriggered(quote.id, result.ok ? { status: "processing", jobId: result.jobId } : { status: "failed" });
    } catch (error) {
      console.error("quote.trigger_failed", { quoteId: quote.id, error: error instanceof Error ? error.name : "unknown" });
      await markQuoteTriggered(quote.id, { status: "failed" });
    }
  });

  return { status: "ok", id: quote.id };
}
```

- `redirect(`/quotes/${quote.id}`)` instead of `return { status: "ok", id }` works too: `after()`
  still runs.
- `data` holds what the workflow needs to build the quote. No email, phone or name unless the
  workflow uses them; never the whole record.

## 6. What the feature's data layer must provide

The route and the action above call three functions. Their behaviour is part of the contract:

```ts
// Saves the record with status "queued" and both keys; returns it.
createQuote(input: { company; budget; description; idempotencyKey; correlationId }): Promise<Quote>;

// queued → processing (n8n answered 202, keep jobId) or queued → failed (4xx / retries exhausted).
// Changes ONLY a "queued" record: a fast callback may already have set "ready".
markQuoteTriggered(id: string, update: { status: "processing" | "failed"; jobId?: string | null }): Promise<void>;

// Finds the record by data.requestIdempotencyKey (the key the app generated, not n8n's jobId),
// sets "ready" (+ documentUrl from data.result) or "failed"; false when no record matches.
applyQuoteResult(event: string, data: CallbackData): Promise<boolean>;
```

A demo store that keeps records in memory must hang them on `globalThis`, exactly like
`callback-keys.ts`. In a Next.js 16 build the callback Route Handler and the `/quotes/[id]` page
get separate copies of module-level variables. Tested on 16.3.5: with a plain module `Map`, the
route saved `ready` and the page still showed "not found". With `globalThis` the page showed
`processing` and then `ready`:

```ts
const store = globalThis as typeof globalThis & { __quotes?: Map<string, Quote> };
const quotes = (store.__quotes ??= new Map<string, Quote>());
```

The status page reads the status from the store and never asks n8n. To refresh while the status is
`queued`/`processing`, re-render the page on a timer (for example a small client component calling
`router.refresh()` every few seconds). The callback is the only source of the result.

## 7. `.env.example`

```bash
# n8n (skill integrating-n8n-webhooks). All server-only: never NEXT_PUBLIC_.
# Production webhook base, ends with /webhook (never /webhook-test/). Locally: the offline mock.
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
# Value of the x-n8n-token header = the Header Auth credential in n8n.
N8N_WEBHOOK_TOKEN=change-me-webhook-token
# HMAC secret for callbacks = the Hmac Secret of the Crypto credential in n8n.
N8N_CALLBACK_SECRET=change-me-callback-secret
# Where n8n reaches this app's callback endpoints (/api/n8n/<event>).
APP_BASE_URL=http://127.0.0.1:3000
```

Real values go to `.env.local` (git-ignored) and the hosting settings, and the human puts them
there. Secret generator for the human: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

## 8. A row in `docs/n8n-integrations.md`

```markdown
| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → callback | `/webhook/quote-request` | Respond to Webhook 202 + callback | <responsible person> |
```
