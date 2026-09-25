"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";
import { BUDGET_OPTIONS } from "@/lib/lead-form";
import type { QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const FIELD_LABELS: Record<QuoteFormField, string> = {
  company: "компанія",
  email: "email",
  budget: "бюджет",
  taskDescription: "опис задачі",
};

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : null;
  // React 19 resets uncontrolled fields after an action: remount with the returned values.
  const formKey = values ? JSON.stringify(values) : "empty";

  const a11y = (field: QuoteFormField) => ({
    id: `quote-${field}`,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `quote-${field}-error` : undefined,
  });
  const fieldError = (field: QuoteFormField) =>
    errors[field] && (
      <p id={`quote-${field}-error`} className="mt-1 text-xs text-red-600">
        {errors[field]}
      </p>
    );
  const invalidFields = (Object.keys(errors) as QuoteFormField[]).map((f) => FIELD_LABELS[f]);

  return (
    <form key={formKey} action={formAction} className="space-y-4" noValidate>
      {invalidFields.length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте поля: {invalidFields.join(", ")}.
        </p>
      )}

      <div>
        <label htmlFor="quote-company" className="block text-sm font-medium">
          Компанія
        </label>
        <input {...a11y("company")} required autoComplete="organization" defaultValue={values?.company ?? ""} className={inputClass} />
        {fieldError("company")}
      </div>

      <div>
        <label htmlFor="quote-email" className="block text-sm font-medium">
          Email
        </label>
        <input {...a11y("email")} required type="email" autoComplete="email" defaultValue={values?.email ?? ""} className={inputClass} />
        {fieldError("email")}
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">
          Бюджет
        </label>
        <select {...a11y("budget")} defaultValue={values?.budget ?? ""} className={inputClass}>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldError("budget")}
      </div>

      <div>
        <label htmlFor="quote-taskDescription" className="block text-sm font-medium">
          Опишіть задачу
        </label>
        <textarea {...a11y("taskDescription")} required rows={4} defaultValue={values?.taskDescription ?? ""} className={inputClass} />
        {fieldError("taskDescription")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Надсилаємо…" : "Запросити кошторис"}
      </button>
    </form>
  );
}
