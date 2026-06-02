export const FOTOCORP_SESSION_COOKIE = "fotocorp_session"
export const FOTOCORP_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export function generatePlatformSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export async function hashPlatformSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function isSecureAuthCookie(request: Request): boolean {
  return new URL(request.url).protocol === "https:"
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
