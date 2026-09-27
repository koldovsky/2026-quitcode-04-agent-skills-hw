import { BUDGET_OPTIONS } from "./lead-form";

export { BUDGET_OPTIONS };

export const DESCRIPTION_MAX_LENGTH = 2000;

export type QuoteField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number | null;
};

export type QuoteFormValues = Partial<Record<QuoteField, string>>;

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the user typed, returned with any error so that the fields keep it (React 19 resets the form).
export function readQuoteValues(formData: FormData): QuoteFormValues {
  const read = (name: QuoteField) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    company: read("company"),
    email: read("email"),
    // Browsers send textarea line breaks as CRLF, but maxLength counts each one as a single character.
    description: read("description").replace(/\r\n?/g, "\n"),
    budget: read("budget"),
  };
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values = readQuoteValues(formData);
  const data: QuoteFormData = {
    company: (values.company ?? "").trim().slice(0, 120),
    email: (values.email ?? "").trim().slice(0, 200).toLowerCase(),
    description: (values.description ?? "").trim(),
    budget: null,
  };

  const errors: Partial<Record<QuoteField, string>> = {};

  if (!data.company) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(data.email)) errors.email = "Перевірте email";
  if (data.description.length < 10) errors.description = "Опишіть задачу хоча б одним реченням";
  if (data.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Опис має бути не довшим за ${DESCRIPTION_MAX_LENGTH} символів`;
  }

  const budget = (values.budget ?? "").trim();
  if (budget) {
    if (!BUDGET_OPTIONS.some((option) => option.value === budget)) {
      errors.budget = "Оберіть бюджет зі списку";
    } else {
      data.budget = Number(budget);
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors, values } : { ok: true, data };
}
