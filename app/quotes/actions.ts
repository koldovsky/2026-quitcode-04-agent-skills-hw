"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";
import { createQuote, markQuoteTriggered } from "@/lib/quotes";

export type QuoteRequestState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

// A public form, like submitLead: there is no session to check, so validation is the whole gate.
export async function submitQuoteRequest(
  _prevState: QuoteRequestState,
  formData: FormData,
): Promise<QuoteRequestState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  // Both keys are created ONCE and stored with the quote: every retry reuses them.
  const quote = await createQuote({ ...parsed.data, idempotencyKey: randomUUID(), correlationId: randomUUID() });

  // The workflow runs 40–90 s: n8n answers 202 at once and reports back via /api/n8n/quote-request.
  // Even that 202 isn't awaited here (server-after-nonblocking): save, answer, then trigger.
  after(async () => {
    try {
      const result = await triggerWorkflow(
        "quote-request",
        // What the workflow needs to build the quote. The email stays in the app.
        { quoteId: quote.id, company: quote.company, description: quote.description, budget: quote.budget },
        { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callback: true },
      );
      await markQuoteTriggered(quote.id, result.ok ? { status: "processing", jobId: result.jobId } : { status: "failed" });
    } catch (error) {
      console.error("quote.trigger_failed", { quoteId: quote.id, error: error instanceof Error ? error.name : "unknown" });
      await markQuoteTriggered(quote.id, { status: "failed" });
    }
  });

  redirect(`/quotes/${quote.id}`);
}
