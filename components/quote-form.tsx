"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestQuote } from "@/app/quotes/actions";
import { QUOTE_BUDGET_OPTIONS, QUOTE_LIMITS, type QuoteField, type QuoteFormState } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-[invalid=true]:border-red-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);

  if (state.status === "ok") {
    return (
      <div className="space-y-3 py-6 text-center" role="status">
        <p className="text-lg font-medium">Запит прийнято.</p>
        <p className="text-sm text-slate-600">
          Кошторис готується автоматично, зазвичай 1–2 хвилини. Статус можна відкрити за посиланням — збережіть
          його.
        </p>
        <Link
          href={`/quotes/${state.id}`}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Стежити за статусом
        </Link>
      </div>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};
  const errorCount = Object.keys(errors).length;
  // Accessible field wiring: aria-invalid + aria-describedby only when there is an error.
  const a11y = (name: QuoteField) =>
    errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : { "aria-invalid": false };
  const errorText = (name: QuoteField) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="company" className="block text-sm font-medium">
          Компанія
        </label>
        <input
          id="company"
          name="company"
          autoComplete="organization"
          maxLength={QUOTE_LIMITS.company}
          defaultValue={values.company}
          className={inputClass}
          {...a11y("company")}
        />
        {errorText("company")}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email для кошторису
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={QUOTE_LIMITS.email}
          defaultValue={values.email}
          className={inputClass}
          {...a11y("email")}
        />
        {errorText("email")}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={QUOTE_LIMITS.description}
          defaultValue={values.description}
          className={inputClass}
          {...a11y("description")}
        />
        {errorText("description")}
      </div>

      <div>
        <label htmlFor="budget" className="block text-sm font-medium">
          Бюджет
        </label>
        {/* React 19 resets the form after the action, and a mounted <select> keeps its first
            defaultValue: the key remounts it with the value the server returned. */}
        <select
          key={values.budget ?? ""}
          id="budget"
          name="budget"
          defaultValue={values.budget ?? ""}
          className={inputClass}
          {...a11y("budget")}
        >
          {QUOTE_BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errorText("budget")}
      </div>

      <div role="alert" className="text-sm text-red-700">
        {errorCount > 0 && <p>Перевірте {errorCount === 1 ? "поле, позначене" : "поля, позначені"} червоним.</p>}
        {state.status === "error" && <p>{state.message}</p>}
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
