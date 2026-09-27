"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { parseNoteForm, type NoteField } from "@/lib/note-form";
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

export async function updateLeadStatus(id: string, status: LeadStatus) {
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export type NoteFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<NoteField, string>>;
      values: Partial<Record<NoteField, string>>;
    }
  | { status: "unauthorized" | "forbidden" | "error"; message: string }
  | { status: "ok"; message: string };

export async function addLeadNote(
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const user = await getSessionUser();
  if (!user) {
    return { status: "unauthorized", message: "Сесія завершилась. Увійдіть знову." };
  }

  // leadId comes from a hidden field, so it is checked against the user's workspace like any input.
  const leadId = formData.get("leadId");
  const [workspace, lead] = await Promise.all([
    db.getWorkspace(user.workspaceSlug),
    typeof leadId === "string" ? db.getLead(leadId) : null,
  ]);
  if (!workspace || !lead || lead.workspaceId !== workspace.id) {
    return { status: "forbidden", message: "Немає доступу до цього ліда." };
  }

  const parsed = parseNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const saved = await db.appendLeadNote(lead.id, parsed.data.text);
  if (!saved) {
    console.error("lead.note_add failed", { leadId: lead.id, code: "not_found" });
    return { status: "error", message: "Не вдалося зберегти нотатку. Спробуйте ще раз." };
  }

  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok", message: "Нотатку додано." };
}

export async function deleteLead(id: string) {
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
