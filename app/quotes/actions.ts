"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";
import { insertQuote, markQuoteTriggered } from "@/lib/quotes";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

// server-auth-actions: a public form, like submitLead — no session by design, so everything the
// action trusts is validated here. The workflow runs 40–90 s: the user never waits for n8n.
// The quote is stored as `queued`, the user goes to its status page, and n8n is called in after().
export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const quote = await insertQuote(parsed.data);

  after(async () => {
    let ok = false;
    try {
      const result = await triggerWorkflow({
        event: "quote-request",
        // The minimum the workflow needs to build the PDF; the email stays in our store.
        data: {
          quoteId: quote.id,
          company: quote.company,
          description: quote.description,
          budget: quote.budget,
        },
        idempotencyKey: quote.idempotencyKey,
        correlationId: quote.correlationId,
        callbackPath: "/api/n8n/quote-request",
      });
      ok = result.ok;
    } catch {
      console.error(`n8n out event=quote-request correlation=${quote.correlationId} error=config`);
    }
    await markQuoteTriggered(quote.id, ok);
  });

  redirect(`/quotes/${quote.id}`);
}
