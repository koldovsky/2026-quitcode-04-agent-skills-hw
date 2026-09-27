"use client";

import { useActionState } from "react";
import type { LeadNoteState } from "@/app/actions";
import { LEAD_NOTE_MAX_LENGTH } from "@/lib/lead-note-form";

const initialState: LeadNoteState = { status: "idle" };

type LeadNoteAction = (prevState: LeadNoteState, formData: FormData) => Promise<LeadNoteState>;

// `action` is submitLeadNote bound to the lead id in the Server Component. Binding it here, during
// render, makes the server re-render after a submission without JS hang instead of responding.
export function LeadNoteForm({ action }: { action: LeadNoteAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {(state.status === "invalid" || state.status === "error") && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {state.status === "invalid" ? (
            <>
              Перевірте поле:{" "}
              <a href="#lead-note" className="font-medium underline">
                Нова нотатка
              </a>
            </>
          ) : (
            state.message
          )}
        </div>
      )}

      <div>
        <label htmlFor="lead-note" className="block font-medium">
          Нова нотатка
        </label>
        <textarea
          id="lead-note"
          name="note"
          rows={3}
          required
          maxLength={LEAD_NOTE_MAX_LENGTH}
          defaultValue={values?.note}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? "lead-note-error lead-note-hint" : "lead-note-hint"}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {errors.note && (
          <p id="lead-note-error" className="mt-1 text-xs text-red-600">
            {errors.note}
          </p>
        )}
        <p id="lead-note-hint" className="mt-1 text-xs text-slate-500">
          До {LEAD_NOTE_MAX_LENGTH} символів. Нотатку бачить лише ваша команда.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
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
