"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerN8nWebhook } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues }
  | { status: "queued"; id: string };

// Public form: the action is a public POST endpoint, so all validation happens here.
// The quote-request workflow runs 40–90 s, so the user does not wait for it:
// the quote is saved as "queued", n8n is called in after(), the result arrives via
// the callback route (app/api/n8n/[event]/route.ts).
export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const quote = await db.insertQuote(parsed.data);

  after(async () => {
    const result = await triggerN8nWebhook({
      event: "quote-request",
      // The PDF needs no contact data: the email stays in LeadDesk.
      data: {
        quoteId: quote.id,
        company: quote.company,
        description: quote.description,
        budget: quote.budget,
      },
      idempotencyKey: quote.idempotencyKey,
      correlationId: quote.correlationId,
      callback: true,
    });
    await db.updateQuote(
      quote.id,
      result.ok ? { status: "processing" } : { status: "failed", errorCode: "trigger_failed" },
      "queued",
    );
  });

  return { status: "queued", id: quote.id };
}
