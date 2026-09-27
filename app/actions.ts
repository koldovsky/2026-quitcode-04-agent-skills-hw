"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { parseNoteForm, type NoteField } from "@/lib/note-form";
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

export type LeadMutationResult = { status: "ok" | "unauthorized" | "forbidden" | "invalid" };

// Server Actions are public POST endpoints: proxy.ts only checks that a session cookie exists,
// so every action that changes a lead checks the session and the lead's workspace itself.
async function authorizeLead(leadId: unknown) {
  const user = await getSessionUser();
  if (!user) return { status: "unauthorized" } as const;

  const [workspace, lead] = await Promise.all([
    db.getWorkspace(user.workspaceSlug),
    typeof leadId === "string" ? db.getLead(leadId) : null,
  ]);
  if (!workspace || !lead || lead.workspaceId !== workspace.id) return { status: "forbidden" } as const;

  return { status: "ok", lead } as const;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<LeadMutationResult> {
  const auth = await authorizeLead(id);
  if (auth.status !== "ok") return { status: auth.status };
  // Arguments come from the client as-is: the type annotation is not a runtime check.
  if (!(LEAD_STATUSES as readonly unknown[]).includes(status)) return { status: "invalid" };

  await db.updateLeadStatus(auth.lead.id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${auth.lead.id}`);
  return { status: "ok" };
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
  // leadId comes from a hidden field, so it is checked against the user's workspace like any input.
  const auth = await authorizeLead(formData.get("leadId"));
  if (auth.status === "unauthorized") {
    return { status: "unauthorized", message: "Сесія завершилась. Увійдіть знову." };
  }
  if (auth.status === "forbidden") {
    return { status: "forbidden", message: "Немає доступу до цього ліда." };
  }
  const { lead } = auth;

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

export async function deleteLead(id: string): Promise<LeadMutationResult> {
  const auth = await authorizeLead(id);
  if (auth.status !== "ok") return { status: auth.status };

  await db.deleteLead(auth.lead.id);
  revalidatePath("/dashboard");
  return { status: "ok" };
}
