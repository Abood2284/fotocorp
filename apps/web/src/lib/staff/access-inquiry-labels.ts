export function formatInquiryStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim().toUpperCase()
  if (s === "PENDING") return "Pending"
  if (s === "IN_REVIEW") return "In review"
  if (s === "CLOSED") return "Closed"
  if (s === "ACCESS_GRANTED") return "Access granted"
  return status?.replace(/_/g, " ") ?? "—"
}

export function formatAssetInterestType(value: string | null | undefined): string {
  const u = (value ?? "").trim().toUpperCase()
  if (u === "IMAGE") return "Images"
  if (u === "VIDEO") return "Video"
  if (u === "CARICATURE") return "Caricature"
  return value ?? "—"
}

export function formatImageQuantityRange(range: string | null | undefined): string {
  const r = (range ?? "").trim()
  if (r === "0_20") return "0–20"
  if (r === "20_50") return "20–50"
  if (r === "50_100") return "50–100"
  if (r === "100_250") return "100–250"
  if (r === "250_plus") return "250+"
  return range?.replace(/_/g, " ") ?? "—"
}

export function formatImageQualityPreference(pref: string | null | undefined): string {
  const u = (pref ?? "").trim().toUpperCase()
  if (u === "LOW") return "Low"
  if (u === "MEDIUM") return "Medium"
  if (u === "HIGH") return "High"
  return pref ?? "—"
}

export function formatEntitlementStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim().toUpperCase()
  if (s === "DRAFT") return "Draft"
  if (s === "ACTIVE") return "Active"
  if (s === "SUSPENDED") return "Suspended"
  if (s === "EXPIRED") return "Expired"
  if (s === "CANCELLED") return "Cancelled"
  return status ?? "—"
}

export function formatSubscriberAccessLine(input: { isSubscriber?: boolean; subscriptionStatus?: string } | null | undefined): string {
  if (!input) return "Unknown"
  if (input.isSubscriber && input.subscriptionStatus === "ACTIVE") return "Active subscriber"
  if (input.subscriptionStatus && input.subscriptionStatus !== "NONE") {
    return `Subscription: ${input.subscriptionStatus.replace(/_/g, " ").toLowerCase()}`
  }
  return "Not an active subscriber"
}

export function summarizeEntitlementsForHeader(
  entitlements: Array<{ status?: string | null }>,
): string {
  if (!entitlements.length) return "None yet"
  const counts = new Map<string, number>()
  for (const e of entitlements) {
    const s = String(e.status ?? "").toUpperCase() || "UNKNOWN"
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const [status, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    parts.push(`${n} ${formatEntitlementStatus(status).toLowerCase()}`)
  }
  return parts.join(" · ")
}
