export const NOTE_MAX_LENGTH = 500;

export type NoteFormField = "text";

export type NoteFormData = {
  text: string;
};

export type NoteParseResult =
  | { ok: true; data: NoteFormData }
  | { ok: false; errors: Partial<Record<NoteFormField, string>>; values: NoteFormData };

export function parseNoteForm(formData: FormData): NoteParseResult {
  const raw = formData.get("text");
  const value = typeof raw === "string" ? raw.trim() : "";
  const values: NoteFormData = { text: value.slice(0, NOTE_MAX_LENGTH * 2) };

  const errors: Partial<Record<NoteFormField, string>> = {};

  if (!value) errors.text = "Напишіть текст нотатки";
  else if (value.length > NOTE_MAX_LENGTH) {
    errors.text = `Нотатка задовга: ${value.length} із ${NOTE_MAX_LENGTH} символів`;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors, values } : { ok: true, data: { text: value } };
}
