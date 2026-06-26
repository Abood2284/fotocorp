/** Pure helpers — safe to import from client components. */

export type StaffRole =
  | "SUPER_ADMIN"
  | "CATALOG_MANAGER"
  | "REVIEWER"
  | "CAPTION_MANAGER"
  | "CAPTION_WRITER"
  | "FINANCE"
  | "SUPPORT"

const CONTRIBUTOR_UPLOAD_ROLES: StaffRole[] = ["SUPER_ADMIN", "CAPTION_WRITER"]

const CAPTION_ROUTE_ROLES: StaffRole[] = ["SUPER_ADMIN", "CAPTION_MANAGER", "CAPTION_WRITER"]

const CATALOG_ASSET_ROLES: StaffRole[] = ["SUPER_ADMIN", "CATALOG_MANAGER", "CAPTION_WRITER"]

const EVENT_ROUTE_ROLES: StaffRole[] = ["SUPER_ADMIN", "CAPTION_WRITER"]

const OPS_ONLY: StaffRole[] = ["SUPER_ADMIN"]

export function staffCanAccessContributorUploads(role: string): boolean {
  if (role === "SUPER_ADMIN") return true
  return CONTRIBUTOR_UPLOAD_ROLES.includes(role as StaffRole)
}

/** Staff roles that must remain inside `/staff/*` and cannot browse the public site. */
export function staffRoleIsWorkspaceOnly(role: string): boolean {
  return role === "CAPTION_WRITER"
}

export function getDefaultStaffLandingPath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/staff/dashboard"
    case "CATALOG_MANAGER":
      return "/staff/catalog"
    case "REVIEWER":
      return "/staff/dashboard"
    case "CAPTION_WRITER":
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
    return [
      "SUPER_ADMIN",
      "CATALOG_MANAGER",
      "REVIEWER",
      "CAPTION_MANAGER",
      "CAPTION_WRITER",
      "FINANCE",
      "SUPPORT",
    ].includes(r)
  }

  if (normalized === "/staff/dashboard") {
    return ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "FINANCE", "SUPPORT"].includes(r)
  }

  if (normalized === "/staff/captions") {
    return CAPTION_ROUTE_ROLES.includes(r)
  }

  if (normalized.startsWith("/staff/contributor-uploads")) {
    return CONTRIBUTOR_UPLOAD_ROLES.includes(r)
  }

  if (normalized.startsWith("/staff/caricatures")) {
    return CONTRIBUTOR_UPLOAD_ROLES.includes(r)
  }

  if (normalized.startsWith("/staff/access-inquiries")) {
    return ["SUPER_ADMIN", "SUPPORT", "FINANCE"].includes(r)
  }

  if (/^\/staff\/catalog\/[^/]+\/preview-image$/.test(normalized)) {
    return CAPTION_ROUTE_ROLES.includes(r)
  }

  if (normalized === "/staff/catalog" || normalized.startsWith("/staff/catalog/")) {
    return CATALOG_ASSET_ROLES.includes(r)
  }

  if (normalized === "/staff/homepage-hero" || normalized.startsWith("/staff/homepage-hero/")) {
    return CATALOG_ASSET_ROLES.includes(r)
  }

  if (normalized === "/staff/events" || normalized.startsWith("/staff/events/")) {
    return EVENT_ROUTE_ROLES.includes(r)
  }

  if (
    normalized.startsWith("/staff/users") ||
    normalized.startsWith("/staff/audit") ||
    normalized.startsWith("/staff/team-performance") ||
    normalized.startsWith("/staff/migration") ||
    normalized.startsWith("/staff/staff-users")
  ) {
    return OPS_ONLY.includes(r)
  }

  if (normalized === "/staff/pipeline" || normalized.startsWith("/staff/pipeline/")) {
    return ["SUPER_ADMIN", "CATALOG_MANAGER"].includes(r)
  }

  if (normalized === "/staff/help/manage" || normalized.startsWith("/staff/help/manage/")) {
    return ["SUPER_ADMIN", "CATALOG_MANAGER"].includes(r)
  }

  if (normalized === "/staff/help" || normalized.startsWith("/staff/help/")) {
    return [
      "SUPER_ADMIN",
      "CATALOG_MANAGER",
      "REVIEWER",
      "CAPTION_MANAGER",
      "CAPTION_WRITER",
      "FINANCE",
      "SUPPORT",
    ].includes(r)
  }

  return false
}
