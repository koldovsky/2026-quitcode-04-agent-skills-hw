"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { sendN8nEvent } from "@/lib/n8n/client";
import type { LeadStatus } from "@/lib/types";

const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";
const MAX_NOTE_LENGTH = 500;
const LEAD_CREATED_EVENT = "lead-created";

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

  after(() =>
    sendN8nEvent({
      event: LEAD_CREATED_EVENT,
      data: {
        leadId: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        message: lead.message,
      },
      idempotencyKey: randomUUID(),
      correlationId: lead.id,
    }),
  );

  after(() => logAudit("lead.created", lead.id));

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

export type AddLeadNoteState =
  | { status: "idle" }
  | { status: "invalid"; error: string }
  | { status: "ok"; addedAt: string };

export async function addLeadNote(
  _prevState: AddLeadNoteState,
  formData: FormData,
): Promise<AddLeadNoteState> {
  const leadId = String(formData.get("leadId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!note) {
    return { status: "invalid", error: "Введіть текст нотатки" };
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return { status: "invalid", error: `Нотатка занадто довга (максимум ${MAX_NOTE_LENGTH} символів)` };
  }

  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);
  const lead = await getLead(leadId);

  if (!lead || lead.workspaceId !== workspace.id) {
    return { status: "invalid", error: "Лід не знайдено" };
  }

  const saved = await db.appendLeadNote(leadId, note);
  if (!saved) {
    return { status: "invalid", error: "Не вдалося зберегти нотатку" };
  }

  revalidatePath(`/dashboard/leads/${leadId}`);

  after(() => logAudit("lead.note_added", leadId));

  return { status: "ok", addedAt: new Date().toISOString() };
}
