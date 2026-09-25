"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField } from "@/lib/quote-form";

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

  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();
  const request = await db.insertQuoteRequest({ ...parsed.data, idempotencyKey, correlationId });

  after(async () => {
    // server-after-nonblocking: користувач не чекає на воркфлоу (40–90 с)
    try {
      const result = await triggerWorkflow(
        "quote-request",
        {
          requestId: request.id,
          company: request.company,
          email: request.email,
          taskDescription: request.taskDescription,
          budget: request.budget,
        },
        { idempotencyKey, correlationId, withCallback: true },
      );
      if (!result.ok) await db.markQuoteRequestFailed(request.id);
    } catch {
      // напр. не задані змінні N8N_* — запис не має зависнути в "queued"
      console.error(`n8n quote-request not started for request ${request.id}`);
      await db.markQuoteRequestFailed(request.id);
    }
  });

  // Redirect from the action (not router.push on the client): works without JavaScript too.
  redirect(`/quotes/${request.id}`);
}
