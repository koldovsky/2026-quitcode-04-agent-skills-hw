import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

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
    typeof d === "object" &&
    d !== null &&
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

  // 6. idempotency — claim before touching data
  const key = request.headers.get("idempotency-key");
  if (!key) return json(400, { error: "bad_request" });
  if (!db.claimCallbackKey(key)) return json(200, { duplicate: true });

  try {
    // 7. parse only now, then check shape, event and key against the signed body
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      db.releaseCallbackKey(key);
      return json(400, { error: "bad_request" });
    }
    if (
      !isCallbackBody(body) ||
      !body.event.startsWith(`${event}.`) ||
      key !== `${body.data.jobId}:${body.event}`
    ) {
      db.releaseCallbackKey(key);
      return json(400, { error: "bad_request" });
    }

    // 8. minimal state BEFORE responding (finds our record by requestIdempotencyKey)
    const saved = await db.applyQuoteCallback({
      jobId: body.data.jobId,
      status: body.data.status,
      requestIdempotencyKey: body.data.requestIdempotencyKey,
      documentUrl: body.data.result?.documentUrl,
      errorCode: body.data.error?.code,
    });
    if (!saved) {
      db.releaseCallbackKey(key);
      return json(400, { error: "bad_request" });
    }
    console.info(
      `n8n callback event=${body.event} corr=${body.data.correlationId ?? "-"} status=${body.data.status} bytes=${raw.length}`,
    );

    // 9.
    return json(202, { ok: true });
  } catch (error) {
    db.releaseCallbackKey(key);
    console.error(`n8n callback event=${event} error=${error instanceof Error ? error.name : "Error"}`);
    return json(500, { error: "internal" });
  }
}
