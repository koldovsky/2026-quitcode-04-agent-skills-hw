import { createHash } from "node:crypto";
import {
  claimCallbackKey,
  readBodyLimited,
  releaseCallbackKey,
  verifyCallbackSignature,
} from "@/lib/n8n/callback";
import { saveQuoteResult, type QuoteResult } from "@/lib/quotes";

// Signed callbacks from n8n workflows. A public endpoint: we trust only the HMAC signature.
// Order matters — see .claude/skills/integrating-n8n-webhooks/references/contract.md#колбек.

const KNOWN_EVENTS = new Set(["quote-request"]);

export async function POST(request: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  if (!KNOWN_EVENTS.has(event)) return Response.json({ error: "not found" }, { status: 404 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported media type" }, { status: 415 });
  }

  // Raw text first — never request.json() before the signature; the 64 KB limit applies while reading.
  const raw = await readBodyLimited(request);
  if (raw === null) return Response.json({ error: "too large" }, { status: 413 });

  const correlationId = request.headers.get("x-correlation-id") ?? "-";
  const bodyHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  const check = verifyCallbackSignature(raw, request.headers.get("x-n8n-timestamp"), request.headers.get("x-n8n-signature"));
  if (check !== "ok") {
    console.warn(`n8n in event=${event} correlation=${correlationId} rejected=${check} bytes=${raw.length} sha256=${bodyHash}`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = request.headers.get("idempotency-key");
  if (!key) return Response.json({ error: "bad request" }, { status: 400 });
  if (!(await claimCallbackKey(key))) {
    console.info(`n8n in event=${event} correlation=${correlationId} duplicate bytes=${raw.length} sha256=${bodyHash}`);
    return Response.json({ duplicate: true }, { status: 200 });
  }

  try {
    const body: unknown = JSON.parse(raw);
    const parsed = parseQuoteCallback(body, event, key);
    if (!parsed) {
      await releaseCallbackKey(key);
      console.warn(`n8n in event=${event} correlation=${correlationId} rejected=shape bytes=${raw.length} sha256=${bodyHash}`);
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    // Minimal state BEFORE the response: status and the document link.
    if (!(await saveQuoteResult(parsed))) {
      await releaseCallbackKey(key);
      console.warn(`n8n in event=${event} correlation=${correlationId} rejected=unknown-quote sha256=${bodyHash}`);
      return Response.json({ error: "not found" }, { status: 404 });
    }
  } catch {
    await releaseCallbackKey(key); // let n8n's Retry On Fail deliver it again
    console.error(`n8n in event=${event} correlation=${correlationId} error=processing sha256=${bodyHash}`);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  console.info(`n8n in event=${event} correlation=${correlationId} accepted bytes=${raw.length} sha256=${bodyHash}`);
  // Slow side effects (e-mail with the PDF, notifications) go into after() here.
  return Response.json({ ok: true }, { status: 202 });
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseQuoteCallback(body: unknown, pathEvent: string, key: string): QuoteResult | null {
  if (typeof body !== "object" || body === null) return null;
  const { version, event, data } = body as Record<string, unknown>;
  if (version !== 1) return null;
  if (event !== `${pathEvent}.completed` && event !== `${pathEvent}.failed`) return null;
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.jobId !== "string" || !d.jobId || key !== `${d.jobId}:${event}`) return null; // header is not signed
  if (typeof d.requestIdempotencyKey !== "string" || !d.requestIdempotencyKey) return null;
  // The signature proves who sent it, not that it is consistent: "<event>.failed" with
  // data.status "completed" (or the reverse) is rejected, not stored.
  if (event !== `${pathEvent}.${String(d.status)}`) return null;

  if (d.status === "completed") {
    const documentUrl = (d.result as Record<string, unknown> | undefined)?.documentUrl;
    // Rendered as a link on the status page — only http(s), never javascript: and the like.
    if (!isHttpUrl(documentUrl)) return null;
    return {
      jobId: d.jobId,
      requestIdempotencyKey: d.requestIdempotencyKey,
      status: "completed",
      documentUrl,
      errorCode: null,
    };
  }
  if (d.status === "failed") {
    const error = d.error as Record<string, unknown> | undefined;
    return {
      jobId: d.jobId,
      requestIdempotencyKey: d.requestIdempotencyKey,
      status: "failed",
      documentUrl: null,
      errorCode: typeof error?.code === "string" ? error.code.slice(0, 64) : "unknown",
    };
  }
  return null;
}
