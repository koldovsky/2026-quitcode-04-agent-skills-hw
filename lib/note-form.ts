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

export function parseNoteForm(formData: FormData): NoteParseResult {
  const raw = formData.get("text");
  // Browsers send textarea line breaks as CRLF, but maxLength counts each one as a single character.
  const text = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
  const values = { text: text.slice(0, NOTE_MAX_LENGTH) };

  if (!text) {
    return { ok: false, errors: { text: "Напишіть текст нотатки" }, values };
  }
  if (text.length > NOTE_MAX_LENGTH) {
    return { ok: false, errors: { text: `Нотатка має бути не довшою за ${NOTE_MAX_LENGTH} символів` }, values };
  }

  return { ok: true, data: { text } };
}
