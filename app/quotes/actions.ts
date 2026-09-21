"use server";

import { after } from "next/server";
import { parseQuoteForm, type QuoteFormState } from "@/lib/quote-form";
import { createQuoteRequest, startQuoteWorkflow } from "@/lib/quotes";

// Public form (skills building-client-form + integrating-n8n-webhooks): no session to check,
// so the action validates everything itself, saves the request as "queued", returns only
// { status, id } and starts the 40-90 s n8n workflow in after(): the visitor never waits.
export async function requestQuote(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    console.info(`quote request invalid: ${Object.keys(parsed.errors).join(",")}`);
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  let id: string;
  try {
    ({ id } = await createQuoteRequest(parsed.data));
  } catch (error) {
    console.error(`quote request not saved: ${error instanceof Error ? error.name : "error"}`);
    return { status: "error", message: "Не вдалося зберегти запит. Спробуйте ще раз за хвилину.", values: parsed.values };
  }

  after(() => startQuoteWorkflow(id));
  console.info(`quote request ${id} queued`);
  return { status: "ok", id };
}
