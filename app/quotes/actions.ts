"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import {
  isHoneypotFilled,
  parseQuoteForm,
  readQuoteValues,
  type QuoteField,
  type QuoteFormValues,
} from "@/lib/quote-form";

// Public form, like submitLead: no session; quotes go to the same workspace as public leads.
const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";

export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteField, string>>; values: QuoteFormValues }
  | { status: "error"; message: string; values: QuoteFormValues }
  | { status: "ok"; id: string };

export async function requestQuote(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // 1. Validation inside the action: a Server Action is a public POST endpoint.
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  // 2. Anti-spam — a public form has no session (building-client-form): a filled honeypot means a
  // bot. No record, a generic answer, a log line without the form data.
  if (isHoneypotFilled(formData)) {
    console.warn("quote.rejected", { reason: "honeypot" });
    return { status: "error", message: "Не вдалося надіслати запит. Спробуйте ще раз.", values: readQuoteValues(formData) };
  }

  // 3. Save first: the record owns the idempotency key and the correlation id.
  const quote = await db.insertQuote({
    ...parsed.data,
    workspaceId: PUBLIC_FORM_WORKSPACE_ID,
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // 4. The workflow runs 40–90 s, so n8n answers 202 at once and reports back with a callback.
  // Even the 202 is awaited after the response (server-after-nonblocking); only the data the
  // workflow needs — the email stays with us.
  after(async () => {
    try {
      const result = await triggerWorkflow(
        "quote-request",
        { quoteId: quote.id, company: quote.company, description: quote.description, budget: quote.budget },
        {
          idempotencyKey: quote.idempotencyKey,
          correlationId: quote.correlationId,
          callbackPath: "/api/n8n/quote-request",
        },
      );
      // Only from "queued": a fast callback may already have set "ready" — do not overwrite it.
      await db.updateQuoteIfStatus(
        quote.id,
        "queued",
        result.ok
          ? { status: "processing", jobId: result.jobId }
          : { status: "failed", errorCode: `trigger_${result.status}` },
      );
    } catch (error) {
      // e.g. n8n is not configured: the record must not stay "queued" forever.
      console.error("quote.trigger failed", { quoteId: quote.id, code: error instanceof Error ? error.name : "unknown" });
      await db.updateQuoteIfStatus(quote.id, "queued", { status: "failed", errorCode: "trigger_error" });
    }
  });

  // 5. Only the form state — not the database row.
  return { status: "ok", id: quote.id };
}
