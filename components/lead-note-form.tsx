"use client";

import { useActionState } from "react";
import { addLeadNote, type AddLeadNoteState } from "@/app/actions";

const initialState: AddLeadNoteState = { status: "idle" };
const MAX_NOTE_LENGTH = 500;

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  const error = state.status === "invalid" ? state.error : undefined;

  return (
    <form
      key={state.status === "ok" ? state.addedAt : "note-form"}
      action={formAction}
      className="space-y-2"
      noValidate
    >
      <input type="hidden" name="leadId" value={leadId} />

      <label className="block text-sm font-medium">
        Додати нотатку
        <textarea
          name="note"
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "lead-note-error" : undefined}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      {error && (
        <p id="lead-note-error" role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {state.status === "ok" && <p className="text-xs text-emerald-700">Нотатку додано.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Зберігаємо…" : "Додати нотатку"}
      </button>
    </form>
  );
}
