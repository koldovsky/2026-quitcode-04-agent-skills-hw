export const NOTE_MAX_LENGTH = 500;

export type NoteField = "text";

export type NoteFormData = {
  text: string;
};

export type NoteParseResult =
  | { ok: true; data: NoteFormData }
  | {
      ok: false;
      errors: Partial<Record<NoteField, string>>;
      values: Partial<Record<NoteField, string>>;
    };

// What the user typed, returned with any error so that the field keeps it (React 19 resets the form).
export function readNoteValues(formData: FormData): Partial<Record<NoteField, string>> {
  const raw = formData.get("text");
  // Browsers send textarea line breaks as CRLF, but maxLength counts each one as a single character.
  return { text: typeof raw === "string" ? raw.replace(/\r\n?/g, "\n") : "" };
}

export function parseNoteForm(formData: FormData): NoteParseResult {
  const values = readNoteValues(formData);
  const text = values.text?.trim() ?? "";

  if (!text) {
    return { ok: false, errors: { text: "Напишіть текст нотатки" }, values };
  }
  if (text.length > NOTE_MAX_LENGTH) {
    return { ok: false, errors: { text: `Нотатка має бути не довшою за ${NOTE_MAX_LENGTH} символів` }, values };
  }

  return { ok: true, data: { text } };
}
