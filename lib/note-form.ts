export const NOTE_MAX_LENGTH = 500;

export type NoteFormField = "text";

export type NoteFormData = {
  leadId: string;
  text: string;
};

export type NoteParseResult =
  | { ok: true; data: NoteFormData }
  | {
      ok: false;
      errors: Partial<Record<NoteFormField, string>>;
      values: Partial<Record<NoteFormField, string>>;
    };

export function parseNoteForm(formData: FormData): NoteParseResult {
  const rawLeadId = formData.get("leadId");
  const rawText = formData.get("text");
  const leadId = typeof rawLeadId === "string" ? rawLeadId.trim().slice(0, 64) : "";
  // Over-long notes are reported, not silently cut; the hard cap only bounds what we echo back.
  const text = typeof rawText === "string" ? rawText.trim().slice(0, NOTE_MAX_LENGTH * 4) : "";

  const errors: Partial<Record<NoteFormField, string>> = {};
  if (!text) errors.text = "Напишіть текст нотатки";
  else if (text.length > NOTE_MAX_LENGTH) {
    errors.text = `Не більше ${NOTE_MAX_LENGTH} символів (зараз ${text.length})`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values: { text } }
    : { ok: true, data: { leadId, text } };
}
