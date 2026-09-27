"use client";

import { useActionState } from "react";
import { addLeadNote, type AddNoteState } from "@/app/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-form";

const initialState: AddNoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  const noteError = state.status === "invalid" ? state.errors.note : undefined;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="leadId" value={leadId} />

      {noteError && (
        <div role="alert" className="text-xs text-red-600">
          Не вдалося зберегти: перевірте поле нижче.
        </div>
      )}
      {state.status === "error" && (
        <div role="alert" className="text-xs text-red-600">
          {state.message}
        </div>
      )}
      {state.status === "ok" && (
        <p role="status" className="text-xs text-green-700">
          Нотатку додано.
        </p>
      )}

      <label htmlFor="note" className="block font-medium">
        Текст нотатки
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          required
          defaultValue={state.status === "invalid" ? state.values.note : undefined}
          aria-invalid={noteError ? "true" : undefined}
          aria-describedby={noteError ? "note-error" : undefined}
          className={inputClass}
        />
      </label>
      <p className="text-xs text-slate-500">До {NOTE_MAX_LENGTH} символів.</p>
      {noteError && (
        <p id="note-error" className="text-xs text-red-600">
          {noteError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Додаємо…" : "Додати нотатку"}
      </button>
    </form>
  );
}
