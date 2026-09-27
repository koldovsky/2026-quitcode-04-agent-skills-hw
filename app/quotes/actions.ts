"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { callN8nWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField } from "@/lib/quote-form";

export type SubmitQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>> };

export async function submitQuoteRequest(
  _prevState: SubmitQuoteState,
  formData: FormData,
): Promise<SubmitQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }

  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();

  const quote = await db.insertQuote({
    ...parsed.data,
    idempotencyKey,
    correlationId,
  });

  after(async () => {
    try {
      await callN8nWorkflow({
        event: "quote-request",
        idempotencyKey,
        correlationId,
        callbackUrl: `${process.env.APP_BASE_URL}/api/n8n/quote-request`,
        data: {
          quoteId: quote.id,
          company: quote.company,
          email: quote.email,
          description: quote.description,
          budget: quote.budget,
        },
      });
    } catch (error) {
      console.error(`Failed to start quote-request workflow for ${quote.id}`, error);
      await db.updateQuoteResult(quote.id, { status: "failed", errorCode: "n8n_dispatch_failed" });
    }
  });

  redirect(`/quotes/${quote.id}`);
}
