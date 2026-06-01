/** Shared BFF header hygiene for same-origin API proxies (staff, contributor, platform auth). */

export function buildAuthProxyRequestHeaders(sourceHeaders: Headers) {
  const headers = new Headers(sourceHeaders)
  headers.delete("host")
  headers.delete("content-length")
  headers.delete("accept-encoding")
  headers.delete("connection")
  headers.delete("transfer-encoding")
  return headers
}

export function buildAuthProxyResponseHeaders(sourceHeaders: Headers) {
  const headers = new Headers(sourceHeaders)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.delete("connection")
  headers.delete("keep-alive")
  return headers
}

const UPSTREAM_UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
])

/** Walks `cause` / `errors` chains from undici/Node `fetch` failures (e.g. AggregateError + ECONNREFUSED). */
export function isUpstreamUnreachableFetchError(error: unknown): boolean {
  const stack: unknown[] = [error]
  const seen = new Set<unknown>()
  while (stack.length) {
    const current = stack.pop()
    if (current === undefined || current === null) continue
    if (typeof current !== "object") continue
    if (seen.has(current)) continue
    seen.add(current)
    const rec = current as { code?: unknown; cause?: unknown; errors?: unknown }
    if (typeof rec.code === "string" && UPSTREAM_UNREACHABLE_CODES.has(rec.code)) return true
    if (rec.cause !== undefined) stack.push(rec.cause)
    if (Array.isArray(rec.errors)) for (const sub of rec.errors) stack.push(sub)
  }
  return false
}
