"use client";

import { useActionState } from "react";
import type { AddLeadNoteState } from "@/app/dashboard/leads/[id]/actions";
import { LEAD_NOTE_MAX_LENGTH } from "@/lib/lead-note-form";

const initialState: AddLeadNoteState = { status: "idle" };

type LeadNoteFormProps = {
  action: (state: AddLeadNoteState, formData: FormData) => Promise<AddLeadNoteState>;
};

export function LeadNoteForm({ action }: LeadNoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  // restore the typed note after any failed submit; clear it only after a successful write
  const values = state.status === "invalid" || state.status === "error" ? state.values : undefined;
  const errorCount = Object.keys(errors).length;

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm"
    >
      <h2 className="font-medium">Додати нотатку</h2>

      {state.status === "invalid" && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          Перевірте форму: помилок — {errorCount}.
        </div>
      )}
      {state.status === "error" && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {state.message}
        </div>
      )}
      {state.status === "ok" && (
        <p role="status" className="text-green-700">
          Нотатку додано.
        </p>
      )}

      <div>
        <label htmlFor="note" className="block font-medium">
          Нотатка
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          required
          maxLength={LEAD_NOTE_MAX_LENGTH}
          defaultValue={values?.note ?? ""}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? "note-error note-hint" : "note-hint"}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500"
        />
        <p id="note-hint" className="mt-1 text-xs text-slate-500">
          До {LEAD_NOTE_MAX_LENGTH} символів. Видно лише команді.
        </p>
        {errors.note && (
          <p id="note-error" className="mt-1 text-xs text-red-600">
            {errors.note}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Надсилаємо…" : "Додати нотатку"}
      </button>
    </form>
  );
}
