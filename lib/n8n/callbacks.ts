import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type CallbackEnvelope = {
  version: 1;
  event: string; // "<path>.completed" | "<path>.failed"
  data: {
    jobId: string;
    status: "completed" | "failed";
    correlationId?: string;
    requestIdempotencyKey?: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
    completedAt?: string;
  };
};

type Handler = (callback: CallbackEnvelope) => Promise<void>;

// The link is rendered as <a href>, so only http(s) is accepted (no javascript: or data:).
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// One entry per n8n event that calls us back. The handler stores the minimal state BEFORE we answer.
const handlers: Record<string, Handler> = {
  "quote-request": async ({ data }) => {
    if (!data.requestIdempotencyKey) throw new Error("quote callback without requestIdempotencyKey");
    const documentUrl = data.result?.documentUrl;
    const ready = data.status === "completed" && isHttpUrl(documentUrl);
    const result = await db.updateQuoteByIdempotencyKey(
      data.requestIdempotencyKey,
      // The callback may arrive before after() stored "processing"; a final state never changes.
      ["queued", "processing"],
      ready
        ? { status: "ready", jobId: data.jobId, documentUrl, errorCode: null }
        : {
            status: "failed",
            jobId: data.jobId,
            errorCode: data.status === "completed" ? "invalid_document_url" : (data.error?.code ?? "unknown"),
          },
    );
    // The quote is stored before n8n is called, so an unknown key will never match: a retry cannot
    // help (e.g. the in-memory DB was reset). Accept it and log only ids. A thrown error (DB failure)
    // makes the route free the key and answer 500, so Retry On Fail in n8n delivers it again.
    if (!result.found) {
      console.warn(`n8n in event=quote-request job=${data.jobId} correlation=${data.correlationId ?? "-"} quote=unknown`);
      return;
    }
    revalidatePath(`/quotes/${result.id}`);
  },
};

export const isKnownEvent = (event: string) => Object.hasOwn(handlers, event);

export function parseCallback(value: unknown, pathEvent: string): CallbackEnvelope | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<CallbackEnvelope>;
  const d = v.data as Partial<CallbackEnvelope["data"]> | undefined;
  if (v.version !== 1 || typeof v.event !== "string") return null;
  if (v.event !== `${pathEvent}.completed` && v.event !== `${pathEvent}.failed`) return null;
  if (!d || typeof d.jobId !== "string" || (d.status !== "completed" && d.status !== "failed")) return null;
  return v as CallbackEnvelope;
}

export async function handleCallback(pathEvent: string, callback: CallbackEnvelope): Promise<void> {
  await handlers[pathEvent](callback);
}
