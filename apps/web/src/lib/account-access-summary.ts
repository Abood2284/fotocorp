import type { AppUserProfile } from "@/lib/app-user-profile-store"
import { formatDownloadQuotaLabel } from "@/lib/app-user-profile-store"

export interface AccountCapability {
  id: string
  title: string
  description: string
  enabled: boolean
}

export function buildAccountCapabilities(appUser: AppUserProfile): AccountCapability[] {
  const subscriber =
    appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"

  return [
    {
      id: "browse",
      title: "Browse the archive",
      description:
        "Search editorial imagery, open asset detail pages, and view watermarked previews.",
      enabled: true,
    },
    {
      id: "fotobox",
      title: "Save to Fotobox",
      description:
        "Collect images you are considering so you can review them before licensing.",
      enabled: true,
    },
    {
      id: "download",
      title: "Download clean files",
      description: subscriber
        ? "Your staff-approved access includes clean downloads where licensing permits."
        : "Requires staff-approved download access. You can request access anytime.",
      enabled: subscriber,
    },
  ]
}

export function resolveAccessHeadline(appUser: AppUserProfile): {
  title: string
  description: string
} {
  const subscriber =
    appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"

  if (subscriber) {
    return {
      title: "Subscriber access is active",
      description:
        "You can download clean files within your approved limits. Browse, Fotobox, and download history stay available from this account.",
    }
  }

  if (appUser.subscriptionStatus === "NONE" || appUser.subscriptionStatus === "EXPIRED") {
    return {
      title: "Browse and save — downloads need approval",
      description:
        "You have full access to search and Fotobox. Tell our team what you need and we will email you when download access is ready.",
    }
  }

  return {
    title: "Access is being set up",
    description:
      "Your account is active for browsing and Fotobox. Download access may still be pending staff review.",
  }
}

export function formatAccountDisplayName(appUser: AppUserProfile): string {
  const name = appUser.displayName?.trim()
  if (name) return name
  const local = appUser.email.split("@")[0]?.trim()
  return local || "Your account"
}

export function formatQuotaSummary(
  downloadUsed: number,
  downloadLimit: number | null,
): string {
  return formatDownloadQuotaLabel(downloadUsed, downloadLimit)
}
