"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

const QUOTE_EVENT = "quote-request";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

// Public form (like the lead form): no session, so everything the client sends is validated here.
export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  // Stored as "queued" with its idempotency key and correlation id before n8n is called.
  const quote = await db.insertQuote(parsed.data);

  // The workflow runs 40–90 s: n8n answers 202 at once and reports back via /api/n8n/quote-request.
  // The user does not wait even for the 202 (retries can take a few seconds).
  after(async () => {
    const result = await triggerWorkflow(
      QUOTE_EVENT,
      {
        quoteId: quote.id,
        company: quote.company,
        description: quote.description,
        budget: quote.budget,
      },
      {
        idempotencyKey: quote.idempotencyKey,
        correlationId: quote.correlationId,
        callbackPath: `/api/n8n/${QUOTE_EVENT}`,
      },
    );
    // Only from "queued": a callback that already arrived must not be overwritten.
    await db.updateQuoteByIdempotencyKey(
      quote.idempotencyKey,
      ["queued"],
      result.ok
        ? { status: "processing", jobId: result.jobId }
        : { status: "failed", errorCode: `trigger_${result.status}` },
    );
    revalidatePath(`/quotes/${quote.id}`);
  });

  // 303 without JavaScript, client-side navigation with it; after() still runs once the response is sent.
  redirect(`/quotes/${quote.id}`);
}
