export const DEFAULT_AUTH_REDIRECT = "/search"

export function resolveAuthRedirectFromSearchParams(searchParams: URLSearchParams) {
  return resolveAuthRedirectCandidate(
    searchParams.get("callbackUrl") ?? searchParams.get("redirectTo"),
  )
}

export function resolveAuthRedirectCandidate(candidate: string | null | undefined) {
  if (!candidate) return DEFAULT_AUTH_REDIRECT
  if (!candidate.startsWith("/")) return DEFAULT_AUTH_REDIRECT
  if (candidate.startsWith("//")) return DEFAULT_AUTH_REDIRECT
  return candidate
}
