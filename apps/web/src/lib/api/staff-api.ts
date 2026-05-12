export const FOTOCORP_STAFF_SESSION_COOKIE = "fotocorp_staff_session"

export interface StaffAuthStaff {
  id: string
  username: string
  displayName: string
  role: string
  status: string
}

export interface StaffMeResponse {
  ok: true
  staff: StaffAuthStaff
}

export class StaffApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "StaffApiError"
  }
}

export async function loginStaff(username: string, password: string) {
  return staffJson<StaffMeResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  })
}

export async function logoutStaff() {
  return staffJson<{ ok: true }>("/auth/logout", { method: "POST" })
}

export async function getStaffMe(options: { cookieHeader?: string } = {}) {
  return staffJson<StaffMeResponse>("/auth/me", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

async function staffJson<T>(
  path: string,
  input: {
    method: "GET" | "POST"
    body?: unknown
    cookieHeader?: string
  },
): Promise<T> {
  const response = await fetch(resolveStaffUrl(path), {
    method: input.method,
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(input.body ? { "Content-Type": "application/json" } : {}),
      ...(input.cookieHeader ? { Cookie: input.cookieHeader } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  })

  if (!response.ok) {
    const error = await readStaffApiError(response)
    throw new StaffApiError(response.status, error.code, error.message)
  }

  return response.json() as Promise<T>
}

function resolveStaffUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (typeof window !== "undefined") return `/api/staff${normalized}`

  const base = process.env.INTERNAL_API_BASE_URL?.trim().replace(/\/+$/, "")
  if (!base) throw new StaffApiError(500, "STAFF_API_NOT_CONFIGURED", "Staff API is not configured.")
  return `${base}/api/v1/staff${normalized}`
}

async function readStaffApiError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string }
      ok?: boolean
    }
    return {
      code: body.error?.code ?? "STAFF_API_ERROR",
      message: body.error?.message ?? "Staff request failed.",
    }
  } catch {
    return {
      code: "STAFF_API_ERROR",
      message: "Staff request failed.",
    }
  }
}
