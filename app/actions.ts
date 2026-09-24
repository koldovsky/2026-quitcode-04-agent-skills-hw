"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
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

export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteFormField, string>>; values: { text: string } }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function addLeadNote(
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const user = await getCurrentUser();
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) {
    return { status: "error", message: "Лід не знайдено" };
  }

  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), getLead(leadId)]);
  if (!lead || lead.workspaceId !== workspace.id) {
    return { status: "error", message: "Лід не знайдено" };
  }

  const parsed = parseNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const saved = await db.appendLeadNote(lead.id, parsed.data.text);
  if (!saved) {
    return { status: "error", message: "Не вдалося зберегти нотатку. Спробуйте ще раз." };
  }

  revalidatePath(`/dashboard/leads/${lead.id}`);

  after(async () => {
    try {
      await logAudit("lead.note_added", lead.id);
    } catch {
      console.error(`Failed to write audit lead.note_added for lead ${lead.id}`);
    }
  });

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
