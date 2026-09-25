"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { callbackUrlFor, triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormState } from "@/lib/quote-form";

const QUOTE_EVENT = "quote-request";

// Public form, like the lead form on /: no session, so the action validates everything itself.
export async function requestQuote(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const quote = await db.insertQuote({
    ...parsed.data,
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // The workflow runs 40–90 s: n8n answers 202 { job_id } at once, the PDF arrives by callback.
  // The user does not wait even for the 202 — it happens after the redirect is sent.
  after(async () => {
    const callbackUrl = callbackUrlFor(QUOTE_EVENT);
    const result = callbackUrl
      ? await triggerWorkflow(
          QUOTE_EVENT,
          // The minimum the workflow needs to build the estimate.
          {
            quoteId: quote.id,
            company: quote.company,
            email: quote.email,
            description: quote.description,
            budget: quote.budget,
          },
          { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId, callbackUrl },
        )
      : ({ ok: false, reason: "config" } as const);

    if (result.ok && result.jobId) await db.markQuoteProcessing(quote.id, result.jobId);
    else await db.markQuoteNotStarted(quote.id, result.ok ? "rejected" : result.reason);
  });

  redirect(`/quotes/${quote.id}`);
}
