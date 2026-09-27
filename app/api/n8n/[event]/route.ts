import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Callback endpoint that n8n calls when an async workflow is done.
// Contract: .claude/skills/integrating-n8n-webhooks (signed body, 300 s window, idempotency key).

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

type Callback = {
  version: 1;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    requestIdempotencyKey: string;
    result?: { documentUrl?: unknown };
    error?: { code?: string };
  };
};

// The status page renders documentUrl as a link: accept only an absolute https URL.
function safeDocumentUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

// One handler per event; returns false if the record does not exist.
const HANDLERS: Record<string, (data: Callback["data"]) => Promise<boolean>> = {
  "quote-request": async (data) => {
    const quote = await db.getQuoteByRequestKey(data.requestIdempotencyKey);
    if (!quote) return false;
    if (data.status === "completed") {
      await db.updateQuote(quote.id, { status: "ready", documentUrl: safeDocumentUrl(data.result?.documentUrl) });
    } else {
      // "ready" is final: a failed callback of another n8n execution (new jobId) must not take the PDF away.
      // Checked in the same write; a skipped write is still an accepted callback.
      await db.updateQuote(quote.id, { status: "failed" }, ["queued", "sent"]);
    }
    return true;
  },
};

const reply = (status: number, body: Record<string, unknown> = {}) => Response.json(body, { status });

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const started = Date.now();
  const { event } = await ctx.params;
  const correlationId = request.headers.get("x-correlation-id") ?? "-";
  let bodyBytes = 0;
  const done = (status: number, body?: Record<string, unknown>) => {
    // Event, direction, correlation id, status, duration, body size. Never the body or the headers' values.
    console.info(JSON.stringify({ n8n: "in", event, correlationId, status, bytes: bodyBytes, ms: Date.now() - started }));
    return reply(status, body);
  };

  // 1. Before reading the body
  const handler = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handler) return done(404, { error: "unknown event" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return done(415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return done(413);

  // 2-3. Raw body, read once; no request.json() and no JSON.parse before the signature
  const raw = await request.text();
  bodyBytes = Buffer.byteLength(raw);
  if (bodyBytes > MAX_BODY_BYTES) return done(413);

  // 4. Timestamp window, both directions
  const timestamp = request.headers.get("x-n8n-timestamp") ?? "";
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > WINDOW_SECONDS) {
    return done(401);
  }

  // 5. Signature over "<timestamp>.<raw body>": length first, then timingSafeEqual
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return done(500);
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(request.headers.get("x-n8n-signature") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return done(401);

  // 6. Claim the idempotency key
  const key = request.headers.get("idempotency-key") ?? "";
  if (!key) return done(400);
  if (!(await db.claimCallbackKey(key))) return done(200, { duplicate: true });

  try {
    // 7. Now parse and check the shape; the key must equal fields of the SIGNED body
    let body: Callback;
    try {
      body = JSON.parse(raw);
    } catch {
      await db.releaseCallbackKey(key);
      return done(400);
    }
    const d = body?.data;
    const shapeOk =
      body?.version === 1 &&
      typeof d?.jobId === "string" &&
      typeof d?.requestIdempotencyKey === "string" &&
      (d.status === "completed" || d.status === "failed") &&
      body.event === `${event}.${d.status}`; // the event suffix and data.status must agree
    if (!shapeOk || key !== `${d.jobId}:${body.event}`) {
      await db.releaseCallbackKey(key);
      return done(400);
    }
    // 8-9. Save the minimal state BEFORE answering
    if (!(await handler(d))) {
      await db.releaseCallbackKey(key);
      return done(404);
    }
  } catch {
    await db.releaseCallbackKey(key);
    return done(500);
  }

  // 11. Slow side effects (emails, notifications) would go into after() here.
  return done(202, { ok: true }); // 10.
}
