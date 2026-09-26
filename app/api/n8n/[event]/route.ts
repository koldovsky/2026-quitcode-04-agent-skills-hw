import crypto from "node:crypto";
import { db } from "@/lib/db";

// Callbacks from n8n: POST /api/n8n/<event>. This is a public endpoint, so only the
// HMAC signature is trusted. Step order matters — see
// .claude/skills/integrating-n8n-webhooks/references/callback-route.md.

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

type CallbackBody = {
  version: 1;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    correlationId: string | null;
    requestIdempotencyKey: string;
    documentUrl: string | null;
    errorCode: string | null;
  };
};

// "conflict": authentic callback that must not change the record (e.g. another job for a finished quote).
type HandlerResult = "applied" | "conflict";

const HANDLERS: Record<string, (body: CallbackBody) => Promise<HandlerResult>> = {
  "quote-request": handleQuoteCallback,
};

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return Response.json({ error: "not_found" }, { status: 404 });
  // Compare the media type itself: "application/json; charset=utf-8" is fine, "application/jsonx" is not.
  const mediaType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  // Refuse a declared oversized body before reading it into memory; the real length is checked again below.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  // Raw text: the signature covers the exact bytes, JSON re-serialization would change them.
  // Read with a cap: a chunked body has no Content-Length, and req.text() would buffer all of it.
  const raw = await readBodyLimited(req, MAX_BODY_BYTES);
  if (raw === null) return Response.json({ error: "too_large" }, { status: 413 });

  const ts = Number(req.headers.get("x-n8n-timestamp"));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > WINDOW_SECONDS) return unauthorized();

  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return Response.json({ error: "not_configured" }, { status: 500 });
  const expected = Buffer.from("sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex"));
  const received = Buffer.from(req.headers.get("x-n8n-signature") ?? "");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return unauthorized();

  const key = req.headers.get("idempotency-key") ?? "";
  if (!key) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!(await db.claimCallbackKey(key))) return Response.json({ duplicate: true }, { status: 200 });

  try {
    const body = parseCallback(raw);
    // The idempotency-key header is not signed, so it must match the signed body.
    if (
      !body ||
      (body.event !== `${event}.completed` && body.event !== `${event}.failed`) ||
      // data.status must agree with the event, or a ".failed" event could mark a quote ready
      body.event !== `${event}.${body.data.status}` ||
      key !== `${body.data.jobId}:${body.event}`
    ) {
      await db.releaseCallbackKey(key);
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    // Saved before responding: after a 2xx n8n will not retry.
    if ((await handler(body)) === "conflict") {
      await db.releaseCallbackKey(key);
      const { correlationId } = body.data;
      console.warn("n8n.callback", { event: body.event, correlationId, error: "conflict" });
      return Response.json({ error: "conflict" }, { status: 409 });
    }
    const { correlationId, status } = body.data;
    console.info("n8n.callback", { event: body.event, correlationId, status, bytes: raw.length });
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    await db.releaseCallbackKey(key);
    console.error("n8n.callback", { event, error: "handler_failed", bytes: raw.length });
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

async function handleQuoteCallback(body: CallbackBody): Promise<HandlerResult> {
  const quote = await db.getQuoteByIdempotencyKey(body.data.requestIdempotencyKey);
  if (!quote) {
    // Authentic, but not ours (or already deleted): acknowledge so n8n stops retrying.
    const { correlationId } = body.data;
    console.warn("n8n.callback", { event: body.event, correlationId, error: "quote_not_found" });
    return "applied";
  }

  // The workflow copies x-correlation-id from our request into the signed body: a callback that carries
  // another request's correlation id is not about this quote.
  if (body.data.correlationId !== quote.correlationId) return "conflict";

  // A finished quote is never overwritten: a second or stale workflow run gets 409.
  const patch =
    body.data.status === "completed" && body.data.documentUrl
      ? { status: "ready" as const, documentUrl: body.data.documentUrl, errorCode: null }
      : { status: "failed" as const, errorCode: body.data.errorCode ?? "workflow_failed" };
  const updated = await db.updateQuote(quote.id, patch, ["queued", "processing"]);
  return updated ? "applied" : "conflict";
}

function parseCallback(raw: string): CallbackBody | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1 || typeof value.event !== "string" || !isObject(value.data)) return null;

  const data = value.data;
  if (!isNonEmptyString(data.jobId) || !isNonEmptyString(data.requestIdempotencyKey)) return null;
  if (data.status !== "completed" && data.status !== "failed") return null;

  let documentUrl: string | null = null;
  if (data.status === "completed") {
    documentUrl = isObject(data.result) ? safeHttpUrl(data.result.documentUrl) : null;
    if (!documentUrl) return null;
  }
  const errorCode = isObject(data.error) && isNonEmptyString(data.error.code) ? data.error.code.slice(0, 64) : null;

  return {
    version: 1,
    event: value.event,
    data: {
      jobId: data.jobId,
      status: data.status,
      correlationId: isNonEmptyString(data.correlationId) ? data.correlationId : null,
      requestIdempotencyKey: data.requestIdempotencyKey,
      documentUrl,
      errorCode,
    },
  };
}

// The link is rendered as <a href>, so only http(s) is accepted (no javascript: etc.).
function safeHttpUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Reads the request body as UTF-8 text, giving up (null) as soon as it exceeds `limit` bytes.
async function readBodyLimited(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
