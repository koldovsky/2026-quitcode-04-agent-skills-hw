"use client";

import { useActionState } from "react";
import { submitQuoteRequest, type QuoteRequestState } from "@/app/quotes/actions";
import { QUOTE_DESCRIPTION_MAX_LENGTH, type QuoteFormField } from "@/lib/quote-form";

const initialState: QuoteRequestState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const FIELD_LABELS: Record<QuoteFormField, string> = {
  company: "Компанія",
  email: "Email",
  description: "Опис задачі",
  budget: "Бюджет",
};

// On success the action redirects to /quotes/[id], so the form only renders idle and invalid states.
export function QuoteForm() {
  const [state, formAction, pending] = useActionState(submitQuoteRequest, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;
  const invalidFields = (Object.keys(FIELD_LABELS) as QuoteFormField[]).filter((field) => errors[field]);

  const describedBy = (field: QuoteFormField, hint?: string) =>
    [errors[field] ? `quote-${field}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <form action={formAction} className="space-y-4 text-sm" noValidate>
      {invalidFields.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          Перевірте {invalidFields.length === 1 ? "поле" : "поля"}:{" "}
          {invalidFields.map((field, index) => (
            <span key={field}>
              {index > 0 && ", "}
              <a href={`#quote-${field}`} className="font-medium underline">
                {FIELD_LABELS[field]}
              </a>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block font-medium">
            {FIELD_LABELS.company}
          </label>
          <input
            id="quote-company"
            name="company"
            autoComplete="organization"
            required
            maxLength={120}
            defaultValue={values?.company}
            aria-invalid={Boolean(errors.company)}
            aria-describedby={describedBy("company")}
            className={inputClass}
          />
          {errors.company && (
            <p id="quote-company-error" className="mt-1 text-xs text-red-600">
              {errors.company}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quote-email" className="block font-medium">
            {FIELD_LABELS.email}
          </label>
          <input
            id="quote-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
            defaultValue={values?.email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            className={inputClass}
          />
          {errors.email && (
            <p id="quote-email-error" className="mt-1 text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="quote-description" className="block font-medium">
          {FIELD_LABELS.description}
        </label>
        <textarea
          id="quote-description"
          name="description"
          rows={6}
          required
          maxLength={QUOTE_DESCRIPTION_MAX_LENGTH}
          defaultValue={values?.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy("description", "quote-description-hint")}
          className={inputClass}
        />
        {errors.description && (
          <p id="quote-description-error" className="mt-1 text-xs text-red-600">
            {errors.description}
          </p>
        )}
        <p id="quote-description-hint" className="mt-1 text-xs text-slate-500">
          Що потрібно зробити, для кого і до якого терміну. До {QUOTE_DESCRIPTION_MAX_LENGTH} символів.
        </p>
      </div>

      <div className="sm:w-1/2">
        <label htmlFor="quote-budget" className="block font-medium">
          {FIELD_LABELS.budget}, $ <span className="font-normal text-slate-500">(необов&apos;язково)</span>
        </label>
        <input
          id="quote-budget"
          name="budget"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          placeholder="Напр. 3000"
          defaultValue={values?.budget}
          aria-invalid={Boolean(errors.budget)}
          aria-describedby={describedBy("budget", "quote-budget-hint")}
          className={inputClass}
        />
        {errors.budget && (
          <p id="quote-budget-error" className="mt-1 text-xs text-red-600">
            {errors.budget}
          </p>
        )}
        <p id="quote-budget-hint" className="mt-1 text-xs text-slate-500">
          На весь проєкт, у доларах. Порожнє поле — ще не визначились.
        </p>
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
