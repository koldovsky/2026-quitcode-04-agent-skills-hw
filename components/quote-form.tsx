"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestQuote, type QuoteFormState } from "@/app/quotes/actions";
import { BUDGET_OPTIONS, DESCRIPTION_MAX_LENGTH } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const router = useRouter();
  const errors = state.status === "invalid" ? state.errors : {};
  // Invalid state carries what the user typed; React 19 resets the form after every action.
  const values = state.status === "invalid" ? state.values : {};
  const quoteId = state.status === "ok" ? state.id : null;

  useEffect(() => {
    if (quoteId) router.push(`/quotes/${quoteId}`);
  }, [quoteId, router]);

  if (quoteId) {
    return (
      <div className="space-y-2 py-8 text-center">
        <p className="text-lg font-medium">Запит прийнято.</p>
        <Link href={`/quotes/${quoteId}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          Перейти до статусу кошторису →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "invalid" && (
        <p role="alert" className="text-sm text-red-700">
          Запит не надіслано: виправте поля нижче.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Компанія
          <input
            name="company"
            autoComplete="organization"
            maxLength={120}
            defaultValue={values.company ?? ""}
            aria-invalid={errors.company ? true : undefined}
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
            maxLength={200}
            defaultValue={values.email ?? ""}
            aria-invalid={errors.email ? true : undefined}
            className={inputClass}
          />
          {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}
        </label>
      </div>

      <label className="block text-sm font-medium">
        Опис задачі
        <textarea
          name="description"
          rows={5}
          maxLength={DESCRIPTION_MAX_LENGTH}
          defaultValue={values.description ?? ""}
          aria-invalid={errors.description ? true : undefined}
          className={inputClass}
        />
        {errors.description && <span className="mt-1 block text-xs text-red-600">{errors.description}</span>}
      </label>

      <label className="block text-sm font-medium">
        Бюджет
        {/* key: defaultValue applies only on mount, so remount the select to restore the choice */}
        <select
          key={values.budget ?? ""}
          name="budget"
          defaultValue={values.budget ?? ""}
          aria-invalid={errors.budget ? true : undefined}
          className={inputClass}
        >
          {BUDGET_OPTIONS.map((option) => (
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
        {pending ? "Надсилаємо…" : "Запросити кошторис"}
      </button>
    </form>
  );
}
