"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;
  const errorCount = Object.keys(errors).length;

  // aria-invalid + aria-describedby tie each field to its error text for assistive technology
  const fieldA11y = (name: keyof typeof errors) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: keyof typeof errors) =>
    errors[name] && (
      <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
        {errors[name]}
      </p>
    );

  return (
    // key: remount after a failed submit so defaultValue shows what the user typed
    <form key={JSON.stringify(values)} action={formAction} className="space-y-4" noValidate>
      {errorCount > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте форму: помилок — {errorCount}.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className="block text-sm font-medium">
            Компанія
          </label>
          <input
            id="company"
            name="company"
            required
            autoComplete="organization"
            defaultValue={values?.company}
            className={inputClass}
            {...fieldA11y("company")}
          />
          {fieldError("company")}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={values?.email}
            className={inputClass}
            {...fieldA11y("email")}
          />
          {fieldError("email")}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          defaultValue={values?.description}
          className={inputClass}
          {...fieldA11y("description")}
        />
        {fieldError("description")}
      </div>

      <div>
        <label htmlFor="budget" className="block text-sm font-medium">
          Бюджет, $
        </label>
        <input
          id="budget"
          name="budget"
          inputMode="numeric"
          required
          placeholder="наприклад, 3000"
          defaultValue={values?.budget}
          className={inputClass}
          {...fieldA11y("budget")}
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
