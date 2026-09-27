export const QUOTE_BUDGET_OPTIONS = [
  { value: "", label: "Ще не визначились" },
  { value: "1000", label: "до $1 000" },
  { value: "5000", label: "$1 000–5 000" },
  { value: "15000", label: "$5 000–15 000" },
  { value: "50000", label: "понад $15 000" },
] as const;

export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number | null;
};

// Raw string values, kept so the form can be re-rendered after a validation error.
export type QuoteFormValues = Record<QuoteFormField, string>;

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: QuoteFormField, max: number) {
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
  if (values.description.length < 20) errors.description = "Опишіть задачу докладніше (хоча б кілька речень)";

  let budget: number | null = null;
  if (values.budget) {
    if (!QUOTE_BUDGET_OPTIONS.some((option) => option.value === values.budget)) {
      errors.budget = "Оберіть бюджет зі списку";
    } else {
      budget = Number(values.budget);
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
