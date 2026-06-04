import type { SubscriberEntitlementRow } from "@/lib/app-user-profile-store"
import { formatDownloadQuotaLabel, isEntitlementCurrentlyValid } from "@/lib/app-user-profile-store"
import {
  formatAssetInterestType,
  formatEntitlementStatus,
  formatImageQualityPreference,
} from "@/lib/staff/access-inquiry-labels"

export function formatEntitlementQualityDescription(qualityAccess: string): string {
  const level = (qualityAccess ?? "").trim().toUpperCase()
  if (level === "LOW") return "Web resolution"
  if (level === "MEDIUM") return "Up to medium resolution"
  if (level === "HIGH") return "Up to large / full resolution"
  return formatImageQualityPreference(qualityAccess)
}

export function formatEntitlementDownloadsLine(row: SubscriberEntitlementRow): string {
  if (row.allowedDownloads === null) return `${row.downloadsUsed} used · limit not set`
  return formatDownloadQuotaLabel(row.downloadsUsed, row.allowedDownloads)
}

export function formatEntitlementValidity(row: SubscriberEntitlementRow): string | null {
  if (!row.validUntil) return null
  const date = row.validUntil instanceof Date ? row.validUntil : new Date(row.validUntil)
  if (Number.isNaN(date.getTime())) return null
  return `Valid until ${new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)}`
}

export function partitionSubscriberEntitlements(rows: SubscriberEntitlementRow[]) {
  const activeNow: SubscriberEntitlementRow[] = []
  const other: SubscriberEntitlementRow[] = []

  for (const row of rows) {
    if (isEntitlementCurrentlyValid(row)) activeNow.push(row)
    else other.push(row)
  }

  return { activeNow, other }
}

export function formatEntitlementAssetLabel(assetType: string): string {
  return formatAssetInterestType(assetType)
}

export function formatEntitlementStatusLabel(status: string): string {
  return formatEntitlementStatus(status)
}
