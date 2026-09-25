import { BUDGET_OPTIONS } from "./lead-form";

export type QuoteFormField = "company" | "email" | "taskDescription" | "budget";

export const TASK_DESCRIPTION_MAX_LENGTH = 2000;

export type QuoteFormData = {
  company: string;
  email: string;
  taskDescription: string;
  budget: number | null;
};

// What the user typed, sent back after a validation error so the fields are not emptied.
export type QuoteFormValues = Record<QuoteFormField, string>;

export type ParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: QuoteFormField, max = 200) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): ParseResult {
  const data: QuoteFormData = {
    company: text(formData, "company", 120),
    email: text(formData, "email", 200).toLowerCase(),
    // Checked untruncated below: an over-long description is an error, not silently cut.
    taskDescription: text(formData, "taskDescription", TASK_DESCRIPTION_MAX_LENGTH * 2),
    budget: null,
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!data.company) errors.company = "Вкажіть компанію";
  if (!EMAIL_RE.test(data.email)) errors.email = "Перевірте email";
  if (data.taskDescription.length < 10) errors.taskDescription = "Опишіть задачу хоча б одним реченням";
  else if (data.taskDescription.length > TASK_DESCRIPTION_MAX_LENGTH) {
    errors.taskDescription = `Опис задовгий: ${data.taskDescription.length} із ${TASK_DESCRIPTION_MAX_LENGTH} символів`;
  }

  const budget = text(formData, "budget", 10);
  if (budget) {
    if (!BUDGET_OPTIONS.some((option) => option.value === budget)) {
      errors.budget = "Оберіть бюджет зі списку";
    } else {
      data.budget = Number(budget);
    }
  }

  if (Object.keys(errors).length > 0) {
    const values: QuoteFormValues = {
      company: data.company,
      email: text(formData, "email", 200),
      taskDescription: data.taskDescription,
      budget,
    };
    return { ok: false, errors, values };
  }
  return { ok: true, data };
}
