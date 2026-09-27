"use client";

import { useActionState } from "react";
import { addLeadNote, type NoteFormState } from "@/app/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-form";

const initialState: NoteFormState = { status: "idle" };

export function LeadNoteForm({ leadId }: { leadId: string }) {
  // leadId goes in a hidden field (the team pattern; forms.md allows it as well as bind()): with
  // useActionState(addLeadNote.bind(null, leadId)) the no-JS POST in LeadDesk saved the note but returned no page.
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  // Every error state carries what the user typed; only "ok" lets the form reset.
  const values = "values" in state ? state.values : {};
  const failure =
    state.status === "unauthorized" || state.status === "forbidden" || state.status === "error"
      ? state.message
      : null;

  return (
    <form action={formAction} className="space-y-2 border-t border-amber-200 pt-4" noValidate>
      <input type="hidden" name="leadId" value={leadId} />
      {state.status === "invalid" && (
        <p role="alert" className="text-red-700">
          Нотатку не збережено: виправте поле нижче.
        </p>
      )}
      {failure && (
        <p role="alert" className="text-red-700">
          {failure}
        </p>
      )}

      <label htmlFor="note-text" className="block font-medium">
        Додати нотатку
      </label>
      <textarea
        id="note-text"
        name="text"
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        defaultValue={values.text ?? ""}
        aria-invalid={errors.text ? true : undefined}
        aria-describedby={errors.text ? "note-text-hint note-text-error" : "note-text-hint"}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500"
      />
      <p id="note-text-hint" className="text-xs text-slate-500">
        До {NOTE_MAX_LENGTH} символів. Нотатку бачить лише команда.
      </p>
      {errors.text && (
        <p id="note-text-error" className="text-xs text-red-600">
          {errors.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Зберегти нотатку"}
        </button>
        <p role="status" className="text-emerald-700">
          {state.status === "ok" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}
