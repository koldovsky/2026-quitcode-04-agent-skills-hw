export const LEAD_NOTE_MAX_LENGTH = 500;

export type LeadNoteFormField = "note";

export type LeadNoteFormData = {
  note: string;
};

// What the user typed, echoed back on an error so the form keeps it.
export type LeadNoteFormValues = Record<LeadNoteFormField, string>;

export type LeadNoteParseResult =
  | { ok: true; data: LeadNoteFormData }
  | { ok: false; errors: Partial<Record<LeadNoteFormField, string>>; values: LeadNoteFormValues };

export function parseLeadNoteForm(formData: FormData): LeadNoteParseResult {
  const raw = formData.get("note");
  // Browsers submit textarea line breaks as CRLF, while maxLength counts each one as one character.
  const values: LeadNoteFormValues = { note: typeof raw === "string" ? raw.replace(/\r\n?/g, "\n") : "" };
  const note = values.note.trim();

  const errors: Partial<Record<LeadNoteFormField, string>> = {};

  if (!note) {
    errors.note = "Напишіть текст нотатки";
  } else if (note.length > LEAD_NOTE_MAX_LENGTH) {
    errors.note = `Скоротіть нотатку до ${LEAD_NOTE_MAX_LENGTH} символів (зараз ${note.length})`;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors, values } : { ok: true, data: { note } };
}
