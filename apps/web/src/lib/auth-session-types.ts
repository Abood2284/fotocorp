export type AuthSessionKind = "user" | "contributor" | "staff"

export interface UnifiedAuthSessionUser {
  id: string
  email: string
  name?: string | null
}

export interface UnifiedAuthSessionContributor {
  id: string
  displayName: string
  username: string
  email?: string | null
}

export interface UnifiedAuthSessionStaff {
  id: string
  username: string
  displayName: string
  role: string
}

export interface UnifiedAuthSession {
  kind: AuthSessionKind
  displayName: string
  email?: string | null
  staffRole?: string
  primaryHref: string
  user?: UnifiedAuthSessionUser
  contributor?: UnifiedAuthSessionContributor
  staff?: UnifiedAuthSessionStaff
}

/** @deprecated Use UnifiedAuthSession; kept for gradual migration of subscriber-only callers. */
export interface SharedAuthSession {
  kind?: AuthSessionKind
  displayName?: string
  primaryHref?: string
  user?: UnifiedAuthSessionUser | null
  contributor?: UnifiedAuthSessionContributor
  staff?: UnifiedAuthSessionStaff
}
