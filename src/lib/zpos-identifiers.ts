// Shared helpers so phone-only accounts get a consistent synthesized email.
export function phoneToLocalEmail(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `${digits}@local.zpos`;
}

export function isLocalEmail(email: string) {
  return email.toLowerCase().endsWith("@local.zpos");
}

// Given the two possible identifiers on a new user, return the email + phone
// that we will actually store. If email is blank, synthesize one from phone.
export function resolveIdentifiers(rawEmail: string, rawPhone: string) {
  const email = rawEmail.trim();
  const phone = rawPhone.trim();
  if (email) return { email: email.toLowerCase(), phone };
  if (phone) return { email: phoneToLocalEmail(phone), phone };
  return { email: "", phone: "" };
}
