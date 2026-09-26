"use client";

import { useActionState } from "react";
import { addNote, type AddNoteState } from "@/app/dashboard/leads/[id]/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-form";

const initialState: AddNoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

const STATUS_MESSAGES: Partial<Record<AddNoteState["status"], string>> = {
  unauthorized: "Сесія завершилась. Увійдіть знову, щоб додати нотатку.",
  not_found: "Лід не знайдено або він недоступний.",
  error: "Не вдалося зберегти нотатку. Спробуйте ще раз.",
};

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addNote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};
  const errorCount = Object.keys(errors).length;
  const statusMessage = STATUS_MESSAGES[state.status];

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm"
    >
      <h2 className="font-medium">Додати нотатку</h2>

      {errorCount > 0 && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-700">
          Перевірте поле нотатки
        </div>
      )}
      {statusMessage && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-700">
          {statusMessage}
        </div>
      )}

      <input type="hidden" name="leadId" value={leadId} />

      <div>
        <label htmlFor="note-text" className="block font-medium">
          Нотатка
        </label>
        <textarea
          id="note-text"
          name="text"
          rows={3}
          required
          maxLength={NOTE_MAX_LENGTH}
          defaultValue={values.text}
          aria-invalid={errors.text ? true : undefined}
          aria-describedby={errors.text ? "note-text-error note-text-hint" : "note-text-hint"}
          className={inputClass}
        />
        <p id="note-text-hint" className="mt-1 text-xs text-slate-500">
          До {NOTE_MAX_LENGTH} символів. Бачить лише команда.
        </p>
        {errors.text && (
          <p id="note-text-error" className="mt-1 text-xs text-red-600">
            {errors.text}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Надсилаємо…" : "Додати нотатку"}
        </button>
        <p role="status" className="text-green-700">
          {state.status === "ok" ? "Нотатку додано." : ""}
        </p>
      </div>
    </form>
  );
}
