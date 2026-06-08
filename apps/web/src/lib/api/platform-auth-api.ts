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
  accessInquiry?: {
    id: string
    status: string
    isApproved?: boolean
  } | null
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

export class PlatformAuthApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = "PlatformAuthApiError"
  }
}

async function platformAuthJson<T>(
  path: string,
  input: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: input.method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    })
  } catch {
    throw new PlatformAuthApiError(503, "NETWORK_ERROR", "We could not reach the server. Please try again.")
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: PlatformAuthError | { code?: string; message?: string } }

  if (!response.ok) {
    const err = normalizeError(payload)
    throw new PlatformAuthApiError(response.status, err.code ?? "AUTH_ERROR", err.message ?? "Request failed.", err.detail)
  }

  return payload as T
}

export async function requestPlatformPasswordReset(email: string): Promise<{ ok: true; message: string }> {
  return platformAuthJson("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  })
}

export async function validatePlatformPasswordResetToken(token: string): Promise<{ ok: true }> {
  const query = new URLSearchParams({ token })
  return platformAuthJson(`/api/auth/reset-password/validate?${query}`, { method: "GET" })
}

export async function completePlatformPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: true; message: string }> {
  return platformAuthJson("/api/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  })
}

export async function changePlatformPassword(
  currentPassword: string,
  newPassword: string,
): Promise<PlatformAuthResponse> {
  let response: Response
  try {
    response = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  } catch {
    throw new PlatformAuthApiError(503, "NETWORK_ERROR", "We could not reach the server. Please try again.")
  }

  const payload = (await response.json().catch(() => ({}))) as PlatformAuthResponse & {
    error?: PlatformAuthError | { code?: string; message?: string }
  }

  if (!response.ok) {
    const err = normalizeError(payload)
    throw new PlatformAuthApiError(response.status, err.code ?? "AUTH_ERROR", err.message ?? "Request failed.", err.detail)
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
