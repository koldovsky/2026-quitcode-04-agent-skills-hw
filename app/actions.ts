"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getWorkspace } from "@/lib/data";
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

  // One idempotency key per submission, stored with the lead: every attempt - our retries, a
  // re-drive from the dashboard - sends the same key, so n8n runs the workflow once.
  const idempotencyKey = randomUUID();

  const lead = await db.insertLead({
    ...parsed.data,
    n8nIdempotencyKey: idempotencyKey,
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

  // The visitor only waits for the insert. The n8n call (event "lead-created",
  // response mode Immediately) and the audit log run after the response has been sent.
  after(async () => {
    await Promise.all([
      triggerWorkflow(
        "lead-created",
        {
          // Only what the CRM workflow needs: no IP, user agent, raw form payload or notes.
          leadId: lead.id,
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          website: lead.website,
          budget: lead.budget,
          message: lead.message,
          source: lead.source,
          consentMarketing: lead.consentMarketing,
          createdAt: lead.createdAt,
        },
        { idempotencyKey: lead.n8nIdempotencyKey ?? idempotencyKey },
      ),
      logAudit("lead.created", lead.id),
    ]);
  });

  return { status: "ok" };
}

export type LeadActionResult = { status: "ok" } | { status: "invalid" } | { status: "not-found" };

// Server Actions are public POST endpoints: proxy.ts only checks that a cookie exists,
// so every mutating action verifies the session and the lead's workspace itself.
async function findOwnLead(id: unknown) {
  const user = await getCurrentUser(); // redirects to /login without a valid session
  if (typeof id !== "string" || id.length > 64) return null;
  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), db.getLead(id)]);
  return lead && lead.workspaceId === workspace.id ? lead : null;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<LeadActionResult> {
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) return { status: "invalid" };
  const lead = await findOwnLead(id);
  if (!lead) return { status: "not-found" };

  await db.updateLeadStatus(lead.id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok" };
}

export async function deleteLead(id: string): Promise<LeadActionResult> {
  const lead = await findOwnLead(id);
  if (!lead) return { status: "not-found" };

  await db.deleteLead(lead.id);
  revalidatePath("/dashboard");
  return { status: "ok" };
}
