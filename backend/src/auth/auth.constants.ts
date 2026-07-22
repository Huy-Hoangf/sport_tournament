export const ADMIN_EMAIL = 'son.vu@twenty-tech.com';
export const DEFAULT_ADMIN_PASSWORD = '123456';
export const DEFAULT_PLAYER_PASSWORD = '123456';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isTwentyTechEmail(email: string): boolean {
  return /^[^\s@]+@twenty-tech\.com$/i.test(email);
}
