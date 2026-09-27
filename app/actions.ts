"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { parseNoteForm, type NoteFormField } from "@/lib/note-form";
import type { LeadStatus } from "@/lib/types";

const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";

export type SubmitLeadState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<LeadFormField, string>> }
  | { status: "ok" };

export async function submitLead(
  _prevState: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  const parsed = parseLeadForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const userAgent = requestHeaders.get("user-agent") ?? "";

  const lead = await db.insertLead({
    ...parsed.data,
    workspaceId: PUBLIC_FORM_WORKSPACE_ID,
    jobTitle: "",
    city: "",
    country: "",
    source: "website",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ipAddress,
    userAgent,
    rawPayload: {
      form: { id: "contact-main", version: "2026-07", fields: parsed.data },
      request: {
        ip: ipAddress,
        userAgent,
        acceptLanguage: requestHeaders.get("accept-language"),
        receivedAt: new Date().toISOString(),
      },
    },
  });

  // The visitor does not wait for n8n or the audit log. "lead-created" is a
  // for-your-information event (Immediately mode), so there is no callback.
  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();
  after(async () => {
    const result = await triggerWorkflow({
      event: "lead-created",
      // Minimum the workflow needs — not the row (no IP, user agent, raw payload, notes).
      data: {
        leadId: lead.id,
        company: lead.company,
        budget: lead.budget,
        source: lead.source,
        consentMarketing: lead.consentMarketing,
      },
      idempotencyKey,
      correlationId,
    });
    if (!result.ok) console.error(`n8n lead-created failed lead=${lead.id} reason=${result.reason}`);
    await logAudit("lead.created", lead.id);
  });

  return { status: "ok" };
}

export type AddNoteState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<NoteFormField, string>>;
      values: Partial<Record<NoteFormField, string>>;
    }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function addLeadNote(
  _prevState: AddNoteState,
  formData: FormData,
): Promise<AddNoteState> {
  // A Server Action is a public endpoint: authenticate and check the record
  // belongs to this user's workspace before trusting the id from the form.
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);

  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { status: "error", message: "Не вдалося зберегти нотатку" };
  }

  const lead = await getLead(leadId);
  if (!lead || lead.workspaceId !== workspace.id) {
    return { status: "error", message: "Лід не знайдено" };
  }

  const parsed = parseNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const ok = await db.appendLeadNote(leadId, parsed.data.note, user.name);
  if (!ok) {
    return { status: "error", message: "Не вдалося зберегти нотатку" };
  }

  after(() => logAudit("lead.note_added", leadId));
  revalidatePath(`/dashboard/leads/${leadId}`);

  return { status: "ok" };
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string) {
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
