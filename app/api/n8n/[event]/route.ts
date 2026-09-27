import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

const KNOWN_EVENTS = new Set(["quote-request"]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;

type CallbackBody = {
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    requestIdempotencyKey: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
  };
};

function verifySignature(timestamp: string, raw: string, signature: string, secret: string) {
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

function isPlausibleCallbackBody(value: unknown): value is CallbackBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (typeof body.event !== "string") return false;
  const data = body.data;
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.jobId === "string" &&
    (d.status === "completed" || d.status === "failed") &&
    typeof d.requestIdempotencyKey === "string"
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;

  // 1. Unknown event / wrong content-type — before reading the body.
  if (!KNOWN_EVENTS.has(event)) {
    return new Response(null, { status: 404 });
  }
  if (request.headers.get("content-type") !== "application/json") {
    return new Response(null, { status: 415 });
  }

  // 2. Raw text, read exactly once — needed byte-for-byte for the signature.
  const raw = await request.text();

  // 3. Body size limit.
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  // 4. Reject stale or future timestamps (replay window).
  const timestampHeader = request.headers.get("x-n8n-timestamp") ?? "";
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return new Response(null, { status: 401 });
  }

  // 5. HMAC signature, constant-time compare.
  const secret = process.env.N8N_CALLBACK_SECRET;
  const signature = request.headers.get("x-n8n-signature") ?? "";
  if (!secret || !verifySignature(timestampHeader, raw, signature, secret)) {
    return new Response(null, { status: 401 });
  }

  // 6. Claim the idempotency key before doing anything else.
  const idempotencyKeyHeader = request.headers.get("idempotency-key") ?? "";
  const claimed = await db.claimCallbackKey(idempotencyKeyHeader);
  if (!claimed) {
    return Response.json({ duplicate: true }, { status: 200 });
  }

  // 7. Only now parse and validate the shape.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await db.releaseCallbackKey(idempotencyKeyHeader);
    return new Response(null, { status: 400 });
  }

  if (
    !isPlausibleCallbackBody(parsed) ||
    (parsed.event !== `${event}.completed` && parsed.event !== `${event}.failed`) ||
    idempotencyKeyHeader !== `${parsed.data.jobId}:${parsed.event}`
  ) {
    await db.releaseCallbackKey(idempotencyKeyHeader);
    return new Response(null, { status: 400 });
  }

  const quote = await db.getQuoteByIdempotencyKey(parsed.data.requestIdempotencyKey);
  if (!quote) {
    await db.releaseCallbackKey(idempotencyKeyHeader);
    return new Response(null, { status: 400 });
  }

  // 8. Persist the minimal state before responding.
  if (parsed.data.status === "completed" && parsed.data.result?.documentUrl) {
    await db.updateQuoteResult(quote.id, {
      status: "completed",
      documentUrl: parsed.data.result.documentUrl,
    });
  } else {
    await db.updateQuoteResult(quote.id, {
      status: "failed",
      errorCode: parsed.data.error?.code ?? "unknown",
    });
  }

  // 9. Acknowledge.
  return Response.json({ ok: true }, { status: 202 });
}
