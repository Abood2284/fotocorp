export const PLATFORM_PASSWORD_MIN_LENGTH = 6

export const PLATFORM_PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PLATFORM_PASSWORD_MIN_LENGTH} characters.`

export function validatePlatformNewPassword(password: string, confirmation: string): string | null {
  if (password.length < PLATFORM_PASSWORD_MIN_LENGTH) return PLATFORM_PASSWORD_MIN_LENGTH_MESSAGE
  if (password !== confirmation) return "New passwords do not match."
  return null
}
