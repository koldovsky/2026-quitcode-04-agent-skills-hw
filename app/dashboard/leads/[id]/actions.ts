"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseNoteForm, type NoteFormField } from "@/lib/note-form";
import { SESSION_COOKIE } from "@/lib/session";

export type AddNoteState =
  | { status: "idle" }
  | { status: "unauthorized"; values: Partial<Record<NoteFormField, string>> }
  | {
      status: "invalid";
      errors: Partial<Record<NoteFormField, string>>;
      values: Partial<Record<NoteFormField, string>>;
    }
  | { status: "not_found"; values: Partial<Record<NoteFormField, string>> }
  | { status: "error"; values: Partial<Record<NoteFormField, string>> }
  | { status: "ok" };

export async function addNote(_prevState: AddNoteState, formData: FormData): Promise<AddNoteState> {
  // Echoed back on every failure so the typed note is not lost (React 19 resets the form after the action).
  const typed = formData.get("text");
  const values = { text: typeof typed === "string" ? typed.slice(0, 2000) : "" };
  try {
    // Server Actions are public POST endpoints: proxy.ts and the layout do not protect them.
    const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = sessionId ? await db.getUserBySession(sessionId) : null;
    if (!user) return { status: "unauthorized", values };

    const parsed = parseNoteForm(formData);
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

    const [workspace, lead] = await Promise.all([
      db.getWorkspace(user.workspaceSlug),
      parsed.data.leadId ? db.getLead(parsed.data.leadId) : null,
    ]);
    if (!workspace || !lead || lead.workspaceId !== workspace.id) return { status: "not_found", values };

    if (!(await db.appendLeadNote(lead.id, parsed.data.text))) return { status: "not_found", values };

    after(() => logAudit("lead.note_added", lead.id));
    console.info("lead.note_added", { leadId: lead.id });

    revalidatePath(`/dashboard/leads/${lead.id}`);
    return { status: "ok" };
  } catch {
    console.error("lead.note_add_failed");
    return { status: "error", values };
  }
}
