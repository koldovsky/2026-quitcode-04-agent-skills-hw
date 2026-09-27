import { EMAIL_RE } from "./lead-form";

export const QUOTE_DESCRIPTION_MIN_LENGTH = 20;
export const QUOTE_DESCRIPTION_MAX_LENGTH = 2000;
const QUOTE_BUDGET_MAX = 1_000_000;

export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  /** USD for the whole project; null = not decided yet. */
  budget: number | null;
};

// What the user typed, echoed back on a validation error so the form keeps it.
export type QuoteFormValues = Record<QuoteFormField, string>;

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

function text(formData: FormData, name: QuoteFormField) {
  const value = formData.get(name);
  // Browsers submit textarea line breaks as CRLF, while maxLength counts each one as one character.
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values: QuoteFormValues = {
    company: text(formData, "company").trim().slice(0, 120),
    email: text(formData, "email").trim().slice(0, 200),
    description: text(formData, "description"),
    budget: text(formData, "budget").trim().slice(0, 12),
  };

  const description = values.description.trim();
  const budgetDigits = values.budget.replace(/[\s_]/g, "");
  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (description.length < QUOTE_DESCRIPTION_MIN_LENGTH) {
    errors.description = `Опишіть задачу докладніше: хоча б ${QUOTE_DESCRIPTION_MIN_LENGTH} символів`;
  } else if (description.length > QUOTE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Скоротіть опис до ${QUOTE_DESCRIPTION_MAX_LENGTH} символів (зараз ${description.length})`;
  }
  if (budgetDigits && (!/^\d{1,7}$/.test(budgetDigits) || Number(budgetDigits) < 1 || Number(budgetDigits) > QUOTE_BUDGET_MAX)) {
    errors.budget = `Вкажіть суму в доларах цілим числом, до ${QUOTE_BUDGET_MAX.toLocaleString("uk-UA")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };

  return {
    ok: true,
    data: {
      company: values.company,
      email: values.email.toLowerCase(),
      description,
      budget: budgetDigits ? Number(budgetDigits) : null,
    },
  };
}
