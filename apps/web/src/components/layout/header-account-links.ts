import type { LucideIcon } from "lucide-react"
import {
  Archive,
  Camera,
  ClosedCaption,
  CloudUpload,
  Download,
  Gauge,
  Image,
  Inbox,
  Shield,
  UserRound,
  Users,
} from "lucide-react"

import type { UnifiedAuthSession } from "@/lib/auth-session-types"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"

interface HeaderUserProfileSubset {
  email: string
  displayName: string | null
  isSubscriber: boolean
  subscriptionStatus: string
}

export type AccountLink = { label: string; href: string; icon: LucideIcon }

export function getSessionDisplayName(
  session: UnifiedAuthSession,
  userProfile?: HeaderUserProfileSubset | null,
): string {
  const profileName = userProfile?.displayName?.trim()
  if (profileName && session.kind === "user") return profileName
  return session.displayName.trim() || "Your account"
}

export function getSessionSubtitle(
  session: UnifiedAuthSession,
  userProfile?: HeaderUserProfileSubset | null,
): string | null {
  if (session.kind === "staff") return null
  return session.email ?? userProfile?.email ?? null
}

function getPrimaryAccountLink(session: UnifiedAuthSession): AccountLink {
  if (session.kind === "user") {
    return { label: "My Fotobox", href: session.primaryHref, icon: Archive }
  }
  if (session.kind === "contributor") {
    return { label: "Dashboard", href: session.primaryHref, icon: Camera }
  }
  return { label: "Dashboard", href: session.primaryHref, icon: Gauge }
}

function getStaffToolAccountLinks(role: string): AccountLink[] {
  const candidates: AccountLink[] = [
    { label: "Staff dashboard", href: "/staff/dashboard", icon: Gauge },
    { label: "Contributor uploads", href: "/staff/contributor-uploads", icon: Inbox },
    { label: "Captions", href: "/staff/captions", icon: ClosedCaption },
    { label: "Catalog", href: "/staff/catalog", icon: Image },
    { label: "Users", href: "/staff/users", icon: Users },
    { label: "Audit", href: "/staff/audit", icon: Shield },
  ]
  return candidates.filter((item) => staffRoleCanAccessPath(role, item.href))
}

function isActiveSubscriber(userProfile: HeaderUserProfileSubset) {
  return userProfile.isSubscriber && userProfile.subscriptionStatus === "ACTIVE"
}

export function getAccountLinksFromSession(
  session: UnifiedAuthSession,
  userProfile?: HeaderUserProfileSubset | null,
): AccountLink[] {
  const primary = getPrimaryAccountLink(session)

  if (session.kind === "staff") {
    const role = session.staffRole ?? session.staff?.role ?? "SUPPORT"
    const secondary = getStaffToolAccountLinks(role).filter((item) => item.href !== primary.href)
    return [primary, ...secondary]
  }

  if (session.kind === "contributor") {
    const secondary: AccountLink[] = [
      { label: "Uploads", href: "/contributor/uploads", icon: CloudUpload },
      { label: "Download reports", href: "/contributor/download-reports", icon: Download },
    ]
    return [primary, ...secondary]
  }

  const secondary: AccountLink[] = [
    { label: "My account", href: "/account", icon: UserRound },
    { label: "My downloads", href: "/account/downloads", icon: Download },
    {
      label: userProfile && isActiveSubscriber(userProfile) ? "Download access" : "Subscription",
      href: "/account/subscription",
      icon: Shield,
    },
  ]

  return [primary, ...secondary.filter((item) => item.href !== primary.href)]
}

export function getMobileRoleLinksFromSession(session: UnifiedAuthSession | null | undefined): {
  title: string
  links: { label: string; href: string }[]
} | null {
  if (!session) return null

  if (session.kind === "staff") {
    const role = session.staffRole ?? session.staff?.role ?? "SUPPORT"
    const links = [
      { label: "Dashboard", href: session.primaryHref },
      { label: "Contributor uploads", href: "/staff/contributor-uploads" },
      { label: "Captions", href: "/staff/captions" },
      { label: "Catalog", href: "/staff/catalog" },
    ].filter((item) => staffRoleCanAccessPath(role, item.href))
    return { title: "Workspace", links }
  }

  if (session.kind === "contributor") {
    return {
      title: "Workspace",
      links: [
        { label: "Dashboard", href: session.primaryHref },
        { label: "Uploads", href: "/contributor/uploads" },
        { label: "Download reports", href: "/contributor/download-reports" },
      ],
    }
  }

  return {
    title: "Account",
    links: [
      { label: "My Fotobox", href: session.primaryHref },
      { label: "My account", href: "/account" },
      { label: "My downloads", href: "/account/downloads" },
    ],
  }
}
