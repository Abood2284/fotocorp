export type SignInPersona = "subscriber" | "contributor" | "staff"

const PERSONA_QUERY = "persona"

export function readSignInPersona(value: string | null | undefined): SignInPersona {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "contributor" || normalized === "photographer") return "contributor"
  if (normalized === "staff" || normalized === "internal") return "staff"
  return "subscriber"
}

export function buildSignInHref(input: {
  persona?: SignInPersona
  callbackUrl?: string | null
  tab?: "register"
} = {}): string {
  const params = new URLSearchParams()
  if (input.persona && input.persona !== "subscriber") {
    params.set(PERSONA_QUERY, input.persona)
  }
  if (input.tab === "register") params.set("tab", "register")
  const callback = input.callbackUrl?.trim()
  if (callback?.startsWith("/") && !callback.startsWith("//")) {
    params.set("callbackUrl", callback)
  }
  const query = params.toString()
  return query ? `/sign-in?${query}` : "/sign-in"
}

export function signInPersonaLabel(persona: SignInPersona): string {
  if (persona === "contributor") return "Contributor"
  if (persona === "staff") return "Staff"
  return "Subscriber"
}
