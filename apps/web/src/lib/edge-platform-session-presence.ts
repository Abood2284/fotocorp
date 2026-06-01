/**
 * Edge-safe check for platform subscriber session cookie (`fotocorp_session`).
 * Do not import Node-only auth modules from middleware.
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

export function hasPlatformSessionCookie(request: { headers: Headers }): boolean {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return false

  const parsed = parseCookies(cookieHeader)
  const read = (name: string) => parsed.get(name) ?? parsed.get(`__Secure-${name}`)
  return Boolean(read("fotocorp_session"))
}
