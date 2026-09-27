"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { logAudit } from "@/lib/audit";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

export async function requestQuote(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  // Public form: no session, but always validate the input.
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  // Record first — with the idempotency key that every retry (and the callback) will reuse.
  const quote = await db.insertQuote({
    ...parsed.data,
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  await logAudit("quote.requested", quote.id);

  // The user never waits for the 40–90 s workflow. Trigger it after the response;
  // n8n answers 202 and later calls /api/n8n/quote-request when the PDF is ready.
  after(async () => {
    const result = await triggerWorkflow({
      event: "quote-request",
      data: {
        quoteId: quote.id,
        company: quote.company,
        budget: quote.budget,
        description: quote.description,
      },
      idempotencyKey: quote.idempotencyKey,
      correlationId: quote.correlationId,
      withCallback: true,
    });
    if (!result.ok) await db.markQuoteFailed(quote.id, result.reason); // shown on /quotes/[id]
  });

  redirect(`/quotes/${quote.id}`);
}
