import "server-only";
import type { CallbackData } from "@/lib/n8n/store";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Runtime validation of the signed body (step 7). Returns the typed data or null (-> 400).
export function parseCallback(raw: string, pathEvent: string, idempotencyKey: string): { event: string; data: CallbackData } | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(body) || body.version !== 1 || typeof body.event !== "string" || !isRecord(body.data)) return null;

  const suffix = body.event === `${pathEvent}.completed` ? "completed" : body.event === `${pathEvent}.failed` ? "failed" : null;
  const d = body.data;
  if (
    !suffix ||
    d.status !== suffix ||
    !isNonEmptyString(d.jobId) ||
    !isNonEmptyString(d.requestIdempotencyKey) ||
    idempotencyKey !== `${d.jobId}:${body.event}`
  ) {
    return null;
  }
  // A completed job must deliver its document; a failed one may omit result entirely.
  if (suffix === "completed" && !(isRecord(d.result) && isNonEmptyString(d.result.documentUrl))) return null;
  if (d.result !== undefined && !(isRecord(d.result) && (d.result.documentUrl === undefined || typeof d.result.documentUrl === "string"))) return null;
  if (d.error !== undefined && !(isRecord(d.error) && (d.error.code === undefined || typeof d.error.code === "string"))) return null;
  if (d.correlationId !== undefined && typeof d.correlationId !== "string") return null;
  if (d.completedAt !== undefined && typeof d.completedAt !== "string") return null;

  return {
    event: body.event,
    data: {
      jobId: d.jobId,
      status: suffix,
      requestIdempotencyKey: d.requestIdempotencyKey,
      correlationId: d.correlationId as string | undefined,
      result: d.result as CallbackData["result"],
      error: d.error as CallbackData["error"],
      completedAt: d.completedAt as string | undefined,
    },
  };
}
