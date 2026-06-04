import {
  CONTRIBUTOR_DASHBOARD_PATH,
  staffPrimaryHref,
} from "@/lib/auth-post-login"
import type {
  AuthSessionKind,
  UnifiedAuthSession,
  UnifiedAuthSessionContributor,
  UnifiedAuthSessionStaff,
  UnifiedAuthSessionUser,
} from "@/lib/auth-session-types"

interface PlatformSessionPayload {
  ownerType: "USER" | "CONTRIBUTOR"
  user?: {
    id: string
    email: string
    displayName?: string | null
    username?: string | null
  } | null
  contributor?: {
    id: string
    displayName: string
    username: string
    email?: string | null
  } | null
}

interface StaffMePayload {
  staff: {
    id: string
    username: string
    displayName: string
    role: string
  }
}

export function buildUnifiedSessionFromPlatform(payload: PlatformSessionPayload): UnifiedAuthSession | null {
  if (payload.ownerType === "CONTRIBUTOR" && payload.contributor) {
    const contributor: UnifiedAuthSessionContributor = {
      id: payload.contributor.id,
      displayName: payload.contributor.displayName,
      username: payload.contributor.username,
      email: payload.contributor.email ?? null,
    }
    return {
      kind: "contributor",
      displayName: contributor.displayName.trim() || contributor.username,
      email: contributor.email,
      primaryHref: CONTRIBUTOR_DASHBOARD_PATH,
      contributor,
    }
  }

  if (payload.ownerType === "USER" && payload.user) {
    const user: UnifiedAuthSessionUser = {
      id: payload.user.id,
      email: payload.user.email,
      name: payload.user.displayName ?? null,
    }
    return {
      kind: "user",
      displayName: (user.name ?? "").trim() || user.email,
      email: user.email,
      primaryHref: "/account/fotobox",
      user,
    }
  }

  return null
}

export function buildUnifiedSessionFromStaff(payload: StaffMePayload): UnifiedAuthSession {
  const staff: UnifiedAuthSessionStaff = {
    id: payload.staff.id,
    username: payload.staff.username,
    displayName: payload.staff.displayName,
    role: payload.staff.role,
  }
  const displayName = staff.displayName.trim() || staff.username
  return {
    kind: "staff",
    displayName,
    staffRole: staff.role,
    primaryHref: staffPrimaryHref(staff.role),
    staff,
  }
}

export function isSignedInSession(session: UnifiedAuthSession | null | undefined): session is UnifiedAuthSession {
  return Boolean(session?.kind)
}

export function sessionKindLabel(kind: AuthSessionKind): string {
  if (kind === "staff") return "Staff"
  if (kind === "contributor") return "Contributor"
  return "Account"
}
