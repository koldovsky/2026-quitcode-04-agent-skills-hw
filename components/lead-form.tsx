"use client";

import { useActionState } from "react";
import { submitLead, type SubmitLeadState } from "@/app/actions";
import { BUDGET_OPTIONS } from "@/lib/lead-form";

const initialState: SubmitLeadState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function LeadForm() {
  const [state, formAction, pending] = useActionState(submitLead, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;

  if (state.status === "ok") {
    return (
      <div className="space-y-2 py-8 text-center">
        <p className="text-lg font-medium">Дякуємо! Заявку отримано.</p>
        <p className="text-sm text-slate-600">Ми зв&apos;яжемося з вами протягом робочого дня.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Ім&apos;я
          <input name="firstName" autoComplete="given-name" defaultValue={values?.firstName} className={inputClass} />
          {errors.firstName && <span className="mt-1 block text-xs text-red-600">{errors.firstName}</span>}
        </label>
        <label className="block text-sm font-medium">
          Прізвище
          <input name="lastName" autoComplete="family-name" defaultValue={values?.lastName} className={inputClass} />
          {errors.lastName && <span className="mt-1 block text-xs text-red-600">{errors.lastName}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" defaultValue={values?.email} className={inputClass} />
          {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}
        </label>
        <label className="block text-sm font-medium">
          Телефон
          <input name="phone" type="tel" autoComplete="tel" defaultValue={values?.phone} className={inputClass} />
          {errors.phone && <span className="mt-1 block text-xs text-red-600">{errors.phone}</span>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Компанія
          <input name="company" autoComplete="organization" defaultValue={values?.company} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Сайт
          <input
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={values?.website}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Бюджет
        {/* A select ignores defaultValue changes after mount: the key remounts it with the returned value. */}
        <select
          key={values?.budget ?? ""}
          name="budget"
          defaultValue={values?.budget ?? ""}
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

      <label className="block text-sm font-medium">
        Що потрібно зробити?
        <textarea name="message" rows={4} defaultValue={values?.message} className={inputClass} />
        {errors.message && <span className="mt-1 block text-xs text-red-600">{errors.message}</span>}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          key={values?.consentMarketing ?? ""}
          name="consentMarketing"
          type="checkbox"
          defaultChecked={values?.consentMarketing === "on"}
          className="h-4 w-4 rounded border-slate-300"
        />
        Хочу отримувати корисні матеріали від Studio Nova
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Надсилаємо…" : "Надіслати заявку"}
      </button>
    </form>
  );
}
