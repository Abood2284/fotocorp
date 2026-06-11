export const FOTOCORP_STAFF_SESSION_COOKIE = "fotocorp_staff_session"
const STAFF_API_TIMEOUT_MS = 8_000

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
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), STAFF_API_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(resolveStaffUrl(path), {
      method: input.method,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(input.cookieHeader ? { Cookie: input.cookieHeader } : {}),
      },
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: "staff_api_fetch",
      path,
      method: input.method,
      status: "error",
      durationMs: Date.now() - startedAt,
      timeoutMs: STAFF_API_TIMEOUT_MS,
      timedOut: isAbortError(error),
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error
  } finally {
    clearTimeout(timeout)
  }

  console.info(JSON.stringify({
    event: "staff_api_fetch",
    path,
    method: input.method,
    status: response.status,
    durationMs: Date.now() - startedAt,
    timeoutMs: STAFF_API_TIMEOUT_MS,
  }))

  if (!response.ok) {
    const error = await readStaffApiError(response)
    throw new StaffApiError(response.status, error.code, error.message)
  }

  return response.json() as Promise<T>
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export interface StaffAccessInquiryListItem {
  inquiryId: string
  inquiryType: string
  status: string
  userId: string | null
  contributorId: string | null
  proposedUsername: string | null
  interestedAssetTypes: string[]
  imageQuantityRange: string | null
  imageQualityPreference: string | null
  royaltyFreeQuantityRange: string | null
  royaltyFreeQualityPreference: string | null
  videoQuantityRange: string | null
  caricatureQuantityRange: string | null
  createdAt: string
  companyName: string | null
  companyEmail: string | null
  firstName: string | null
  lastName: string | null
}

export async function getStaffAccessInquiries(
  options: {
    cookieHeader?: string
    inquiryType?: "USER_ACCESS" | "CONTRIBUTOR_APPLICATION"
    status?: string
  } = {},
) {
  const params = new URLSearchParams()
  if (options.inquiryType) params.set("type", options.inquiryType)
  if (options.status) params.set("status", options.status)
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; items: StaffAccessInquiryListItem[] }>(`/access-inquiries${query}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export interface StaffSubmissionAudit {
  ipAddress: string | null
  ipHash: string | null
  country: string | null
  city: string | null
  region: string | null
  regionCode: string | null
  cfRay: string | null
  userAgent: string | null
}

export async function getStaffAccessInquiryDetail(inquiryId: string, options: { cookieHeader?: string } = {}) {
  return staffJson<{
    ok: true
    inquiry: Record<string, unknown>
    submissionAudit: StaffSubmissionAudit
    companyName: string | null
    companyEmail: string | null
    firstName: string | null
    lastName: string | null
    jobTitle: string | null
    customJobTitle: string | null
    companyType: string | null
    email: string | null
    username: string | null
    phoneCountryCode: string | null
    phoneNumber: string | null
    companyEmailDomain: string | null
    emailValidationDecision: string | null
    subscriberAccess: { isSubscriber: boolean; subscriptionStatus: string }
    contributorProfile: { id: string; displayName: string | null; status: string | null; email: string | null } | null
    pendingClaims: Array<{ claimType: string; normalizedValue: string; status: string }>
    entitlements: Record<string, unknown>[]
  }>(`/access-inquiries/${encodeURIComponent(inquiryId)}`, { method: "GET", cookieHeader: options.cookieHeader })
}

export async function postStaffApproveContributorApplication(
  inquiryId: string,
  body: { username?: string },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{
    ok: true
    contributorId: string
    username: string
    temporaryPassword: string
    inquiryId: string
  }>(`/access-inquiries/${encodeURIComponent(inquiryId)}/approve-contributor`, {
    method: "POST",
    body,
    cookieHeader: options.cookieHeader,
  })
}

export async function postStaffCloseAccessInquiry(
  inquiryId: string,
  body: { staffNotes?: string | null } = {},
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; inquiry: Record<string, unknown> }>(
    `/access-inquiries/${encodeURIComponent(inquiryId)}/close`,
    { method: "POST", body, cookieHeader: options.cookieHeader },
  )
}

export async function patchStaffAccessInquiryNotes(
  inquiryId: string,
  body: { staffNotes?: string | null } = {},
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; inquiry: Record<string, unknown> }>(
    `/access-inquiries/${encodeURIComponent(inquiryId)}/notes`,
    { method: "PATCH", body, cookieHeader: options.cookieHeader },
  )
}

export async function postStaffAccessInquiryEntitlementDraft(inquiryId: string, options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; entitlements: Record<string, unknown>[] }>(
    `/access-inquiries/${encodeURIComponent(inquiryId)}/entitlement-draft`,
    { method: "POST", body: {}, cookieHeader: options.cookieHeader },
  )
}

export async function postStaffAccessInquiryActivateAllEntitlements(
  inquiryId: string,
  body: { validUntil?: string | null; entitlementIds?: string[] } = {},
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; entitlements: Record<string, unknown>[] }>(
    `/access-inquiries/${encodeURIComponent(inquiryId)}/activate-entitlements`,
    { method: "POST", body, cookieHeader: options.cookieHeader },
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

export interface StaffMemberListItem {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
}

export async function getStaffMembers(options: { cookieHeader?: string; role?: string } = {}) {
  const params = new URLSearchParams()
  if (options.role) params.set("role", options.role)
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; items: StaffMemberListItem[] }>(`/members${query}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function createStaffMemberAccount(
  body: {
    username: string
    password: string
    displayName?: string
    role?: "CAPTION_WRITER"
  },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; member: StaffMemberListItem }>("/members", {
    method: "POST",
    body: { ...body, role: body.role ?? "CAPTION_WRITER" },
    cookieHeader: options.cookieHeader,
  })
}

export type StaffAuditLogSource = "staff" | "asset" | "user"

export interface StaffAuditLogItem {
  id: string
  source: StaffAuditLogSource
  createdAt: string
  action: string
  entityType: string | null
  entityId: string | null
  actorLabel: string | null
  actorId: string | null
  targetLabel: string | null
  summary: string
  metadata: Record<string, unknown> | null
  entityHref: string | null
}

export async function getStaffAuditLogs(
  options: {
    cookieHeader?: string
    source?: StaffAuditLogSource
    action?: string
    entityType?: string
    from?: string
    to?: string
    limit?: number
    cursor?: string
  } = {},
) {
  const params = new URLSearchParams()
  if (options.source) params.set("source", options.source)
  if (options.action) params.set("action", options.action)
  if (options.entityType) params.set("entityType", options.entityType)
  if (options.from) params.set("from", options.from)
  if (options.to) params.set("to", options.to)
  if (options.limit) params.set("limit", String(options.limit))
  if (options.cursor) params.set("cursor", options.cursor)
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; items: StaffAuditLogItem[]; nextCursor: string | null }>(`/audit-logs${query}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function patchStaffMemberAccount(
  memberId: string,
  body: {
    status?: "ACTIVE" | "DISABLED"
    displayName?: string
    password?: string
  },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; member: StaffMemberListItem }>(`/members/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body,
    cookieHeader: options.cookieHeader,
  })
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
