import "server-only";
import { db } from "./db";
import type { CallbackData, CallbackOutcome } from "./n8n/envelope";
import { n8nCallbackUrl, triggerWorkflow } from "./n8n/client";
import type { NewQuote, QuoteStatus } from "./types";

// «Запит на кошторис»: n8n workflow quote-request takes 40-90 s, so it runs async
// (Respond to Webhook 202 + signed callback to /api/n8n/quote-request).

export const QUOTE_EVENT = "quote-request";

export async function createQuoteRequest(input: NewQuote) {
  return db.insertQuote(input); // status "queued"; id = random UUID
}

// Runs in after(): the visitor never waits for n8n.
export async function startQuoteWorkflow(id: string) {
  const quote = await db.getQuote(id);
  if (!quote || quote.status !== "queued") return;

  const callbackUrl = n8nCallbackUrl(QUOTE_EVENT);
  const result = callbackUrl
    ? await triggerWorkflow(
        QUOTE_EVENT,
        {
          quoteId: quote.id,
          company: quote.company,
          email: quote.email,
          description: quote.description,
          budget: quote.budget,
        },
        // The quote id is a UUID created once per request and stored with it:
        // it is the idempotency-key, and the callback returns it as requestIdempotencyKey.
        { idempotencyKey: quote.id, correlationId: quote.correlationId, callbackUrl },
      )
    : ({ ok: false, status: null, reason: "not-configured" } as const);

  if (result.ok) await db.markQuoteProcessing(quote.id, result.jobId);
  else await db.failQuote(quote.id, `n8n-${result.reason}`);
}

// Called by app/api/n8n/[event]/route.ts after the signature and the idempotency-key check.
export async function handleQuoteCallback(data: CallbackData): Promise<CallbackOutcome> {
  const quote = await db.getQuote(data.requestIdempotencyKey);
  if (!quote) return { status: "unknown-job" };
  // The request belongs to the job n8n started for it (job_id from the 202). A callback from any
  // other job - a second run, a stale one - must not touch it. jobId is still null only when a
  // fast workflow calls back before the 202 was recorded.
  if (quote.jobId && quote.jobId !== data.jobId) return { status: "other-job" };
  // A ready quote is final: the document link the client already saw is never replaced.
  if (quote.status === "ready") return { status: "already-final" };

  const applied =
    data.status === "completed" && data.documentUrl
      ? await db.completeQuote(quote.id, { jobId: data.jobId, documentUrl: data.documentUrl })
      : await db.failQuote(quote.id, data.errorCode ?? "workflow-failed", data.jobId);
  if (!applied) return { status: "already-final" }; // another callback made it ready in between

  return {
    status: "applied",
    // Slow side effects (e-mail to the client, CRM note) belong here, after the 2xx.
    afterResponse: async () => {
      console.info(`quote ${quote.id} ${data.status}: customer notification queued (demo: no e-mail is sent)`);
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublicQuoteStatus = {
  id: string;
  company: string;
  status: QuoteStatus;
  documentUrl: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

// The status page is public (unguessable UUID link): no e-mail, no task description.
export async function getQuoteStatus(id: string): Promise<PublicQuoteStatus | null> {
  if (!UUID_RE.test(id)) return null;
  const quote = await db.getQuote(id);
  if (!quote) return null;
  const { company, status, documentUrl, failureCode, createdAt, updatedAt } = quote;
  return { id: quote.id, company, status, documentUrl, failureCode, createdAt, updatedAt };
}
