import { db } from "@/lib/db";
import { CALLBACK_MAX_BYTES, readBodyLimited, verifyCallback } from "@/lib/n8n/callback";
import { claimKey, releaseKey } from "@/lib/n8n/idempotency";

// Callbacks from n8n. Public endpoint: only the HMAC signature is trusted.
// No `export const runtime = "edge"`: we need node:crypto.

type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  requestIdempotencyKey?: string;
  result?: { documentUrl?: unknown };
  error?: { code?: unknown };
};

// Path segment = the trigger event. Each handler saves the minimal state; false = unknown job / bad data.
const HANDLERS: Record<string, (data: CallbackData) => Promise<boolean>> = {
  "quote-request": async (data) => {
    const documentUrl = data.status === "completed" ? safeDocumentUrl(data.result?.documentUrl) : null;
    if (data.status === "completed" && !documentUrl) return false;
    const errorCode = typeof data.error?.code === "string" ? data.error.code.slice(0, 64) : null;
    return db.completeQuote({
      jobId: data.jobId,
      requestIdempotencyKey: typeof data.requestIdempotencyKey === "string" ? data.requestIdempotencyKey : null,
      status: data.status,
      documentUrl,
      errorCode,
    });
  },
};

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  const handle = Object.hasOwn(HANDLERS, event) ? HANDLERS[event] : undefined;
  if (!handle) return Response.json({ error: "not_found" }, { status: 404 });
  const mediaType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  // Refuse an oversized body before reading it; readBodyLimited also stops at 64 KB without content-length.
  if (Number(req.headers.get("content-length") ?? 0) > CALLBACK_MAX_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  const raw = await readBodyLimited(req); // the exact signed bytes; never req.json() here
  if (raw === null) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const check = verifyCallback(raw, req.headers.get("x-n8n-timestamp"), req.headers.get("x-n8n-signature"));
  if (!check.ok) return Response.json({ error: "rejected" }, { status: check.status });

  const key = req.headers.get("idempotency-key");
  if (!key) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!claimKey(key)) return Response.json({ duplicate: true }, { status: 200 });

  const data = parseCallback(raw, event, key);
  if (!data) {
    releaseKey(key);
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    if (!(await handle(data))) {
      releaseKey(key);
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
  } catch {
    releaseKey(key); // let n8n's Retry On Fail try again
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const correlationId = req.headers.get("x-correlation-id") ?? "-";
  console.info(`[n8n] callback ${event} ${data.status} accepted (correlation ${correlationId})`);
  return Response.json({ ok: true }, { status: 202 });
}

/** Step 7: parse only after the signature; the key must match the signed body. */
function parseCallback(raw: string, event: string, key: string): CallbackData | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const body = json as { version?: unknown; event?: unknown; data?: Record<string, unknown> };
  const data = body.data;
  if (body.version !== 1 || body.event !== `${event}.completed`) return null;
  if (!data || typeof data.jobId !== "string" || data.jobId === "") return null;
  if (data.status !== "completed" && data.status !== "failed") return null;
  if (key !== `${data.jobId}:${body.event}`) return null;
  return data as unknown as CallbackData;
}

// The link is rendered as <a href> on a public page: only https, no credentials.
function safeDocumentUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
