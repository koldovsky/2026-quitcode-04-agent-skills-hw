export const NOTE_MAX_LENGTH = 500;

export type NoteFormField = "note";

export type NoteFormData = {
  note: string;
};

export type ParseNoteResult =
  | { ok: true; data: NoteFormData }
  | {
      ok: false;
      errors: Partial<Record<NoteFormField, string>>;
      values: Partial<Record<NoteFormField, string>>;
    };

export function parseNoteForm(formData: FormData): ParseNoteResult {
  const raw = formData.get("note");
  const note = typeof raw === "string" ? raw.trim().slice(0, NOTE_MAX_LENGTH) : "";

  const errors: Partial<Record<NoteFormField, string>> = {};
  if (!note) errors.note = "Введіть текст нотатки";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values: { note } };
  }

  return { ok: true, data: { note } };
}
