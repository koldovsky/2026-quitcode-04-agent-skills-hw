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
