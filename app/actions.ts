"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { logAudit } from "@/lib/audit";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { parseNoteForm, type NoteFormState } from "@/lib/note-form";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

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

  try {
    await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (error) {
    console.error(`Failed to send lead ${lead.id} to n8n`, error);
  }

  await logAudit("lead.created", lead.id);

  return { status: "ok" };
}

// Server Actions are public POST endpoints: proxy.ts only guards page routes and
// only checks that a cookie exists, so every action verifies the session and
// that the lead belongs to the caller's workspace.
async function isOwnLead(id: string) {
  const user = await getCurrentUser();
  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), db.getLead(id)]);
  return lead !== null && lead.workspaceId === workspace.id;
}

async function requireOwnLead(id: string) {
  if (!(await isOwnLead(id))) throw new Error("Lead not found");
}

export async function addLeadNote(
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !(await isOwnLead(leadId))) {
    return { status: "error", message: "Лід не знайдено" };
  }

  const parsed = parseNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  if (!(await db.appendInternalNote(leadId, parsed.data.text))) {
    return { status: "error", message: "Лід не знайдено" };
  }

  after(() => logAudit("lead.note_added", leadId));

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { status: "ok" };
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await requireOwnLead(id);
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string) {
  await requireOwnLead(id);
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
