export const NOTE_MAX_LENGTH = 500;

export type NoteField = "text";

export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteField, string>>; values: Partial<Record<NoteField, string>> }
  | { status: "ok" }
  | { status: "error"; message: string };

export type NoteParseResult =
  | { ok: true; data: { text: string } }
  | { ok: false; errors: Partial<Record<NoteField, string>>; values: Partial<Record<NoteField, string>> };

export function parseNoteForm(formData: FormData): NoteParseResult {
  const raw = formData.get("text");
  const text = typeof raw === "string" ? raw.trim() : "";

  if (!text) {
    return { ok: false, errors: { text: "Напишіть текст нотатки" }, values: { text } };
  }
  if (text.length > NOTE_MAX_LENGTH) {
    return {
      ok: false,
      errors: { text: `Нотатка задовга: ${text.length} із ${NOTE_MAX_LENGTH} символів. Скоротіть її.` },
      values: { text: text.slice(0, NOTE_MAX_LENGTH) },
    };
  }

  return { ok: true, data: { text } };
}
