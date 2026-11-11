"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { parseLeadNoteForm, type LeadNoteFormData, type LeadNoteFormField } from "@/lib/lead-note-form";

export type AddLeadNoteState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<LeadNoteFormField, string>>;
      values: LeadNoteFormData;
    }
  | { status: "error"; message: string }
  | { status: "ok" };

// Server Action is a public POST endpoint: leadId comes from the client (bound
// argument), so session and ownership are checked here, not trusted from the page.
export async function addLeadNote(
  leadId: string,
  _prevState: AddLeadNoteState,
  formData: FormData,
): Promise<AddLeadNoteState> {
  const user = await getCurrentUser();

  const [workspace, lead] = await Promise.all([
    getWorkspace({ slug: user.workspaceSlug }),
    db.getLead(leadId),
  ]);
  if (!lead || lead.workspaceId !== workspace.id) {
    return { status: "error", message: "Лід не знайдено" };
  }

  const parsed = parseLeadNoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  const saved = await db.appendLeadNote(lead.id, parsed.data.note);
  if (!saved) {
    return { status: "error", message: "Лід не знайдено" };
  }

  after(() => logAudit("lead.note_added", lead.id));

  revalidatePath(`/dashboard/leads/${lead.id}`);

  return { status: "ok" };
}
