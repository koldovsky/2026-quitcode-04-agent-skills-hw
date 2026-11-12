export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number; // USD, whole dollars
};

export type QuoteFormValues = Record<QuoteFormField, string>;

export type ParseQuoteResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BUDGET = 1_000_000;

function text(formData: FormData, name: QuoteFormField, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): ParseQuoteResult {
  const values: QuoteFormValues = {
    company: text(formData, "company", 120),
    email: text(formData, "email", 200).toLowerCase(),
    description: text(formData, "description", 2000),
    budget: text(formData, "budget", 12),
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (values.description.length < 20) errors.description = "Опишіть задачу детальніше — хоча б 20 символів";

  const budget = Number(values.budget.replace(/[\s,]/g, ""));
  if (!values.budget || !Number.isInteger(budget) || budget <= 0 || budget > MAX_BUDGET) {
    errors.budget = "Вкажіть бюджет цілим числом у доларах";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    data: { company: values.company, email: values.email, description: values.description, budget },
  };
}
