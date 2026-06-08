import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth-redirect"
import {
  getDefaultStaffLandingPath,
  resolveStaffPostLoginRedirect,
  staffRoleCanAccessPath,
  staffRoleIsWorkspaceOnly,
} from "@/lib/staff/staff-route-access"

export const CONTRIBUTOR_DASHBOARD_PATH = "/contributor/dashboard"
export const ACCESS_PENDING_PATH = "/account/access-pending"

export type PlatformOwnerType = "USER" | "CONTRIBUTOR"

export function isSubscriberAccessInquiryApproved(status: string | null | undefined): boolean {
  if (!status) return true
  return status === "ACCESS_GRANTED"
}

function isSafeRelativePath(path: string | null | undefined): path is string {
  if (!path) return false
  if (!path.startsWith("/")) return false
  if (path.startsWith("//")) return false
  return true
}

export function isSafeSubscriberCallback(path: string | null | undefined): path is string {
  if (!isSafeRelativePath(path)) return false
  if (path.startsWith("/staff")) return false
  if (path.startsWith("/contributor")) return false
  return true
}

export function isSafeContributorCallback(path: string | null | undefined): path is string {
  if (!isSafeRelativePath(path)) return false
  return path === "/contributor" || path.startsWith("/contributor/")
}

export function isSafeStaffCallback(path: string | null | undefined): path is string {
  if (!isSafeRelativePath(path)) return false
  return path === "/staff" || path.startsWith("/staff/")
}

export function resolvePlatformPostLoginRedirect(
  ownerType: PlatformOwnerType,
  callbackUrl: string | null | undefined,
  options?: { accessInquiryStatus?: string | null },
): string {
  if (ownerType === "CONTRIBUTOR") {
    if (isSafeContributorCallback(callbackUrl)) return callbackUrl
    return CONTRIBUTOR_DASHBOARD_PATH
  }

  if (!isSubscriberAccessInquiryApproved(options?.accessInquiryStatus)) {
    if (isSafeSubscriberCallback(callbackUrl) && callbackUrl === ACCESS_PENDING_PATH) {
      return callbackUrl
    }
    return ACCESS_PENDING_PATH
  }

  if (isSafeSubscriberCallback(callbackUrl)) return callbackUrl
  return DEFAULT_AUTH_REDIRECT
}

/** Staff signing in via unified gateway: homepage by default; honor safe /staff callback. */
export function resolveStaffPostLoginRedirectFromSignIn(
  role: string,
  callbackUrl: string | null | undefined,
): string {
  if (staffRoleIsWorkspaceOnly(role)) {
    return resolveStaffPostLoginRedirect(role, callbackUrl ?? null)
  }
  if (isSafeStaffCallback(callbackUrl) && staffRoleCanAccessPath(role, callbackUrl)) {
    return callbackUrl
  }
  return DEFAULT_AUTH_REDIRECT
}

/** Staff workspace guards may still use role landing paths when no public callback applies. */
export function resolveStaffWorkspacePostLoginRedirect(
  role: string,
  callbackUrl: string | null | undefined,
): string {
  return resolveStaffPostLoginRedirect(role, callbackUrl ?? null)
}

export function resolveSignedInPageRedirect(input: {
  kind: "user" | "contributor" | "staff"
  staffRole?: string
  callbackUrl: string | null | undefined
  accessInquiryStatus?: string | null
}): string {
  if (input.kind === "contributor") {
    return resolvePlatformPostLoginRedirect("CONTRIBUTOR", input.callbackUrl)
  }
  if (input.kind === "staff") {
    return resolveStaffPostLoginRedirectFromSignIn(input.staffRole ?? "", input.callbackUrl)
  }
  return resolvePlatformPostLoginRedirect("USER", input.callbackUrl, {
    accessInquiryStatus: input.accessInquiryStatus,
  })
}

export function isPlatformInvalidCredentials(error: { code?: string } | undefined): boolean {
  return error?.code === "INVALID_CREDENTIALS"
}

export function isPlatformAccessPendingReview(error: { code?: string } | undefined): boolean {
  return error?.code === "ACCESS_PENDING_REVIEW"
}

export function staffPrimaryHref(role: string): string {
  return getDefaultStaffLandingPath(role)
}
