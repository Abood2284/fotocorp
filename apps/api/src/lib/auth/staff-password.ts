import { hashPhotographerPortalPassword, verifyPhotographerPortalPassword } from "./contributor-password";

export const STAFF_PASSWORD_MIN_LENGTH = 8;

export function validateStaffPasswordLength(password: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}

export async function hashStaffPassword(plain: string): Promise<string> {
  return hashPhotographerPortalPassword(plain);
}

export async function verifyStaffPassword(plain: string, stored: string): Promise<boolean> {
  return verifyPhotographerPortalPassword(plain, stored);
}
