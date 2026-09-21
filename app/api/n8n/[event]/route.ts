import { after } from "next/server";
import { db } from "@/lib/db";
import { parseCallbackEnvelope, readBodyLimited, type CallbackHandler } from "@/lib/n8n/envelope";
import { verifyN8nSignature } from "@/lib/n8n/signature";
import { handleQuoteCallback } from "@/lib/quotes";

// Callbacks from n8n (HTTP Request node), skill integrating-n8n-webhooks.
// Order: event -> content type -> raw bytes -> timestamp + HMAC -> idempotency claim
// -> parse -> durable write -> 202 -> after().

const MAX_BODY_BYTES = 64 * 1024;
const HANDLERS: Record<string, CallbackHandler> = { "quote-request": handleQuoteCallback };

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  // Object.hasOwn: "toString", "constructor"... must not resolve to a handler via the prototype.
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return Response.json({ error: "unknown event" }, { status: 404 });

  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported media type" }, { status: 415 });
  }

  const rawBody = await readBodyLimited(request, MAX_BODY_BYTES); // bytes first, never request.json()
  if (!rawBody) return Response.json({ error: "payload too large" }, { status: 413 });

  const correlationId = (request.headers.get("x-correlation-id") ?? "-").slice(0, 64);
  const verified = verifyN8nSignature({
    rawBody,
    timestamp: request.headers.get("x-n8n-timestamp"),
    signature: request.headers.get("x-n8n-signature"),
    secret: process.env.N8N_CALLBACK_SECRET,
  });
  if (!verified.ok) {
    console.warn(`n8n <- ${event} rejected: ${verified.reason} corr=${correlationId} ${rawBody.byteLength} B`);
    return new Response(null, { status: verified.reason === "no-secret" ? 500 : 401 });
  }

  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 200) return Response.json({ error: "idempotency-key required" }, { status: 400 });
  if (!(await db.claimCallbackKey(key))) {
    console.info(`n8n <- ${event} duplicate corr=${correlationId}`);
    return Response.json({ duplicate: true }, { status: 200 });
  }

  try {
    const envelope = parseCallbackEnvelope(rawBody, `${event}.completed`); // parse only after verification
    if (!envelope) {
      await db.releaseCallbackKey(key);
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
    const outcome = await handler(envelope.data); // small durable write BEFORE the 2xx
    if (outcome.status === "unknown-job") {
      await db.releaseCallbackKey(key);
      return Response.json({ error: "unknown job" }, { status: 404 });
    }
    if (outcome.afterResponse) after(outcome.afterResponse); // slow side effects after the 2xx
    const jobStatus = envelope.data.status;
    console.info(`n8n <- ${event} ${jobStatus} accepted corr=${correlationId}`);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    await db.releaseCallbackKey(key); // let n8n's Retry On Fail try again
    console.error(`n8n <- ${event} failed corr=${correlationId}: ${error instanceof Error ? error.name : "error"}`);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
