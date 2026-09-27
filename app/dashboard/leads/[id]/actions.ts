"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { parseNoteForm, type NoteField, type NoteFormValues } from "@/lib/note-form";

export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteField, string>>; values: NoteFormValues }
  | { status: "ok" }
  | { status: "error" };

// Server Actions are public endpoints: the session and the lead's workspace
// are checked here, the lead id from bind() is not trusted.
export async function addLeadNote(
  leadId: string,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const user = await getCurrentUser();
  if (typeof leadId !== "string") return { status: "error" };

  const [workspace, lead] = await Promise.all([getWorkspace(user.workspaceSlug), getLead(leadId)]);
  if (!lead || lead.workspaceId !== workspace.id) return { status: "error" };

  const parsed = parseNoteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const saved = await db.appendLeadNote(lead.id, parsed.data.text);
  if (!saved) return { status: "error" };

  after(() => logAudit("lead.note_added", lead.id));

  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok" };
}
