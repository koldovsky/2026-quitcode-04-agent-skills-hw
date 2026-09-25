"use client";

import { useActionState } from "react";
import { requestQuote } from "@/app/quotes/actions";
import { QUOTE_LIMITS, type QuoteFormState } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};

  return (
    // key: remount with the submitted values so defaultValue shows them after a failed check.
    <form action={formAction} key={JSON.stringify(values)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Компанія
          <input
            name="company"
            autoComplete="organization"
            maxLength={QUOTE_LIMITS.company}
            defaultValue={values.company}
            aria-invalid={Boolean(errors.company)}
            className={inputClass}
          />
          {errors.company && <span className="mt-1 block text-xs text-red-600">{errors.company}</span>}
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={QUOTE_LIMITS.email}
            defaultValue={values.email}
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
          />
          {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}
        </label>
      </div>

      <label className="block text-sm font-medium">
        Опис задачі
        <textarea
          name="description"
          rows={6}
          maxLength={QUOTE_LIMITS.description}
          defaultValue={values.description}
          aria-invalid={Boolean(errors.description)}
          placeholder="Що потрібно зробити, терміни, що вже є"
          className={inputClass}
        />
        {errors.description && <span className="mt-1 block text-xs text-red-600">{errors.description}</span>}
      </label>

      <label className="block text-sm font-medium">
        Бюджет, $
        <input
          name="budget"
          type="number"
          inputMode="numeric"
          min={QUOTE_LIMITS.budgetMin}
          max={QUOTE_LIMITS.budgetMax}
          step={1}
          defaultValue={values.budget}
          aria-invalid={Boolean(errors.budget)}
          className={inputClass}
        />
        {errors.budget && <span className="mt-1 block text-xs text-red-600">{errors.budget}</span>}
      </label>

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
