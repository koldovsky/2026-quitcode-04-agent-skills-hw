import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { claimCallbackKey, releaseCallbackKey } from "@/lib/n8n/callback-keys";

// Public HTTP endpoint that n8n calls when a long workflow finishes. Only the signature is trusted.

const MAX_BODY_BYTES = 64 * 1024;
const TIMESTAMP_WINDOW_S = 300;

type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  correlationId?: string;
  requestIdempotencyKey: string;
  result?: { documentUrl?: unknown };
  error?: { code?: unknown };
  completedAt?: string;
};

// Only http(s) links reach the status page — never javascript: or data: URLs.
function safeDocumentUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// One entry per event path: null → bad payload, false → unknown record, true → saved.
const HANDLERS: Record<string, (data: CallbackData) => Promise<boolean | null>> = {
  "quote-request": async (data) => {
    if (data.status === "completed") {
      const documentUrl = safeDocumentUrl(data.result?.documentUrl);
      if (!documentUrl) return null;
      return db.completeQuoteFromCallback(data.requestIdempotencyKey, data.jobId, { status: "completed", documentUrl });
    }
    const errorCode = typeof data.error?.code === "string" ? data.error.code.slice(0, 64) : "unknown";
    return db.completeQuoteFromCallback(data.requestIdempotencyKey, data.jobId, { status: "failed", errorCode });
  },
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
    const saved = await handler(body.data);
    if (saved === null) {
      releaseCallbackKey(key);
      return reply(400, { error: "bad request" });
    }
    if (!saved) {
      releaseCallbackKey(key);
      return reply(404, { error: "unknown job" });
    }
    const correlationId = request.headers.get("x-correlation-id") ?? "-";
    console.info(`[n8n] in event=${body.event} status=202 bytes=${Buffer.byteLength(raw)} correlation=${correlationId}`);
    // Slow side effects (email with the PDF, notifications) belong in after(), not before the reply.
    return reply(202, { ok: true });
  } catch (error) {
    releaseCallbackKey(key);
    console.error(`[n8n] in event=${event} status=500 error=${error instanceof Error ? error.name : "unknown"}`);
    return reply(500, { error: "internal error" });
  }
}
