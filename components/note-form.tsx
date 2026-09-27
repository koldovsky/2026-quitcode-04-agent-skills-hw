"use client";

import { useActionState } from "react";
import { addLeadNote } from "@/app/actions";
import { NOTE_MAX_LENGTH, type NoteFormState } from "@/lib/note-form";

const initialState: NoteFormState = { status: "idle" };

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};

  return (
    <form action={formAction} className="space-y-2" noValidate>
      <input type="hidden" name="leadId" value={leadId} />
      {state.status === "invalid" && (
        <p role="alert" className="text-sm text-red-700">
          Перевірте 1 поле
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}

      <label htmlFor="note-text" className="block text-sm font-medium">
        Додати нотатку
      </label>
      <textarea
        id="note-text"
        name="text"
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        required
        aria-required
        defaultValue={values.text}
        aria-invalid={errors.text ? true : undefined}
        aria-describedby={errors.text ? "note-text-error note-text-hint" : "note-text-hint"}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {errors.text && (
        <p id="note-text-error" className="text-xs text-red-600">
          {errors.text}
        </p>
      )}
      <p id="note-text-hint" className="text-xs text-slate-500">
        До {NOTE_MAX_LENGTH} символів. Нотатку бачить лише ваша команда.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Додати нотатку"}
        </button>
        <p role="status" className="text-sm text-green-700">
          {state.status === "ok" && !pending ? "Нотатку додано" : ""}
        </p>
      </div>
    </form>
  );
}
