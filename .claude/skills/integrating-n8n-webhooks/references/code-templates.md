# Шаблони коду (Next.js 16.3.5, перевірені)

Ці файли зібрано й перевірено в LeadDesk: `npm run lint` і `npm run build` без помилок,
`scripts/check-contract.mjs` — 14/14 PASS, `scripts/send-signed-callback.mjs` проти роуту — 12/12 PASS.
Копіюйте й підставляйте свою подію; назви функцій і порядок кроків — частина контракту.

## `lib/n8n/client.ts` — єдиний модуль, що викликає n8n

```ts
import "server-only";
import { randomUUID } from "node:crypto";

// The only module that talks to n8n webhooks (contract: skill integrating-n8n-webhooks).
const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries = 3 attempts, only network/timeout/5xx/524

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | "timeout" | "network" };

export type TriggerOptions = {
  /** Created once per business operation and stored with the record; the same on every retry. */
  idempotencyKey: string;
  /** Chain id for the logs of both systems; generated if absent. */
  correlationId?: string;
  /** Async workflows only: path of our callback route, e.g. "/api/n8n/quote-request". */
  callbackPath?: string;
};

function requireEnv(name: "N8N_WEBHOOK_BASE_URL" | "N8N_WEBHOOK_TOKEN" | "APP_BASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(event)) throw new Error("n8n event must be kebab-case");
  const url = `${requireEnv("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "")}/${event}`;
  const correlationId = options.correlationId ?? randomUUID();
  const envelope = JSON.stringify({
    version: 1,
    event,
    data,
    ...(options.callbackPath
      ? { callbackUrl: new URL(options.callbackPath, requireEnv("APP_BASE_URL")).toString() }
      : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let result: TriggerResult;
    let retryable = false;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": requireEnv("N8N_WEBHOOK_TOKEN"),
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Only the status code matters; the message text differs between n8n versions.
      let jobId: string | null = null;
      if (response.status === 202) {
        const json = (await response.json().catch(() => null)) as { job_id?: unknown } | null;
        jobId = typeof json?.job_id === "string" ? json.job_id : null;
      }
      result = response.ok ? { ok: true, status: response.status, jobId } : { ok: false, status: response.status };
      retryable = response.status >= 500; // 5xx and 524; never 4xx (403 token, 404 not published / test URL)
    } catch (error) {
      result = { ok: false, status: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
      retryable = true;
    }
    // Event, direction, correlation id, status, duration, attempt: never the body, contacts or the token.
    console.info(
      `n8n out event=${event} correlation=${correlationId} attempt=${attempt} status=${result.status} ms=${Date.now() - started}`,
    );
    if (result.ok || !retryable || attempt > RETRY_DELAYS_MS.length) return result;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
}
```

## `lib/n8n/idempotency.ts` — ключі колбеків (демо-сховище)

```ts
import "server-only";

// DEMO store: process memory. In a real project use a DB/KV table with a UNIQUE constraint:
// serverless instances do not share memory between requests.
const globalForKeys = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (globalForKeys.n8nCallbackKeys ??= new Set<string>());

/** true if the key was free and is now claimed; false if it was already processed. */
export async function claimIdempotencyKey(key: string): Promise<boolean> {
  if (keys.has(key)) return false;
  keys.add(key);
  return true;
}

/** Free the key when processing failed after the claim, so the n8n retry is not lost. */
export async function releaseIdempotencyKey(key: string): Promise<void> {
  keys.delete(key);
}
```

## `lib/n8n/callbacks.ts` — реєстр подій, що кличуть нас назад

Замініть `"example-event"` на свою подію (напр. `"quote-request"`), обробник зберігає стан у БД.

```ts
import "server-only";

export type CallbackEnvelope = {
  version: 1;
  event: string; // "<path>.completed" | "<path>.failed"
  data: {
    jobId: string;
    status: "completed" | "failed";
    correlationId?: string;
    requestIdempotencyKey?: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
    completedAt?: string;
  };
};

type Handler = (callback: CallbackEnvelope) => Promise<void>;

// One entry per n8n event that calls us back. The handler stores the minimal state BEFORE we answer.
const handlers: Record<string, Handler> = {
  "example-event": async (callback) => {
    // Find the record by callback.data.requestIdempotencyKey (stored when the workflow was triggered)
    // and save status + result link. Throw on failure: the route frees the key and answers 500.
    void callback;
  },
};

export const isKnownEvent = (event: string) => Object.hasOwn(handlers, event);

export function parseCallback(value: unknown, pathEvent: string): CallbackEnvelope | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<CallbackEnvelope>;
  const d = v.data as Partial<CallbackEnvelope["data"]> | undefined;
  if (v.version !== 1 || typeof v.event !== "string") return null;
  if (v.event !== `${pathEvent}.completed` && v.event !== `${pathEvent}.failed`) return null;
  if (!d || typeof d.jobId !== "string" || (d.status !== "completed" && d.status !== "failed")) return null;
  return v as CallbackEnvelope;
}

export async function handleCallback(pathEvent: string, callback: CallbackEnvelope): Promise<void> {
  await handlers[pathEvent](callback);
}
```

## `app/api/n8n/[event]/route.ts` — колбек-роут

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleCallback, isKnownEvent, parseCallback } from "@/lib/n8n/callbacks";
import { claimIdempotencyKey, releaseIdempotencyKey } from "@/lib/n8n/idempotency";

// n8n -> Next.js callback. Public endpoint: trust only the signature. The order of steps is the contract.
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

const json = (body: unknown, status: number) => Response.json(body, { status });

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  // 1. unknown event -> 404, wrong content type -> 415 (before reading the body)
  if (!isKnownEvent(event)) return json({ error: "not_found" }, 404);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  // 2. raw body, read once; no req.json() and no JSON.parse before the signature check
  const raw = await req.text();
  // 3. size limit
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  // 4. replay window: x-n8n-timestamp within 300 s either way
  const timestamp = req.headers.get("x-n8n-timestamp") ?? "";
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > WINDOW_SECONDS) {
    return json({ error: "unauthorized" }, 401);
  }

  // 5. HMAC-SHA256(secret, "<timestamp>.<raw>"), compare lengths first, then timingSafeEqual
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return json({ error: "server_error" }, 500);
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const received = Buffer.from(req.headers.get("x-n8n-signature") ?? "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  // 6. claim idempotency-key; seen before -> 200 duplicate (n8n stops retrying, nothing changes twice)
  const key = req.headers.get("idempotency-key") ?? "";
  if (!key) return json({ error: "bad_request" }, 400);
  if (!(await claimIdempotencyKey(key))) return json({ duplicate: true }, 200);

  try {
    // 7. parse + shape; the key must equal "<data.jobId>:<event>" taken from the signed body
    let parsed: ReturnType<typeof parseCallback> = null;
    try {
      parsed = parseCallback(JSON.parse(raw), event);
    } catch {
      parsed = null;
    }
    if (!parsed || key !== `${parsed.data.jobId}:${parsed.event}`) {
      await releaseIdempotencyKey(key);
      return json({ error: "bad_request" }, 400);
    }
    // 8. store the minimal state BEFORE answering (after a 2xx n8n will not retry)
    await handleCallback(event, parsed);
  } catch {
    await releaseIdempotencyKey(key); // let Retry On Fail in n8n deliver it again
    return json({ error: "server_error" }, 500);
  }

  // 9. accepted. 10. Slow work (mail, notifications) goes to after() from "next/server".
  console.info(`n8n in event=${event} correlation=${req.headers.get("x-correlation-id") ?? "-"} status=202`);
  return json({ ok: true }, 202);
}
```

`RouteContext<"/api/n8n/[event]">` — глобальний тип Next 16 (генерується під час `next build`/`next dev`).
Роут поза `/dashboard`, тож `proxy.ts` його не блокує; сесія тут не потрібна — лише підпис.

## Server Action: подія «до відома» (Immediately)

Фрагмент `submitLead` у `app/actions.ts` — замість `await fetch(process.env.N8N_WEBHOOK_URL!, …)`:

```ts
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";

  // Fire-and-forget event (n8n: Respond Immediately). The user does not wait for n8n or the audit.
  const idempotencyKey = randomUUID(); // one per business operation; store it with the record in a real DB
  after(async () => {
    await triggerWorkflow(
      "lead-created",
      { leadId: lead.id, company: lead.company, budget: lead.budget, source: lead.source },
      { idempotencyKey },
    );
    await logAudit("lead.created", lead.id);
  });
```

## Server Action: довгий воркфлоу (202 + колбек)

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { triggerWorkflow } from "@/lib/n8n/client";
// + сесія/права/валідація всередині дії — правило Vercel server-auth-actions

export async function requestSomething(_prev: State, formData: FormData): Promise<State> {
  // 1. сесія, права, валідація (parse…Form) — тут
  // 2. запис до виклику n8n: статус і ключі зберігаємо разом із записом
  const record = await db.insertRecord({
    ...parsed.data,
    status: "queued",
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // 3. користувач не чекає на n8n (воркфлоу 40–90 с → лише 202 + колбек)
  after(async () => {
    const result = await triggerWorkflow(
      "example-event",
      { recordId: record.id /* мінімум полів, потрібних воркфлоу */ },
      { idempotencyKey: record.idempotencyKey, correlationId: record.correlationId, callbackPath: "/api/n8n/example-event" },
    );
    await db.updateRecord(record.id, result.ok ? { status: "processing", jobId: result.jobId } : { status: "failed" });
    revalidatePath(`/records/${record.id}`);
  });

  return { status: "ok", id: record.id }; // лише статус і id, не рядок з БД
}
```

Обробник колбека в `lib/n8n/callbacks.ts` знаходить запис за `callback.data.requestIdempotencyKey` і
ставить `status: "ready"` + `documentUrl` (або `"failed"` для `data.status === "failed"`), потім
`revalidatePath`. Якщо колбек прийшов раніше, ніж `after()` зберіг `processing`, — не повертайте статус
назад із `ready` у `processing` (оновлюйте лише з `queued`).

## `.env.example`

```dotenv
# LeadDesk local settings. Copy this file to .env.local and put real values there.

# n8n webhooks: production base URL (never the test URL), the event is appended as /<event>
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
# Value of header x-n8n-token (Header Auth credential in n8n)
N8N_WEBHOOK_TOKEN=change-me-webhook-token
# HMAC secret for callbacks (Crypto credential in n8n)
N8N_CALLBACK_SECRET=change-me-callback-secret
# Where n8n reaches our callback routes
APP_BASE_URL=http://127.0.0.1:3000
```
