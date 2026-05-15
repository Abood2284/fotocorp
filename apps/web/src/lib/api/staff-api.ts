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
    method: "GET" | "POST" | "PATCH"
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
      ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(input.cookieHeader ? { Cookie: input.cookieHeader } : {}),
    },
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  })

  if (!response.ok) {
    const error = await readStaffApiError(response)
    throw new StaffApiError(response.status, error.code, error.message)
  }

  return response.json() as Promise<T>
}

export interface StaffAccessInquiryListItem {
  inquiryId: string
  status: string
  authUserId: string
  interestedAssetTypes: string[]
  imageQuantityRange: string | null
  imageQualityPreference: string | null
  createdAt: string
  companyName: string
  companyEmail: string
  firstName: string
  lastName: string
}

export async function getStaffAccessInquiries(options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; items: StaffAccessInquiryListItem[] }>("/access-inquiries", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getStaffAccessInquiryDetail(inquiryId: string, options: { cookieHeader?: string } = {}) {
  return staffJson<{
    ok: true
    inquiry: Record<string, unknown>
    companyName: string
    companyEmail: string
    firstName: string
    lastName: string
    jobTitle: string
    companyType: string
    subscriberAccess: { isSubscriber: boolean; subscriptionStatus: string }
    entitlements: Record<string, unknown>[]
  }>(`/access-inquiries/${encodeURIComponent(inquiryId)}`, { method: "GET", cookieHeader: options.cookieHeader })
}

export async function postStaffAccessInquiryEntitlementDraft(inquiryId: string, options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; entitlements: Record<string, unknown>[] }>(
    `/access-inquiries/${encodeURIComponent(inquiryId)}/entitlement-draft`,
    { method: "POST", body: {}, cookieHeader: options.cookieHeader },
  )
}

export async function patchStaffSubscriberEntitlement(
  entitlementId: string,
  body: {
    allowedDownloads?: number | null
    qualityAccess?: "LOW" | "MEDIUM" | "HIGH"
    validFrom?: string | null
    validUntil?: string | null
  },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; entitlement: Record<string, unknown> | null }>(
    `/subscriber-entitlements/${encodeURIComponent(entitlementId)}`,
    { method: "PATCH", body, cookieHeader: options.cookieHeader },
  )
}

export async function postStaffSubscriberEntitlementActivate(
  entitlementId: string,
  body: { validUntil?: string | null },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; entitlement: Record<string, unknown> | null }>(
    `/subscriber-entitlements/${encodeURIComponent(entitlementId)}/activate`,
    { method: "POST", body, cookieHeader: options.cookieHeader },
  )
}

export async function postStaffSubscriberEntitlementSuspend(entitlementId: string, options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; entitlement: Record<string, unknown> | null }>(
    `/subscriber-entitlements/${encodeURIComponent(entitlementId)}/suspend`,
    { method: "POST", body: {}, cookieHeader: options.cookieHeader },
  )
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
