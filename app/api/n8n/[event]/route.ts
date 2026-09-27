import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { claimKey, releaseKey } from "@/lib/n8n/idempotency";

// Callback n8n → Next.js. Public endpoint: only the signature is trusted.
// Order of checks: .claude/skills/integrating-n8n-webhooks/references/callback.md

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

type CallbackBody = {
  version: 1;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    requestIdempotencyKey?: string;
    result?: { documentUrl?: unknown };
    error?: { code?: unknown };
  };
};

// Thrown by a handler when the signed body is well-formed but its content is unusable → 400.
class InvalidCallback extends Error {}

// One handler per known event; each saves the minimal state BEFORE the response.
const HANDLERS: Record<string, (data: CallbackBody["data"], correlationId: string) => Promise<void>> = {
  "quote-request": async (data, correlationId) => {
    let patch;
    if (data.status === "completed") {
      const documentUrl = safeHttpUrl(data.result?.documentUrl);
      if (!documentUrl) throw new InvalidCallback();
      patch = { status: "ready" as const, documentUrl, errorCode: null };
    } else {
      const code = typeof data.error?.code === "string" ? data.error.code.slice(0, 64) : "unknown";
      patch = { status: "failed" as const, errorCode: `workflow_${code}` };
    }

    const outcome = await db.completeQuote(
      {
        requestIdempotencyKey: typeof data.requestIdempotencyKey === "string" ? data.requestIdempotencyKey : undefined,
        jobId: data.jobId,
      },
      patch,
    );
    // Signed by n8n but for no quote we know (or already final): acknowledge, nothing to retry.
    if (outcome !== "updated") console.warn("quote.callback_unmatched", { correlationId, outcome });
  },
};

export async function POST(request: Request, context: RouteContext<"/api/n8n/[event]">) {
  const { event } = await context.params;
  const correlationId = request.headers.get("x-correlation-id") ?? "none";

  // 1. Known event and JSON content type — before reading the body.
  // Object.hasOwn: "constructor", "toString" or "__proto__" in the path must be 404 too.
  const handle = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handle) return reply(404, "unknown", correlationId); // the path is attacker-controlled: not logged
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, event, correlationId);

  // 2–3. Raw body, read once, size-limited.
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, event, correlationId);

  // 4. Timestamp window against replays.
  const timestamp = Number(request.headers.get("x-n8n-timestamp"));
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > WINDOW_SECONDS) {
    return reply(401, event, correlationId);
  }

  // 5. Signature: lengths first, then a constant-time comparison.
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", process.env.N8N_CALLBACK_SECRET ?? "").update(`${timestamp}.${raw}`).digest("hex")}`,
  );
  const received = Buffer.from(request.headers.get("x-n8n-signature") ?? "");
  if (!process.env.N8N_CALLBACK_SECRET || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return reply(401, event, correlationId);
  }

  // 6. Claim the idempotency key; a repeat is acknowledged but not processed again.
  const key = request.headers.get("idempotency-key");
  if (!key) return reply(400, event, correlationId);
  if (!(await claimKey(key))) {
    log(200, event, correlationId, raw);
    return Response.json({ duplicate: true });
  }

  // 7–8. Only now parse, check the shape against the path and the key, save the state.
  try {
    let body: CallbackBody;
    try {
      body = JSON.parse(raw) as CallbackBody;
    } catch {
      await releaseKey(key);
      return reply(400, event, correlationId);
    }
    const data = body?.data;
    const valid =
      body?.version === 1 &&
      typeof body.event === "string" &&
      body.event.startsWith(`${event}.`) &&
      typeof data?.jobId === "string" &&
      key === `${data.jobId}:${body.event}` &&
      // completed carries result, failed carries error — nothing else is accepted
      ((data.status === "completed" && typeof data.result === "object" && data.result !== null) ||
        (data.status === "failed" && typeof data.error === "object" && data.error !== null));
    if (!valid) {
      await releaseKey(key);
      return reply(400, event, correlationId);
    }
    await handle(body.data, correlationId);
  } catch (error) {
    await releaseKey(key); // otherwise n8n's retry would get {"duplicate":true} and the result is lost
    return reply(error instanceof InvalidCallback ? 400 : 500, event, correlationId);
  }

  // 9. Notifications (e-mail with the PDF etc.) would go into after() here.
  log(202, event, correlationId, raw);
  return Response.json({ ok: true }, { status: 202 });
}

// Only http(s) links are rendered on /quotes/[id]; "javascript:" and friends are rejected.
function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function reply(status: number, event: string, correlationId: string) {
  log(status, event, correlationId);
  return new Response(null, { status }); // no internal details in error responses
}

function log(status: number, event: string, correlationId: string, raw?: string) {
  const size = raw === undefined ? undefined : Buffer.byteLength(raw);
  const sha256 = raw === undefined ? undefined : createHash("sha256").update(raw).digest("hex");
  console.info("n8n.in", { event, correlationId, status, size, sha256 });
}
