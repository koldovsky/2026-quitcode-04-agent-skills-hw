// Anti-spam honeypot for public forms, which have no session to check (building-client-form): a
// field people never see or reach, which bots that fill every input do fill. The name matches no
// browser autofill category, so it is unlikely to be autofilled.
export const HONEYPOT_FIELD = "extra_notes";

export function isHoneypotFilled(formData: FormData) {
  const value = formData.get(HONEYPOT_FIELD);
  return typeof value === "string" && value.trim() !== "";
}
