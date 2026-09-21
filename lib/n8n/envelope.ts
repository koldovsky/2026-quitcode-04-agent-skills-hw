import "server-only";

// Reading and parsing n8n callbacks. Parsing happens only after verifyN8nSignature().

export type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  correlationId: string | null;
  requestIdempotencyKey: string; // idempotency-key of the request that started the job
  documentUrl: string | null; // https only; set when status is "completed"
  errorCode: string | null; // set when status is "failed"
  completedAt: string | null;
};

export type CallbackOutcome = { status: "applied"; afterResponse?: () => Promise<void> } | { status: "unknown-job" };

export type CallbackHandler = (data: CallbackData) => Promise<CallbackOutcome>;

// Reads the body as raw bytes and stops as soon as it grows past `limit` (null = too large).
export async function readBodyLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
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
  return Buffer.concat(chunks);
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 200) => (typeof value === "string" && value.length > 0 && value.length <= max ? value : null);

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null; // never javascript:, data: or http:
  } catch {
    return null;
  }
}

export function parseCallbackEnvelope(rawBody: Uint8Array, expectedEvent: string): { data: CallbackData } | null {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== 1 || value.event !== expectedEvent || !isObject(value.data)) return null;

  const d = value.data;
  const jobId = text(d.jobId);
  const requestIdempotencyKey = text(d.requestIdempotencyKey);
  const status = d.status;
  if (!jobId || !requestIdempotencyKey || (status !== "completed" && status !== "failed")) return null;

  const documentUrl = status === "completed" ? httpsUrl(isObject(d.result) ? d.result.documentUrl : null) : null;
  if (status === "completed" && !documentUrl) return null;

  return {
    data: {
      jobId,
      status,
      correlationId: text(d.correlationId),
      requestIdempotencyKey,
      documentUrl,
      errorCode: status === "failed" ? (text(isObject(d.error) ? d.error.code : null, 64) ?? "unknown") : null,
      completedAt: text(d.completedAt, 40),
    },
  };
}
