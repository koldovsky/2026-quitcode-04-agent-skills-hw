import type { NewQuote } from "./types";

// Quote request form: fields, limits, state and server-side validation
// (skill building-client-form). Pure module: used by the Server Action and the form.

export const QUOTE_BUDGET_OPTIONS = [
  { value: "", label: "Ще не визначились" },
  { value: "1000", label: "до $1 000" },
  { value: "3000", label: "$1 000–3 000" },
  { value: "10000", label: "$3 000–10 000" },
  { value: "25000", label: "понад $10 000" },
] as const;

export const QUOTE_LIMITS = { company: 120, email: 200, description: 2000, descriptionMin: 20 } as const;

export type QuoteField = "company" | "email" | "description" | "budget";

export type QuoteFormValues = Partial<Record<QuoteField, string>>;

export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteField, string>>; values: QuoteFormValues }
  | { status: "error"; message: string; values: QuoteFormValues }
  | { status: "ok"; id: string };

export type ParseQuoteResult =
  | { ok: true; data: NewQuote; values: QuoteFormValues }
  | { ok: false; errors: Partial<Record<QuoteField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, name: QuoteField, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): ParseQuoteResult {
  const values = {
    company: field(formData, "company", QUOTE_LIMITS.company),
    email: field(formData, "email", QUOTE_LIMITS.email).toLowerCase(),
    description: field(formData, "description", QUOTE_LIMITS.description),
    budget: field(formData, "budget", 10),
  };

  const errors: Partial<Record<QuoteField, string>> = {};
  if (values.company.length < 2) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email — на нього прийде кошторис";
  if (values.description.length < QUOTE_LIMITS.descriptionMin) {
    errors.description = `Опишіть задачу докладніше (щонайменше ${QUOTE_LIMITS.descriptionMin} символів)`;
  }
  if (!QUOTE_BUDGET_OPTIONS.some((option) => option.value === values.budget)) errors.budget = "Оберіть бюджет зі списку";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    values,
    data: {
      company: values.company,
      email: values.email,
      description: values.description,
      budget: values.budget ? Number(values.budget) : null,
    },
  };
}
