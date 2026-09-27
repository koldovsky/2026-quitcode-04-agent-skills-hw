export const NOTE_MAX_LENGTH = 500;

export type NoteField = "text";

export type NoteFormValues = { text: string };

export type NoteParseResult =
  | { ok: true; data: NoteFormValues }
  | { ok: false; errors: Partial<Record<NoteField, string>>; values: NoteFormValues };

export function parseNoteForm(formData: FormData): NoteParseResult {
  const raw = formData.get("text");
  const text = typeof raw === "string" ? raw.trim() : "";

  const errors: Partial<Record<NoteField, string>> = {};
  if (!text) errors.text = "Напишіть текст нотатки";
  else if (text.length > NOTE_MAX_LENGTH) {
    errors.text = `Нотатка задовга: ${text.length} із ${NOTE_MAX_LENGTH} символів`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values: { text: text.slice(0, NOTE_MAX_LENGTH * 2) } }
    : { ok: true, data: { text } };
}
