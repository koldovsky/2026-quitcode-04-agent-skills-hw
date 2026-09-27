"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  // Public form like the lead form: no session on purpose, validation happens here.
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const quote = await db.insertQuote({
    ...parsed.data,
    id: randomUUID(),
    status: "queued",
    requestKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // The workflow takes 40-90 s: the user never waits for n8n (server-after-nonblocking).
  after(async () => {
    let ok = false;
    try {
      const result = await triggerWorkflow(
        "quote-request",
        // Only what the estimate is built from; the email stays with us.
        { quoteId: quote.id, company: quote.company, description: quote.description, budget: quote.budget },
        { idempotencyKey: quote.requestKey, correlationId: quote.correlationId, callback: true },
      );
      ok = result.ok;
    } catch (error) {
      // N8nConfigError for a missing or wrong setting; the name only, the message may echo configuration
      const reason = error instanceof Error ? error.name : "error";
      console.error(JSON.stringify({ n8n: "out", event: "quote-request", correlationId: quote.correlationId, status: reason }));
    }
    // Only if still queued, checked in the same write: with a fast workflow the callback may already have
    // set "ready", also between a separate read and this write.
    await db.updateQuote(quote.id, { status: ok ? "sent" : "failed" }, "queued");
  });

  redirect(`/quotes/${quote.id}`); // works without JavaScript; after() still runs
}
