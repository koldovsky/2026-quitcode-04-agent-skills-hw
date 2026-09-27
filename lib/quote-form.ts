export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number | null;
};

export type QuoteFormValues = Record<QuoteFormField, string>;

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BUDGET = 10_000_000;
// Whole dollars, optionally split by spaces ("1 500"), and at most 2 decimals after "." or ",". A comma is
// only a decimal separator: "1,500" and "1,2,3" are ambiguous and get a form error instead of a guess.
const BUDGET_RE = /^\d+(?:[.,]\d{1,2})?$/;

function text(formData: FormData, name: QuoteFormField, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values: QuoteFormValues = {
    company: text(formData, "company", 120),
    email: text(formData, "email", 200).toLowerCase(),
    description: text(formData, "description", 4000),
    budget: text(formData, "budget", 33), // one over the limit: longer input is an error, not cut to fit
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть компанію";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (values.description.length < 20) errors.description = "Опишіть задачу докладніше (від 20 символів)";

  let budget: number | null = null;
  if (values.budget.length > 32) {
    errors.budget = "Вкажіть бюджет числом у доларах, наприклад 1500 або 1500,50";
  } else if (values.budget) {
    const normalized = values.budget.replace(/\s/g, "");
    budget = BUDGET_RE.test(normalized) ? Number(normalized.replace(",", ".")) : NaN;
    if (!Number.isFinite(budget) || budget > MAX_BUDGET) {
      errors.budget = "Вкажіть бюджет числом у доларах, наприклад 1500 або 1500,50";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    data: {
      company: values.company,
      email: values.email,
      description: values.description,
      budget,
    },
  };
}
