"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";
import { BUDGET_OPTIONS, type QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

const FIELD_LABELS: Record<QuoteFormField, string> = {
  company: "компанія",
  email: "email",
  budget: "бюджет",
  description: "опис задачі",
};

export function QuoteForm() {
  // On success the action redirects to /quotes/<id> (303 without JavaScript), so only errors come back.
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : null;
  const invalidFields = (Object.keys(errors) as QuoteFormField[]).map((field) => FIELD_LABELS[field]);

  // Field props shared by every input: accessible name, error state and the id of the error text.
  const field = (name: QuoteFormField) => ({
    id: `quote-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `quote-${name}-error` : undefined,
    className: inputClass,
  });
  const error = (name: QuoteFormField) =>
    errors[name] ? (
      <p id={`quote-${name}-error`} className="mt-1 text-xs text-red-600">
        {errors[name]}
      </p>
    ) : null;

  return (
    // key: remount with the echoed values after each failed submit (React 19 resets the form after an action).
    <form key={JSON.stringify(values)} action={formAction} className="space-y-4" noValidate>
      {invalidFields.length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте поля: {invalidFields.join(", ")}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">
            Компанія
          </label>
          <input {...field("company")} autoComplete="organization" defaultValue={values?.company ?? ""} />
          {error("company")}
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">
            Email
          </label>
          <input {...field("email")} type="email" autoComplete="email" defaultValue={values?.email ?? ""} />
          {error("email")}
        </div>
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">
          Бюджет
        </label>
        <select {...field("budget")} defaultValue={values?.budget ?? ""}>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error("budget")}
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea {...field("description")} rows={5} defaultValue={values?.description ?? ""} />
        {error("description")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Надсилаємо…" : "Отримати кошторис"}
      </button>
    </form>
  );
}
