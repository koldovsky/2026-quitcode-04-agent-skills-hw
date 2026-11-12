"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { triggerWorkflow } from "@/lib/n8n/client";
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

  // integrating-n8n-webhooks / server-after-nonblocking: the visitor does not wait for n8n or the
  // audit log. lead-created is an «Immediately» event (no callback); the key is created once for this
  // lead and reused by every retry. data is the minimum the lead workflow needs — no IP, user agent,
  // rawPayload or internal fields.
  const idempotencyKey = randomUUID();
  after(async () => {
    try {
      await triggerWorkflow({
        event: "lead-created",
        data: {
          leadId: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          website: lead.website,
          budget: lead.budget,
          message: lead.message,
          consentMarketing: lead.consentMarketing,
          source: lead.source,
          createdAt: lead.createdAt,
        },
        idempotencyKey,
      });
    } catch {
      console.error(`n8n out event=lead-created lead=${lead.id} error=config`);
    }
    await logAudit("lead.created", lead.id);
  });

  return { status: "ok" };
}

// server-auth-actions: a Server Action is a public POST endpoint — anyone can call it with any
// arguments, not only our UI. Check the session and that the lead belongs to the caller's
// workspace inside the action itself (proxy.ts only checks that *a* cookie exists).
async function requireOwnLead(id: unknown) {
  if (typeof id !== "string") throw new Error("Lead not found");
  const user = await getCurrentUser(); // redirects to /login without a valid session
  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), db.getLead(id)]);
  if (!lead || lead.workspaceId !== workspace.id) throw new Error("Lead not found");
  return lead;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!(LEAD_STATUSES as readonly unknown[]).includes(status)) throw new Error("Unknown status");
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
