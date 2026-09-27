"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";
import type { QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors: Partial<Record<QuoteFormField, string>> = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;

  const errorCount = Object.keys(errors).length;
  // Accessible field errors (skill building-client-form, step 5): label htmlFor, aria-invalid,
  // aria-describedby -> the error text, and a role="alert" summary a screen reader announces.
  const a11y = (field: QuoteFormField) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `quote-${field}-error` }
      : {};
  const error = (field: QuoteFormField) =>
    errors[field] && (
      <span id={`quote-${field}-error`} className="mt-1 block text-xs text-red-600">
        {errors[field]}
      </span>
    );

  return (
    // key: remount after a failed submit so defaultValue shows what the user typed
    <form key={JSON.stringify(values)} action={formAction} className="space-y-4" noValidate>
      {errorCount > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте поля форми: {errorCount}.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">Компанія</label>
          <input id="quote-company" name="company" autoComplete="organization" defaultValue={values?.company} className={inputClass} {...a11y("company")} />
          {error("company")}
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">Email</label>
          <input id="quote-email" name="email" type="email" autoComplete="email" defaultValue={values?.email} className={inputClass} {...a11y("email")} />
          {error("email")}
        </div>
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">Опис задачі</label>
        <textarea id="quote-description" name="description" rows={6} defaultValue={values?.description} className={inputClass} {...a11y("description")} />
        {error("description")}
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">Бюджет, $</label>
        <input
          id="quote-budget"
          name="budget"
          inputMode="decimal"
          placeholder="Необов'язково"
          defaultValue={values?.budget}
          className={inputClass}
          {...a11y("budget")}
        />
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
