"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestQuote, type QuoteFormState } from "@/app/quotes/actions";
import { BUDGET_OPTIONS, DESCRIPTION_MAX_LENGTH, type QuoteField } from "@/lib/quote-form";

const initialState: QuoteFormState = { status: "idle" };

const labelClass = "block text-sm font-medium";
const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

const fieldId = (field: QuoteField) => `quote-${field}`;
const errorId = (field: QuoteField) => `quote-${field}-error`;

function FieldError({ field, message }: { field: QuoteField; message?: string }) {
  if (!message) return null;
  return (
    <p id={errorId(field)} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

export function QuoteForm() {
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const router = useRouter();
  const errors: Partial<Record<QuoteField, string>> = state.status === "invalid" ? state.errors : {};
  // Team pattern (building-client-form): label htmlFor, aria-invalid, aria-describedby → error text.
  const fieldProps = (field: QuoteField) => ({
    id: fieldId(field),
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });
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
        <div>
          <label htmlFor={fieldId("company")} className={labelClass}>
            Компанія
          </label>
          <input
            {...fieldProps("company")}
            autoComplete="organization"
            maxLength={120}
            defaultValue={values.company ?? ""}
            className={inputClass}
          />
          <FieldError field="company" message={errors.company} />
        </div>
        <div>
          <label htmlFor={fieldId("email")} className={labelClass}>
            Email
          </label>
          <input
            {...fieldProps("email")}
            type="email"
            autoComplete="email"
            maxLength={200}
            defaultValue={values.email ?? ""}
            className={inputClass}
          />
          <FieldError field="email" message={errors.email} />
        </div>
      </div>

      <div>
        <label htmlFor={fieldId("description")} className={labelClass}>
          Опис задачі
        </label>
        <textarea
          {...fieldProps("description")}
          rows={5}
          maxLength={DESCRIPTION_MAX_LENGTH}
          defaultValue={values.description ?? ""}
          className={inputClass}
        />
        <FieldError field="description" message={errors.description} />
      </div>

      <div>
        <label htmlFor={fieldId("budget")} className={labelClass}>
          Бюджет
        </label>
        {/* key: defaultValue applies only on mount, so remount the select to restore the choice */}
        <select
          key={values.budget ?? ""}
          {...fieldProps("budget")}
          defaultValue={values.budget ?? ""}
          className={inputClass}
        >
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError field="budget" message={errors.budget} />
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
