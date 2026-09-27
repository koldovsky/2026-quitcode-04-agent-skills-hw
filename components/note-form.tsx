"use client";

import { useActionState } from "react";
import { addLeadNote, type NoteFormState } from "@/app/dashboard/leads/[id]/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-form";

const initialState: NoteFormState = { status: "idle" };

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote.bind(null, leadId), initialState);
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.status === "invalid" && (
        <p role="alert" className="text-sm text-red-700">
          Перевірте поля: текст нотатки.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Не вдалося зберегти нотатку. Оновіть сторінку й спробуйте ще раз.
        </p>
      )}

      <div>
        <label htmlFor="note-text" className="block text-sm font-medium">
          Додати нотатку
        </label>
        <textarea
          id="note-text"
          name="text"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={state.status === "invalid" ? state.values.text : ""}
          aria-invalid={!!errors.text}
          aria-describedby="note-text-hint note-text-error"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500"
        />
        <p id="note-text-hint" className="mt-1 text-xs text-slate-500">
          До {NOTE_MAX_LENGTH} символів. Бачить лише команда.
        </p>
        <p id="note-text-error" className="mt-1 text-xs text-red-600">
          {errors.text}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Додати нотатку"}
        </button>
        <p role="status" className="text-sm text-green-700">
          {state.status === "ok" ? "Нотатку додано." : ""}
        </p>
      </div>
    </form>
  );
}
