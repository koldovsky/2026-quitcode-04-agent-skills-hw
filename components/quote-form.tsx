"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/new/actions";
import { QUOTE_BUDGET_OPTIONS, type QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const LABELS: Record<QuoteFormField, string> = {
  company: "компанія",
  email: "email",
  budget: "бюджет",
  description: "опис задачі",
};

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm sm:text-sm aria-invalid:border-red-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QuoteForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;
  const errorCount = Object.keys(errors).length;
  const fieldA11y = (field: QuoteFormField) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `quote-${field}-error` } : {};

  useEffect(() => {
    if (state.status === "queued") router.push(`/quotes/${state.id}`);
  }, [state, router]);

  if (state.status === "queued") {
    return (
      <div className="space-y-2 py-8 text-center">
        <p className="text-lg font-medium">Запит прийнято.</p>
        <Link href={`/quotes/${state.id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          Перейти до статусу кошторису →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errorCount > 0 && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Перевірте {errorCount === 1 ? "поле" : "поля"}: {Object.keys(errors).map((f) => LABELS[f as QuoteFormField]).join(", ")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">Компанія</label>
          <input id="quote-company" name="company" autoComplete="organization" required
            defaultValue={values?.company} {...fieldA11y("company")} className={inputClass} />
          <FieldError field="company" message={errors.company} />
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">Email</label>
          <input id="quote-email" name="email" type="email" autoComplete="email" required
            defaultValue={values?.email} {...fieldA11y("email")} className={inputClass} />
          <FieldError field="email" message={errors.email} />
        </div>
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">Бюджет</label>
        {/* key: React 19 resets the form after the action; a mounted <select> keeps its first defaultValue */}
        <select id="quote-budget" name="budget" key={values?.budget ?? ""} defaultValue={values?.budget ?? ""}
          {...fieldA11y("budget")} className={inputClass}>
          {QUOTE_BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError field="budget" message={errors.budget} />
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">Опис задачі</label>
        <textarea id="quote-description" name="description" rows={6} required minLength={20}
          defaultValue={values?.description} {...fieldA11y("description")} className={inputClass} />
        <FieldError field="description" message={errors.description} />
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

function FieldError({ field, message }: { field: QuoteFormField; message?: string }) {
  if (!message) return null;
  return (
    <p id={`quote-${field}-error`} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}
