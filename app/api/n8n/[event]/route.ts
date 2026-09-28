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
