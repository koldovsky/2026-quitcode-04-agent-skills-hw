"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { triggerWorkflow } from "@/lib/n8n/client";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
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

  // The visitor does not wait for n8n (server-after-nonblocking). Only what the CRM workflow needs goes
  // out: no IP, user agent, raw payload or internal fields. The key is derived from the lead, so a
  // retry of the same lead is recognised by n8n as a repeat. The field list is a change for the client's
  // workflow: agree it with the workflow owner before deploying (docs/n8n-integrations.md, lead-created).
  after(async () => {
    let delivered = false;
    try {
      const result = await triggerWorkflow(
        "lead-created",
        {
          leadId: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          website: lead.website,
          message: lead.message,
          consentMarketing: lead.consentMarketing,
        },
        { idempotencyKey: `lead-created:${lead.id}`, correlationId: randomUUID() },
      );
      // triggerWorkflow logs the status of every attempt itself (event, correlation id, status, ms).
      delivered = result.ok;
    } catch (error) {
      const reason = error instanceof Error ? error.name : "error"; // never the message: it may echo config
      console.error(`Failed to send lead ${lead.id} to n8n: ${reason}`);
    }
    // Persisted marker: leads with this audit entry were not accepted by n8n and can be re-sent with
    // the same idempotency key.
    if (!delivered) await logAudit("lead.n8n_failed", lead.id);
  });

  await logAudit("lead.created", lead.id);

  return { status: "ok" };
}

// Server Actions are public POST endpoints: check the session and the lead's workspace inside
// each action, not only in proxy.ts or the page (rule server-auth-actions).
async function authorizeLead(id: unknown) {
  const user = await getCurrentUser(); // no session -> redirect("/login")
  if (typeof id !== "string") throw new Error("Lead not found");
  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), db.getLead(id)]);
  if (!lead || lead.workspaceId !== workspace.id) throw new Error("Lead not found");
  return lead.id;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Unknown status");
  await authorizeLead(id);
  await db.updateLeadStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string) {
  await authorizeLead(id);
  await db.deleteLead(id);
  revalidatePath("/dashboard");
}
