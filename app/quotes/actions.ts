"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

// Public form: no session check, the Server Action only trusts its own validation.
export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  // Save first, with the keys that every retry and the callback will reuse.
  const quote = await db.insertQuote(parsed.data);

  // The workflow runs 40–90 s: n8n answers 202 {job_id} and calls back later.
  // The user never waits for n8n.
  after(async () => {
    try {
      const result = await triggerWorkflow(
        "quote-request",
        // Email stays with us: the workflow only needs what goes into the estimate.
        { quoteId: quote.id, company: quote.company, budget: quote.budget, description: quote.description },
        { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callback: true },
      );
      await db.markQuoteDispatched(
        quote.id,
        result.ok && result.jobId ? { status: "processing", jobId: result.jobId } : { status: "failed" },
      );
    } catch (error) {
      // Configuration error (missing N8N_* / APP_BASE_URL): never leave the quote queued forever.
      console.error(`[n8n] out event=quote-request error=${error instanceof Error ? error.name : "unknown"} correlation=${quote.correlationId}`);
      await db.markQuoteDispatched(quote.id, { status: "failed" });
    }
  });

  // The status page is the answer: a server redirect works with and without JavaScript.
  // Only the id leaves the server — no DB row, no keys.
  redirect(`/quotes/${quote.id}`);
}
