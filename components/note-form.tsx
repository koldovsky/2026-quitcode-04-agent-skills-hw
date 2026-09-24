"use client";

import { useActionState } from "react";
import { addLeadNote, type NoteFormState } from "@/app/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-form";

const initialState: NoteFormState = { status: "idle" };

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  const error = state.status === "invalid" ? state.errors.text : undefined;
  // Нове значення ключа після кожної відповіді перемонтовує форму, щоб застосувався defaultValue.
  const formKey = state.status === "invalid" ? `invalid:${state.values.text}` : state.status;

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm"
    >
      <input type="hidden" name="leadId" value={leadId} />

      {state.status === "invalid" && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-700">
          Перевірте поля: текст нотатки.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-700">
          Нотатку додано.
        </p>
      )}

      <div>
        <label htmlFor="note-text" className="block font-medium">
          Додати нотатку
        </label>
        <textarea
          id="note-text"
          name="text"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={state.status === "invalid" ? state.values.text : ""}
          aria-invalid={!!error}
          aria-describedby={error ? "text-error" : undefined}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-slate-500">До {NOTE_MAX_LENGTH} символів. Бачить лише команда.</p>
        {error && (
          <p id="text-error" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>

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
