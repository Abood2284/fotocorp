/** Pure helpers — safe to import from client components. */

export type StaffRole =
  | "SUPER_ADMIN"
  | "CATALOG_MANAGER"
  | "REVIEWER"
  | "CAPTION_MANAGER"
  | "FINANCE"
  | "SUPPORT"

const CONTRIBUTOR_UPLOAD_ROLES: StaffRole[] = ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER"]

const CATALOG_ASSET_ROLES: StaffRole[] = ["SUPER_ADMIN", "CATALOG_MANAGER"]

const OPS_ONLY: StaffRole[] = ["SUPER_ADMIN"]

export function getDefaultStaffLandingPath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/staff/dashboard"
    case "CATALOG_MANAGER":
      return "/staff/contributor-uploads"
    case "REVIEWER":
      return "/staff/contributor-uploads"
    case "CAPTION_MANAGER":
      return "/staff/captions"
    case "FINANCE":
    case "SUPPORT":
      return "/staff/dashboard"
    default:
      return "/staff/dashboard"
  }
}

export function resolveStaffPostLoginRedirect(role: string, callbackUrl: string | null): string {
  const fallback = getDefaultStaffLandingPath(role)
  if (!callbackUrl || !callbackUrl.startsWith("/staff")) return fallback
  if (callbackUrl.startsWith("//")) return fallback
  if (staffRoleCanAccessPath(role, callbackUrl)) return callbackUrl
  return fallback
}

export function staffRoleCanAccessPath(role: string, pathname: string): boolean {
  const normalized = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/"

  if (normalized === "/staff/login") return true

  /** Workspace index redirects — any authenticated staff may hit `/staff` briefly. */
  if (normalized === "/staff") return true

  if (role === "SUPER_ADMIN") return true

  const r = role as StaffRole

  if (normalized === "/staff/forbidden") {
    return ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "CAPTION_MANAGER", "FINANCE", "SUPPORT"].includes(r)
  }

  if (normalized === "/staff/dashboard") {
    return ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "FINANCE", "SUPPORT"].includes(r)
  }

  if (normalized === "/staff/captions") {
    return ["SUPER_ADMIN", "CAPTION_MANAGER"].includes(r)
  }

  if (normalized.startsWith("/staff/contributor-uploads")) {
    return CONTRIBUTOR_UPLOAD_ROLES.includes(r)
  }

  if (normalized.startsWith("/staff/access-inquiries")) {
    return ["SUPER_ADMIN", "SUPPORT", "FINANCE"].includes(r)
  }



  if (normalized === "/staff/catalog" || normalized.startsWith("/staff/catalog/")) {
    return CATALOG_ASSET_ROLES.includes(r)
  }

  if (normalized.startsWith("/staff/media-pipeline")) {
    return OPS_ONLY.includes(r)
  }

  if (
    normalized.startsWith("/staff/users") ||
    normalized.startsWith("/staff/ingestion") ||
    normalized.startsWith("/staff/storage") ||
    normalized.startsWith("/staff/audit") ||
    normalized.startsWith("/staff/migration") ||
    normalized.startsWith("/staff/staff-users") ||
    normalized.startsWith("/staff/events")
  ) {
    return OPS_ONLY.includes(r)
  }

  return false
}
