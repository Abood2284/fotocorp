/**
 * Edge-safe session cookie presence check aligned with Better Auth defaults
 * (`better-auth.session_token`, optional `__Secure-` prefix, `better-auth-session_token` alt).
 * Do not import `better-auth/*` from middleware/proxy: those entrypoints bundle Node-only code.
 */
function parseCookies(cookieHeader: string): Map<string, string> {
  const cookieMap = new Map<string, string>()
  for (const cookie of cookieHeader.split("; ")) {
    const parts = cookie.split(/=(.*)/s)
    const name = parts[0]
    if (!name || parts.length < 2) continue
    cookieMap.set(name, parts[1] ?? "")
  }
  return cookieMap
}

export function hasBetterAuthSessionCookie(request: { headers: Headers }): boolean {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return false

  const cookieName = "session_token"
  const cookiePrefix = "better-auth"
  const parsed = parseCookies(cookieHeader)
  const read = (fullName: string) => parsed.get(fullName) ?? parsed.get(`__Secure-${fullName}`)

  if (read(`${cookiePrefix}.${cookieName}`)) return true
  if (read(`${cookiePrefix}-${cookieName}`)) return true
  return false
}
