import "client-only"

import { staffFetch, staffJson } from "./staff-api"

export interface CustomerUser {
  id: string
  authUserId: string
  email: string
  displayName: string | null
  companyName: string | null
  jobTitle: string | null
  status: "ACTIVE" | "SUSPENDED"
  isSubscriber: boolean
  subscriptionStatus: "NONE" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED"
  subscriptionPlanId: string | null
  downloadQuotaLimit: number | null
  downloadQuotaUsed: number
  createdAt: string
  updatedAt: string
}

export interface CustomerUserDetail {
  user: CustomerUser & {
    companyEmail: string | null
    firstName: string | null
    lastName: string | null
    companyType: string | null
  }
  entitlements: Array<{
    id: string
    assetType: string
    allowedDownloads: number | null
    downloadsUsed: number
    qualityAccess: string
    status: string
    validFrom: string | null
    validUntil: string | null
    createdAt: string
    updatedAt: string
  }>
  recentDownloads: Array<{
    id: string
    assetId: string
    size: string
    status: string
    createdAt: string
  }>
}

export interface StaffUser {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export async function listCustomerUsers(searchParams: URLSearchParams): Promise<{ items: CustomerUser[] }> {
  const query = searchParams.toString()
  return staffJson<{ items: CustomerUser[] }>({
    path: `/api/staff/users${query ? `?${query}` : ""}`,
  })
}

export async function getCustomerUserDetail(authUserId: string): Promise<CustomerUserDetail> {
  return staffJson<CustomerUserDetail>({
    path: `/api/staff/users/${encodeURIComponent(authUserId)}`,
  })
}

export async function suspendCustomerUser(authUserId: string) {
  return staffJson<{ status: string }>({
    path: `/api/staff/users/${encodeURIComponent(authUserId)}/suspend`,
    method: "POST",
  })
}

export async function unsuspendCustomerUser(authUserId: string) {
  return staffJson<{ status: string }>({
    path: `/api/staff/users/${encodeURIComponent(authUserId)}/unsuspend`,
    method: "POST",
  })
}

export async function resetCustomerPassword(authUserId: string) {
  return staffJson<{ ok: boolean }>({
    path: `/api/staff/users/${encodeURIComponent(authUserId)}/reset-password`,
    method: "POST",
  })
}

export async function listStaffUsers() {
  return staffJson<{ items: StaffUser[] }>({
    path: "/api/staff/staff-users",
  })
}

export async function createStaffUser(payload: Record<string, string>) {
  return staffJson<{ id: string }>({
    path: "/api/staff/staff-users",
    method: "POST",
    body: payload,
  })
}

export async function updateStaffRole(staffId: string, role: string) {
  return staffJson<{ id: string }>({
    path: `/api/staff/staff-users/${encodeURIComponent(staffId)}`,
    method: "PATCH",
    body: { role },
  })
}

export async function setStaffStatus(staffId: string, action: "enable" | "disable") {
  return staffJson<{ id: string }>({
    path: `/api/staff/staff-users/${encodeURIComponent(staffId)}/${action}`,
    method: "POST",
  })
}

export async function resetStaffPassword(staffId: string, newPasswordPlain: string) {
  return staffJson<{ id: string }>({
    path: `/api/staff/staff-users/${encodeURIComponent(staffId)}/reset-password`,
    method: "POST",
    body: { newPasswordPlain },
  })
}
