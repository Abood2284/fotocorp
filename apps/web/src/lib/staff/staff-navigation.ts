import type { LucideIcon } from "lucide-react"
import {
  Images,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  Subtitles,
  Users,
  Workflow,
  Database,
  UserCog,
} from "lucide-react"
import type { StaffRole } from "@/lib/staff/staff-route-access"

export interface StaffNavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: readonly StaffRole[]
}

/** Sidebar navigation definitions; filter by `roles.includes(staffRole)`. */
export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    label: "Dashboard",
    href: "/staff/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "FINANCE", "SUPPORT"],
  },
  {
    label: "Contributor uploads",
    href: "/staff/contributor-uploads",
    icon: Inbox,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER"],
  },
  {
    label: "Catalog",
    href: "/staff/assets",
    icon: Images,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER"],
  },
  {
    label: "Caption management",
    href: "/staff/caption-management",
    icon: Subtitles,
    roles: ["SUPER_ADMIN", "CAPTION_MANAGER"],
  },
  {
    label: "Users",
    href: "/staff/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Ingestion",
    href: "/staff/ingestion",
    icon: Workflow,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Storage",
    href: "/staff/storage",
    icon: Database,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Audit",
    href: "/staff/audit",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Staff users",
    href: "/staff/staff-users",
    icon: UserCog,
    roles: ["SUPER_ADMIN"],
  },
]

export function staffNavItemsForRole(role: string): StaffNavItem[] {
  const r = role as StaffRole
  return STAFF_NAV_ITEMS.filter((item) => item.roles.includes(r))
}
