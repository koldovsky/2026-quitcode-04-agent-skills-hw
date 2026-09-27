"use client";

import { useActionState } from "react";
import { requestQuote, type QuoteFormState } from "@/app/quotes/actions";
import { QUOTE_BUDGET_OPTIONS } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <label className="block text-sm font-medium">
        Компанія
        <input
          name="company"
          autoComplete="organization"
          defaultValue={values?.company}
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
          defaultValue={values?.email}
          className={inputClass}
        />
        {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}
      </label>

      <label className="block text-sm font-medium">
        Опис задачі
        <textarea
          name="description"
          rows={5}
          defaultValue={values?.description}
          placeholder="Що потрібно зробити, у які терміни, які інтеграції важливі…"
          className={inputClass}
        />
        {errors.description && (
          <span className="mt-1 block text-xs text-red-600">{errors.description}</span>
        )}
      </label>

      <label className="block text-sm font-medium">
        Бюджет
        <select name="budget" defaultValue={values?.budget ?? ""} className={inputClass}>
          {QUOTE_BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.budget && <span className="mt-1 block text-xs text-red-600">{errors.budget}</span>}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Готуємо запит…" : "Запросити кошторис"}
      </button>

      <p className="text-xs text-slate-500">
        Формування кошторису триває до півтори хвилини. Ми відкриємо сторінку статусу — оновлювати
        її не потрібно.
      </p>
    </form>
  );
}
