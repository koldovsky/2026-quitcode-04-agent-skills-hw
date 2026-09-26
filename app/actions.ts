"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { triggerN8nWebhook } from "@/lib/n8n/client";
import { SESSION_COOKIE } from "@/lib/session";
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

  // Notification-only event: the visitor does not wait for n8n. Only the minimum
  // leaves LeadDesk — no contacts, IP, user agent or raw form payload.
  const idempotencyKey = crypto.randomUUID();
  after(() =>
    triggerN8nWebhook({
      event: "lead-created",
      data: { leadId: lead.id, company: lead.company, source: lead.source, budget: lead.budget },
      idempotencyKey,
      correlationId: crypto.randomUUID(),
    }),
  );

  await logAudit("lead.created", lead.id);

  return { status: "ok" };
}

// Server Actions are public POST endpoints: proxy.ts only checks that a cookie exists,
// so every dashboard action verifies the session and the lead's workspace itself.
async function assertLeadAccess(id: string) {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = sessionId ? await db.getUserBySession(sessionId) : null;
  if (!user) throw new Error("Unauthorized");

  const [workspace, lead] = await Promise.all([db.getWorkspace(user.workspaceSlug), db.getLead(id)]);
  if (!workspace || !lead || lead.workspaceId !== workspace.id) throw new Error("Lead not found");
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await assertLeadAccess(id);
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string) {
  await assertLeadAccess(id);
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
