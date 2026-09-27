export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number | null;
};

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: QuoteFormField, max = 200) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const errors: Partial<Record<QuoteFormField, string>> = {};

  const company = text(formData, "company", 120);
  const email = text(formData, "email", 200).toLowerCase();
  const description = text(formData, "description", 2000);
  const budgetRaw = text(formData, "budget", 10);

  if (!company) errors.company = "Вкажіть назву компанії";
  if (!EMAIL_RE.test(email)) errors.email = "Перевірте email";
  if (description.length < 10) errors.description = "Опишіть задачу хоча б одним реченням";

  let budget: number | null = null;
  if (budgetRaw) {
    const parsedBudget = Number(budgetRaw);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      errors.budget = "Вкажіть коректний бюджет";
    } else {
      budget = parsedBudget;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { company, email, description, budget } };
}
