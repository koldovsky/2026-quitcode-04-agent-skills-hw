"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { triggerWorkflow } from "@/lib/n8n/client";
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

  // Fire-and-forget event (n8n: Respond Immediately). The user does not wait for n8n or the audit.
  const idempotencyKey = randomUUID(); // one per business operation; store it with the record in a real DB
  after(async () => {
    await triggerWorkflow(
      "lead-created",
      { leadId: lead.id, company: lead.company, budget: lead.budget, source: lead.source },
      { idempotencyKey },
    );
    await logAudit("lead.created", lead.id);
  });

  return { status: "ok" };
}

// Server Actions are public endpoints: check the session and that the lead
// belongs to the user's workspace inside every action.
async function requireLeadInUserWorkspace(id: unknown) {
  const user = await getCurrentUser();
  if (typeof id !== "string") throw new Error("Lead not found");
  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), getLead(id)]);
  if (!lead || lead.workspaceId !== workspace.id) throw new Error("Lead not found");
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await requireLeadInUserWorkspace(id);
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string) {
  await requireLeadInUserWorkspace(id);
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
