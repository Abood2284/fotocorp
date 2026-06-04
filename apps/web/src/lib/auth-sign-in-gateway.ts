export function buildSignInHref(input: {
  callbackUrl?: string | null
  tab?: "register"
} = {}): string {
  const params = new URLSearchParams()
  if (input.tab === "register") params.set("tab", "register")
  const callback = input.callbackUrl?.trim()
  if (callback?.startsWith("/") && !callback.startsWith("//")) {
    params.set("callbackUrl", callback)
  }
  const query = params.toString()
  return query ? `/sign-in?${query}` : "/sign-in"
}

/** Strip legacy persona query params from sign-in URLs. */
export function stripLegacyPersonaFromSignInSearchParams(searchParams: URLSearchParams): string | null {
  if (!searchParams.get("persona")) return null
  const params = new URLSearchParams(searchParams.toString())
  params.delete("persona")
  const query = params.toString()
  return query ? `/sign-in?${query}` : "/sign-in"
}
