import { db } from "./db";
import type { CallbackData } from "./n8n/callback";
import type { NewQuote, Quote } from "./types";

// Quote requests: saved by the Server Action, sent to n8n's quote-request workflow in after(), and
// completed by n8n's signed callback (app/api/n8n/[event]/route.ts). Contract: skill
// integrating-n8n-webhooks.

/** The workflow takes 40–90 s. Past this, the status page says it's taking longer than usual. */
export const QUOTE_EXPECTED_MS = 3 * 60 * 1000;

export async function createQuote(input: NewQuote): Promise<Quote> {
  return db.insertQuote(input);
}

export async function getQuote(id: string) {
  return db.getQuote(id);
}

/** queued → processing (n8n answered 202) or queued → failed (4xx / retries exhausted). */
export async function markQuoteTriggered(id: string, update: { status: "processing" | "failed"; jobId?: string | null }) {
  await db.markQuoteTriggered(id, { status: update.status, jobId: update.jobId ?? null });
}

/**
 * Saves the workflow's result before the callback route answers. The quote is found by the
 * idempotency-key the app sent (not n8n's jobId: the 202 carrying it may have been lost).
 * false = no such quote.
 */
export async function applyQuoteResult(_event: string, data: CallbackData): Promise<boolean> {
  if (data.status === "failed") {
    return db.completeQuote(data.requestIdempotencyKey, {
      status: "failed",
      jobId: data.jobId,
      documentUrl: null,
      errorCode: shortCode(data.error?.code),
    });
  }

  // The link ends up in an href on a public page: only an https URL is accepted.
  const documentUrl = httpsUrl(data.result?.documentUrl);
  return db.completeQuote(data.requestIdempotencyKey, {
    status: documentUrl ? "ready" : "failed",
    jobId: data.jobId,
    documentUrl,
    errorCode: documentUrl ? null : "invalid_document_url",
  });
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function shortCode(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9_.-]{1,64}$/i.test(value) ? value : "unknown";
}
