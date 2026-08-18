export const COMPANY_EMAIL_DOMAIN = '@tech.com';
export const ADMIN_EMAIL = `son.vu${COMPANY_EMAIL_DOMAIN}`;
export const DEFAULT_ADMIN_PASSWORD = '123456';
export const DEFAULT_PLAYER_PASSWORD = '123456';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email);
}
