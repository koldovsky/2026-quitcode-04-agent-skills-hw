"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { callN8nWorkflow } from "@/lib/n8n/client";
import { randomUUID } from "node:crypto";
import { parseLeadForm, parseLeadNoteForm, type LeadFormField } from "@/lib/lead-form";
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

  after(async () => {
    try {
      await callN8nWorkflow({
        event: "lead-created",
        data: { leadId: lead.id, company: lead.company, source: lead.source },
        idempotencyKey: randomUUID(),
        correlationId: randomUUID(),
      });
    } catch (error) {
      console.error(`Failed to send lead ${lead.id} to n8n`, error);
    }
    await logAudit("lead.created", lead.id);
  });

  return { status: "ok" };
}

export type LeadMutationState = { status: "ok" } | { status: "not_found" } | { status: "forbidden" };

async function assertLeadInUserWorkspace(id: string) {
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);
  const lead = await getLead(id);

  if (!lead) return { ok: false as const, state: { status: "not_found" as const } };
  if (lead.workspaceId !== workspace.id) {
    return { ok: false as const, state: { status: "forbidden" as const } };
  }
  return { ok: true as const };
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<LeadMutationState> {
  const check = await assertLeadInUserWorkspace(id);
  if (!check.ok) return check.state;

  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
  return { status: "ok" };
}

export async function deleteLead(id: string): Promise<LeadMutationState> {
  const check = await assertLeadInUserWorkspace(id);
  if (!check.ok) return check.state;

  await db.deleteLead(id);
  revalidatePath("/dashboard");
  return { status: "ok" };
}

export type AddLeadNoteState =
  | { status: "idle" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid"; error: string; value: string }
  | { status: "ok" };

export async function addLeadNote(
  id: string,
  _prevState: AddLeadNoteState,
  formData: FormData,
): Promise<AddLeadNoteState> {
  const check = await assertLeadInUserWorkspace(id);
  if (!check.ok) return check.state;

  const parsed = parseLeadNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", error: parsed.error, value: parsed.value };
  }

  await db.appendLeadNote(id, parsed.note);
  revalidatePath(`/dashboard/leads/${id}`);

  after(async () => {
    await logAudit("lead.note_added", id);
  });

  return { status: "ok" };
}
