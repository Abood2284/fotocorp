

import type { StaffRole } from "@/lib/staff/staff-route-access"
import { Images, ClosedCaption, Calendar, LayoutDashboard, Inbox, MessageCircle, ShieldCheck, Users, Sparkles, BarChart3, PenLine } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface StaffNavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: readonly StaffRole[]
}

export const STAFF_ACCESS_INQUIRIES_HREF = "/staff/access-inquiries"

/** Sidebar navigation definitions; filter by `roles.includes(staffRole)`. */
export const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    label: "Dashboard",
    href: "/staff/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "FINANCE", "SUPPORT"],
  },
  {
    label: "Caricatures",
    href: "/staff/caricatures",
    icon: PenLine,
    roles: ["SUPER_ADMIN", "CAPTION_WRITER"],
  },
  {
    label: "Uploads",
    href: "/staff/contributor-uploads",
    icon: Inbox,
    roles: ["SUPER_ADMIN", "CAPTION_WRITER"],
  },
  {
    label: "Inquiries",
    href: STAFF_ACCESS_INQUIRIES_HREF,
    icon: MessageCircle,
    roles: ["SUPER_ADMIN", "SUPPORT", "FINANCE"],
  },
  {
    label: "Catalog",
    href: "/staff/catalog",
    icon: Images,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER", "CAPTION_WRITER"],
  },
  {
    label: "Homepage Hero",
    href: "/staff/homepage-hero",
    icon: Sparkles,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER", "CAPTION_WRITER"],
  },
  {
    label: "Events",
    href: "/staff/events",
    icon: Calendar,
    roles: ["SUPER_ADMIN", "CAPTION_WRITER"],
  },
  {
    label: "Captions",
    href: "/staff/captions",
    icon: ClosedCaption,
    roles: ["SUPER_ADMIN", "CAPTION_MANAGER", "CAPTION_WRITER"],
  },
  {
    label: "Users",
    href: "/staff/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Audit",
    href: "/staff/audit",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Performance",
    href: "/staff/team-performance",
    icon: BarChart3,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Staff",
    href: "/staff/staff-users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
]

export function staffNavItemsForRole(role: string): StaffNavItem[] {
  const r = role as StaffRole
  return STAFF_NAV_ITEMS.filter((item) => item.roles.includes(r))
}
