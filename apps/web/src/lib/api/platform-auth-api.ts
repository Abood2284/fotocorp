export interface PlatformAuthFieldIssue {
  path: string
  message: string
}

export interface PlatformAuthError {
  code?: string
  message?: string
  detail?: {
    issues?: PlatformAuthFieldIssue[]
  }
}

export interface PlatformAuthResponse {
  ok?: boolean
  error?: PlatformAuthError
  ownerType?: string
  user?: {
    id: string
    email: string
    displayName?: string | null
    username?: string | null
  }
  contributor?: {
    id: string
    displayName: string
    username: string
    email?: string | null
  }
}

export type PlatformLoginScope = "USER" | "CONTRIBUTOR" | "ANY"

export async function platformLogin(
  identifier: string,
  password: string,
  options: { scope?: PlatformLoginScope } = {},
): Promise<PlatformAuthResponse> {
  const scope = options.scope ?? "USER"
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ identifier, password, scope }),
  })

  const payload = (await response.json().catch(() => ({}))) as PlatformAuthResponse & {
    error?: PlatformAuthError | { code?: string; message?: string }
  }

  if (!response.ok) {
    const err = normalizeError(payload)
    return { error: err }
  }

  return payload
}

export async function platformSignUp(body: Record<string, unknown>): Promise<PlatformAuthResponse> {
  const response = await fetch("/api/auth/sign-up", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as PlatformAuthResponse & {
    error?: PlatformAuthError | { code?: string; message?: string }
  }

  if (!response.ok) {
    return { error: normalizeError(payload) }
  }

  return payload
}

function normalizeError(payload: {
  ok?: boolean
  success?: boolean
  error?:
    | PlatformAuthError
    | { code?: string; message?: string; detail?: PlatformAuthError["detail"] }
    | { name?: string; message?: string }
  code?: string
  message?: string
}): PlatformAuthError {
  const nested = payload.error
  if (nested && typeof nested === "object") {
    const code = "code" in nested ? String(nested.code ?? "") : ""
    if (code) {
      return {
        code,
        message: String(nested.message ?? "Authentication failed."),
        detail: "detail" in nested ? (nested.detail as PlatformAuthError["detail"]) : undefined,
      }
    }
    if ("name" in nested && nested.name === "ZodError" && nested.message) {
      return parseZodErrorPayload(nested.message)
    }
  }
  return {
    code: String(payload.code ?? "AUTH_ERROR"),
    message: String(payload.message ?? "Authentication failed."),
  }
}

function parseZodErrorPayload(message: string): PlatformAuthError {
  try {
    const parsed = JSON.parse(message) as Array<{ path?: string[]; message?: string }>
    if (!Array.isArray(parsed)) return { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields." }
    return {
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields.",
      detail: {
        issues: parsed.map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path.map(String).join(".") : "",
          message: String(issue.message ?? "Invalid value."),
        })),
      },
    }
  } catch {
    return { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields." }
  }
}
