"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireLeadAccess } from "@/lib/data";
import { parseLeadForm, type LeadFormField, type LeadFormValues } from "@/lib/lead-form";
import { triggerWorkflow } from "@/lib/n8n/client";
import {
  parseLeadNoteForm,
  type LeadNoteFormField,
  type LeadNoteFormValues,
} from "@/lib/lead-note-form";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";

export type SubmitLeadState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<LeadFormField, string>>; values: LeadFormValues }
  | { status: "ok" };

export async function submitLead(
  _prevState: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  const parsed = parseLeadForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const userAgent = requestHeaders.get("user-agent") ?? "";
  // Both keys are created ONCE and stored with the lead: every retry reuses them.
  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();

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
    idempotencyKey,
    correlationId,
  });

  // A "for information" event: n8n answers at once (Respond: Immediately) and nobody waits for it,
  // not even the form (server-after-nonblocking). Only what the workflow needs: no IP, user agent
  // or raw form data.
  after(async () => {
    try {
      await triggerWorkflow(
        "lead-created",
        {
          leadId: lead.id,
          name: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          budget: lead.budget,
          message: lead.message,
        },
        { idempotencyKey, correlationId },
      );
    } catch (error) {
      console.error("lead.trigger_failed", { leadId: lead.id, error: error instanceof Error ? error.name : "unknown" });
    }
  });

  await logAudit("lead.created", lead.id);

  return { status: "ok" };
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await requireLeadAccess(id);

  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export type LeadNoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<LeadNoteFormField, string>>; values: LeadNoteFormValues }
  | { status: "error"; message: string; values: LeadNoteFormValues }
  | { status: "ok" };

export async function submitLeadNote(
  leadId: string,
  _prevState: LeadNoteState,
  formData: FormData,
): Promise<LeadNoteState> {
  await requireLeadAccess(leadId);

  const parsed = parseLeadNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  let saved = false;
  try {
    saved = await db.appendLeadNote(leadId, parsed.data.note);
  } catch (error) {
    console.error("lead.note_failed", { leadId, error: error instanceof Error ? error.name : "unknown" });
  }
  if (!saved) {
    return {
      status: "error",
      message: "Не вдалося зберегти нотатку. Спробуйте ще раз.",
      values: { note: parsed.data.note },
    };
  }

  revalidatePath(`/dashboard/leads/${leadId}`);

  after(async () => {
    try {
      await logAudit("lead.note_added", leadId);
    } catch (error) {
      console.error("lead.note_audit_failed", { leadId, error: error instanceof Error ? error.name : "unknown" });
    }
  });

  return { status: "ok" };
}

export async function deleteLead(id: string) {
  await requireLeadAccess(id);

  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
