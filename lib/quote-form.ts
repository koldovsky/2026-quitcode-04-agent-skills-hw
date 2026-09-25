export const QUOTE_LIMITS = {
  company: 120,
  email: 200,
  description: 4000,
  budgetMin: 100,
  budgetMax: 1_000_000,
} as const;

export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number;
};

export type QuoteFormValues = Partial<Record<QuoteFormField, string>>;

export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

export type ParseQuoteResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: QuoteFormField) {
  const value = formData.get(name);
  // Browsers submit textarea line breaks as CRLF but count them as one character for maxLength.
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

// Too long is an error, not a silent cut: the workflow must price exactly what the client wrote.
export function parseQuoteForm(formData: FormData): ParseQuoteResult {
  const values: QuoteFormValues = {
    company: text(formData, "company"),
    email: text(formData, "email"),
    description: text(formData, "description"),
    budget: text(formData, "budget"),
  };
  const { company = "", description = "", budget = "" } = values;
  const email = (values.email ?? "").toLowerCase();
  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!company) errors.company = "Вкажіть назву компанії";
  else if (company.length > QUOTE_LIMITS.company) errors.company = `Не більше ${QUOTE_LIMITS.company} символів`;

  if (email.length > QUOTE_LIMITS.email || !EMAIL_RE.test(email)) errors.email = "Перевірте email";

  if (description.length < 20) errors.description = "Опишіть задачу докладніше — хоча б 20 символів";
  else if (description.length > QUOTE_LIMITS.description)
    errors.description = `Не більше ${QUOTE_LIMITS.description} символів`;

  const budgetNumber = /^\d{1,7}$/.test(budget) ? Number(budget) : NaN;
  if (!(budgetNumber >= QUOTE_LIMITS.budgetMin && budgetNumber <= QUOTE_LIMITS.budgetMax)) {
    errors.budget = `Вкажіть суму від $${QUOTE_LIMITS.budgetMin} до $${QUOTE_LIMITS.budgetMax.toLocaleString("en-US")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return { ok: true, data: { company, email, description, budget: budgetNumber } };
}
