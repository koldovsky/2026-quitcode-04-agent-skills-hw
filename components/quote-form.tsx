"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";
import { QUOTE_BUDGET_OPTIONS, type QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

// On success the Server Action redirects to /quotes/<id>, so the form only renders idle/invalid.
export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;
  const errorCount = Object.keys(errors).length;

  // Accessible error wiring for one field: aria-invalid + aria-describedby → the error text.
  const field = (name: QuoteFormField) => ({
    id: `quote-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `quote-${name}-error` : undefined,
  });
  const error = (name: QuoteFormField) =>
    errors[name] && (
      <p id={`quote-${name}-error`} className="mt-1 text-xs text-red-600">
        {errors[name]}
      </p>
    );

  return (
    // key remounts the fields with the submitted values after a failed validation
    <form key={JSON.stringify(values)} action={formAction} className="space-y-4" noValidate>
      {errorCount > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте {errorCount === 1 ? "1 поле" : `${errorCount} поля`}: виправлення — під кожним полем.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">
            Компанія
          </label>
          <input {...field("company")} required aria-required autoComplete="organization" defaultValue={values?.company} className={inputClass} />
          {error("company")}
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">
            Email
          </label>
          <input {...field("email")} type="email" required aria-required autoComplete="email" defaultValue={values?.email} className={inputClass} />
          {error("email")}
        </div>
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea {...field("description")} rows={6} required aria-required defaultValue={values?.description} className={inputClass} />
        {error("description")}
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">
          Бюджет
        </label>
        <select {...field("budget")} defaultValue={values?.budget ?? ""} className={inputClass}>
          {QUOTE_BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error("budget")}
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
