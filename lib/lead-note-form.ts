export const LEAD_NOTE_MAX_LENGTH = 500;

export type LeadNoteFormField = "note";

export type LeadNoteFormData = {
  note: string;
};

export type LeadNoteParseResult =
  | { ok: true; data: LeadNoteFormData }
  | { ok: false; errors: Partial<Record<LeadNoteFormField, string>>; values: LeadNoteFormData };

export function parseLeadNoteForm(formData: FormData): LeadNoteParseResult {
  const raw = formData.get("note");
  const note = typeof raw === "string" ? raw.trim() : "";

  const errors: Partial<Record<LeadNoteFormField, string>> = {};

  if (!note) errors.note = "Напишіть текст нотатки";
  else if (note.length > LEAD_NOTE_MAX_LENGTH) {
    errors.note = `Нотатка задовга: ${note.length} з ${LEAD_NOTE_MAX_LENGTH} символів`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values: { note } }
    : { ok: true, data: { note } };
}
