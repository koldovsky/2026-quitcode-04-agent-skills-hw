export const BUDGET_OPTIONS = [
  { value: "", label: "Ще не визначились" },
  { value: "500", label: "до $500 / міс." },
  { value: "1500", label: "$500–1500 / міс." },
  { value: "5000", label: "$1500–5000 / міс." },
  { value: "10000", label: "понад $5000 / міс." },
] as const;

export type LeadFormField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "company"
  | "website"
  | "budget"
  | "message"
  | "consentMarketing";

export type LeadFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  budget: number | null;
  message: string;
  consentMarketing: boolean;
};

export type ParseResult =
  | { ok: true; data: LeadFormData }
  | { ok: false; errors: Partial<Record<LeadFormField, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

function text(formData: FormData, name: LeadFormField, max = 200) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseLeadForm(formData: FormData): ParseResult {
  const data: LeadFormData = {
    firstName: text(formData, "firstName", 80),
    lastName: text(formData, "lastName", 80),
    email: text(formData, "email", 200).toLowerCase(),
    phone: text(formData, "phone", 20),
    company: text(formData, "company", 120),
    website: text(formData, "website", 200),
    budget: null,
    message: text(formData, "message", 2000),
    consentMarketing: formData.get("consentMarketing") === "on",
  };

  const errors: Partial<Record<LeadFormField, string>> = {};

  if (!data.firstName) errors.firstName = "Вкажіть ім'я";
  if (!data.lastName) errors.lastName = "Вкажіть прізвище";
  if (!EMAIL_RE.test(data.email)) errors.email = "Перевірте email";
  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = "Перевірте номер телефону";
  if (data.message.length < 10) errors.message = "Опишіть задачу хоча б одним реченням";

  const budget = text(formData, "budget", 10);
  if (budget) {
    if (!BUDGET_OPTIONS.some((option) => option.value === budget)) {
      errors.budget = "Оберіть бюджет зі списку";
    } else {
      data.budget = Number(budget);
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

export const NOTE_MAX_LENGTH = 500;

export type NoteParseResult =
  | { ok: true; note: string }
  | { ok: false; error: string; value: string };

export function parseLeadNoteForm(formData: FormData): NoteParseResult {
  const raw = formData.get("note");
  const value = typeof raw === "string" ? raw : "";
  const note = value.trim();

  if (!note) {
    return { ok: false, error: "Введіть текст нотатки", value };
  }
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Нотатка не може перевищувати ${NOTE_MAX_LENGTH} символів`, value };
  }

  return { ok: true, note };
}
