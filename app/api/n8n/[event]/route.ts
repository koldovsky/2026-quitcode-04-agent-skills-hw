import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Callback from n8n once a workflow finishes. Public endpoint — n8n has no
// session, so the signature is the only thing we trust. Order of checks
// matters: see .claude/skills/integrating-n8n-webhooks/references/callback.md.

const MAX_BODY_BYTES = 64 * 1024;
const MAX_SKEW_SECONDS = 300;
const KNOWN_EVENTS = new Set(["quote-request"]);

type CallbackData = {
  eventName: string;
  jobId: string;
  status: "completed" | "failed";
  correlationId: string;
  documentUrl: string | null;
  errorCode: string | null;
};

function parseCallbackBody(raw: unknown, pathEvent: string): CallbackData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (body.version !== 1) return null;

  const eventName = body.event;
  if (typeof eventName !== "string" || !eventName.startsWith(`${pathEvent}.`)) return null;

  const data = body.data;
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  const jobId = d.jobId;
  const status = d.status;
  const correlationId = d.correlationId;
  if (typeof jobId !== "string" || !jobId) return null;
  if (status !== "completed" && status !== "failed") return null;
  if (typeof correlationId !== "string" || !correlationId) return null;

  if (status === "completed") {
    const result = d.result;
    const documentUrl =
      typeof result === "object" && result !== null ? (result as Record<string, unknown>).documentUrl : undefined;
    if (typeof documentUrl !== "string" || !documentUrl) return null;
    return { eventName, jobId, status, correlationId, documentUrl, errorCode: null };
  }

  const error = d.error;
  const errorCode = typeof error === "object" && error !== null ? (error as Record<string, unknown>).code : undefined;
  if (typeof errorCode !== "string" || !errorCode) return null;
  return { eventName, jobId, status, correlationId, documentUrl: null, errorCode };
}

export async function POST(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  if (!KNOWN_EVENTS.has(event)) {
    return new Response(null, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return new Response(null, { status: 415 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const timestampHeader = request.headers.get("x-n8n-timestamp") ?? "";
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > MAX_SKEW_SECONDS) {
    return new Response(null, { status: 401 });
  }

  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) {
    console.error(`n8n:${event} callback misconfigured (no secret)`);
    return new Response(null, { status: 401 });
  }

  const expectedHex = createHmac("sha256", secret).update(`${timestampHeader}.${raw}`).digest("hex");
  const signatureHeader = request.headers.get("x-n8n-signature") ?? "";
  const providedHex = signatureHeader.startsWith("sha256=") ? signatureHeader.slice("sha256=".length) : "";

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const providedBuf = Buffer.from(providedHex, "hex");
  const signatureValid = providedBuf.length === expectedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  if (!signatureValid) {
    return new Response(null, { status: 401 });
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!db.claimCallbackKey(idempotencyKey)) {
    return Response.json({ duplicate: true }, { status: 200 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    db.releaseCallbackKey(idempotencyKey);
    return new Response(null, { status: 400 });
  }

  const data = parseCallbackBody(parsedBody, event);
  if (!data || idempotencyKey !== `${data.jobId}:${data.eventName}`) {
    db.releaseCallbackKey(idempotencyKey);
    return new Response(null, { status: 400 });
  }

  const updated = await db.updateQuoteRequestResult(
    data.correlationId,
    data.status === "completed"
      ? { status: "completed", documentUrl: data.documentUrl! }
      : { status: "failed", errorCode: data.errorCode! },
  );

  if (!updated) {
    db.releaseCallbackKey(idempotencyKey);
    return new Response(null, { status: 400 });
  }

  console.log(`n8n:${event} callback processed`, { status: data.status });

  return Response.json({ ok: true }, { status: 202 });
}
