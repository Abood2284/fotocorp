

import type { StaffRole } from "@/lib/staff/staff-route-access"
import { Images, ClosedCaption, Database, Calendar, LayoutDashboard, Inbox, MessageCircle, ShieldCheck, Users, ArrowRight, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
    label: "Uploads",
    href: "/staff/contributor-uploads",
        icon: Inbox,
    roles: ["SUPER_ADMIN", "CAPTION_WRITER"],
  },
  {
    label: "Inquiries",
    href: "/staff/access-inquiries",
    icon: MessageCircle,
    roles: ["SUPER_ADMIN", "SUPPORT", "FINANCE"],
  },
  {
    label: "Catalog",
    href: "/staff/catalog",
    icon: Images,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER"],
  },
  {
    label: "Homepage Hero",
    href: "/staff/homepage-hero",
    icon: Sparkles,
    roles: ["SUPER_ADMIN", "CATALOG_MANAGER"],
  },
  {
    label: "Events",
    href: "/staff/events",
    icon: Calendar,
    roles: ["SUPER_ADMIN"],
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
