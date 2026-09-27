export const QUOTE_BUDGET_OPTIONS = [
  { value: "", label: "Ще не визначились" },
  { value: "1000", label: "до $1000" },
  { value: "3000", label: "$1000–3000" },
  { value: "7000", label: "$3000–7000" },
  { value: "15000", label: "понад $7000" },
] as const;

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

function text(formData: FormData, name: QuoteFormField, max = 200) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values: QuoteFormValues = {
    company: text(formData, "company", 120),
    email: text(formData, "email", 200).toLowerCase(),
    description: text(formData, "description", 4000),
    budget: text(formData, "budget", 10),
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (values.description.length < 20) errors.description = "Опишіть задачу докладніше (хоча б 20 символів)";
  if (values.budget && !QUOTE_BUDGET_OPTIONS.some((option) => option.value === values.budget)) {
    errors.budget = "Оберіть бюджет зі списку";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };

  return {
    ok: true,
    data: {
      company: values.company,
      email: values.email,
      description: values.description,
      budget: values.budget ? Number(values.budget) : null,
    },
  };
}
