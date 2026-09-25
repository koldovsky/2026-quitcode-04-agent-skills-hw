"use client";

import { useActionState } from "react";
import { requestQuote } from "@/app/quotes/actions";
import { QUOTE_LIMITS, type QuoteFormField, type QuoteFormState } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};
  const errorCount = Object.keys(errors).length;

  // Every field: visible label, aria-invalid, and aria-describedby pointing at its own error text.
  const fieldProps = (name: QuoteFormField) => ({
    id: `quote-${name}`,
    name,
    defaultValue: values[name],
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `quote-${name}-error` : undefined,
    className: inputClass,
  });
  const fieldError = (name: QuoteFormField) =>
    errors[name] ? (
      <span id={`quote-${name}-error`} className="mt-1 block text-xs text-red-600">
        {errors[name]}
      </span>
    ) : null;

  return (
    // key: remount with the submitted values so defaultValue shows them after a failed check.
    <form action={formAction} key={JSON.stringify(values)} className="space-y-4" noValidate>
      {errorCount > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorCount === 1 ? "Перевірте 1 поле." : `Перевірте ${errorCount} поля.`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">
            Компанія
          </label>
          <input {...fieldProps("company")} autoComplete="organization" maxLength={QUOTE_LIMITS.company} />
          {fieldError("company")}
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">
            Email
          </label>
          <input {...fieldProps("email")} type="email" autoComplete="email" maxLength={QUOTE_LIMITS.email} />
          {fieldError("email")}
        </div>
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea
          {...fieldProps("description")}
          rows={6}
          maxLength={QUOTE_LIMITS.description}
          placeholder="Що потрібно зробити, терміни, що вже є"
        />
        {fieldError("description")}
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">
          Бюджет, $
        </label>
        <input
          {...fieldProps("budget")}
          type="number"
          inputMode="numeric"
          min={QUOTE_LIMITS.budgetMin}
          max={QUOTE_LIMITS.budgetMax}
          step={1}
        />
        {fieldError("budget")}
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
