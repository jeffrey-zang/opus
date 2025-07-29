export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function validateName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100;
}
