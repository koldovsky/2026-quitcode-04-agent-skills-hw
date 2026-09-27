"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendN8nEvent } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField } from "@/lib/quote-form";

const EVENT = "quote-request";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>> };

export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }

  const quote = await db.insertQuoteRequest(parsed.data);
  const idempotencyKey = randomUUID();

  after(() =>
    sendN8nEvent({
      event: EVENT,
      data: {
        quoteId: quote.id,
        company: quote.company,
        email: quote.email,
        description: quote.description,
        budget: quote.budget,
      },
      callbackUrl: `${process.env.APP_BASE_URL}/api/n8n/${EVENT}`,
      idempotencyKey,
      // The quote's own id doubles as the correlation id: n8n echoes it back
      // in the callback, which is how we find the record to update.
      correlationId: quote.id,
    }),
  );

  redirect(`/quotes/${quote.id}`);
}
