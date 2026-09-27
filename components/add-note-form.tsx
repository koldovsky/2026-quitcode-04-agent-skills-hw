"use client";

import { useActionState } from "react";
import { addLeadNote, type AddLeadNoteState } from "@/app/actions";
import { NOTE_MAX_LENGTH } from "@/lib/lead-form";

const initialState: AddLeadNoteState = { status: "idle" };

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote.bind(null, leadId), initialState);
  const error = state.status === "invalid" ? state.error : undefined;
  const value = state.status === "invalid" ? state.value : "";

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
      <h2 className="font-medium">Додати нотатку</h2>

      {state.status === "not_found" || state.status === "forbidden" ? (
        <p role="alert" className="text-red-600">
          Не вдалося зберегти нотатку. Оновіть сторінку та спробуйте ще раз.
        </p>
      ) : null}

      <form action={formAction} className="space-y-2" noValidate>
        <label htmlFor="note" className="block text-sm font-medium">
          Текст нотатки
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            defaultValue={value}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "note-error" : undefined}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        {error && (
          <p id="note-error" role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {state.status === "ok" && (
          <p className="text-xs text-emerald-600">Нотатку додано.</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Додати нотатку"}
        </button>
      </form>
    </section>
  );
}
