export function formatInquiryStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim().toUpperCase()
  if (s === "PENDING") return "Pending"
  if (s === "IN_REVIEW") return "In review"
  if (s === "CLOSED") return "Closed"
  if (s === "ACCESS_GRANTED") return "Access granted"
  if (s === "CONTRIBUTOR_APPROVED") return "Contributor approved"
  return status?.replace(/_/g, " ") ?? "—"
}

export function formatInquiryType(type: string | null | undefined): string {
  const t = (type ?? "").trim().toUpperCase()
  if (t === "USER_ACCESS") return "Customer access"
  if (t === "CONTRIBUTOR_APPLICATION") return "Contributor application"
  return type?.replace(/_/g, " ") ?? "—"
}

export function formatAssetInterestType(value: string | null | undefined): string {
  const u = (value ?? "").trim().toUpperCase()
  if (u === "EDITORIAL" || u === "IMAGE") return "Editorial"
  if (u === "ROYALTY_FREE") return "Royalty Free"
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

export function formatCompanyType(value: string | null | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  return raw.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatInquiryDateTime(value: string | null | undefined): string {
  if (!value) return ""
  try {
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return value
  }
}

export type AccessInquiryDetailFieldKind = "text" | "datetime" | "emailValidation" | "assetChips"

export interface AccessInquiryDetailField {
  label: string
  value: string
  href?: string
  kind?: AccessInquiryDetailFieldKind
  title?: string
  chipValues?: string[]
}

export interface AccessInquiryDetailGroup {
  id: "timeline" | "organization" | "contact" | "preferences"
  label: string
  fields: AccessInquiryDetailField[]
}

function hasAssetInterest(interests: string[], ...types: string[]): boolean {
  const normalized = new Set(interests.map((interest) => interest.trim().toUpperCase()))
  return types.some((type) => normalized.has(type))
}

export function formatRelativeTime(value: string | null | undefined): string {
  const fullDate = formatInquiryDateTime(value)
  if (!fullDate) return ""

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return fullDate

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)
  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`

  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`

  const diffYears = Math.round(diffMonths / 12)
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`
}

function buildDetailGroup(
  id: AccessInquiryDetailGroup["id"],
  label: string,
  fields: AccessInquiryDetailField[],
): AccessInquiryDetailGroup | null {
  if (!fields.length) return null
  return { id, label, fields }
}

function pushTextField(
  fields: AccessInquiryDetailField[],
  label: string,
  value: string | null | undefined,
  options?: { href?: string; kind?: AccessInquiryDetailFieldKind; title?: string; chipValues?: string[] },
) {
  const trimmed = String(value ?? "").trim()
  if (!trimmed && !options?.chipValues?.length) return
  fields.push({
    label,
    value: trimmed,
    href: options?.href,
    kind: options?.kind ?? "text",
    title: options?.title,
    chipValues: options?.chipValues,
  })
}

function mergeQuantityQuality(quantity: string | null | undefined, quality: string | null | undefined): string {
  const quantityLabel = quantity ? formatImageQuantityRange(quantity) : ""
  const qualityLabel = quality ? formatImageQualityPreference(quality) : ""
  if (quantityLabel && qualityLabel) return `${quantityLabel} · ${qualityLabel}`
  return quantityLabel || qualityLabel
}

export function buildAccessInquiryDetailGroups(input: {
  inquiry: {
    createdAt?: string | null
    updatedAt?: string | null
    interestedAssetTypes?: string[]
    imageQuantityRange?: string | null
    imageQualityPreference?: string | null
    royaltyFreeQuantityRange?: string | null
    royaltyFreeQualityPreference?: string | null
    videoQuantityRange?: string | null
    caricatureQuantityRange?: string | null
  }
  profile: {
    companyType?: string | null
    jobTitle?: string | null
    customJobTitle?: string | null
    companyEmail?: string | null
    email?: string | null
    companyEmailDomain?: string | null
    phoneCountryCode?: string | null
    phoneNumber?: string | null
    emailValidationDecision?: string | null
    username?: string | null
  }
}): AccessInquiryDetailGroup[] {
  const interests = (input.inquiry.interestedAssetTypes ?? []).map((interest) => String(interest))
  const hasEditorial = hasAssetInterest(interests, "EDITORIAL", "IMAGE")
  const hasRoyaltyFree = hasAssetInterest(interests, "ROYALTY_FREE")
  const hasVideo = hasAssetInterest(interests, "VIDEO")
  const hasCaricature = hasAssetInterest(interests, "CARICATURE")

  const timelineFields: AccessInquiryDetailField[] = []
  const organizationFields: AccessInquiryDetailField[] = []
  const contactFields: AccessInquiryDetailField[] = []
  const preferenceFields: AccessInquiryDetailField[] = []

  const submittedFull = formatInquiryDateTime(input.inquiry.createdAt)
  const submittedRelative = formatRelativeTime(input.inquiry.createdAt)
  if (submittedRelative) {
    pushTextField(timelineFields, "Submitted", submittedRelative, {
      kind: "datetime",
      title: submittedFull || undefined,
    })
  }

  const updatedFull = formatInquiryDateTime(input.inquiry.updatedAt)
  const updatedRelative = formatRelativeTime(input.inquiry.updatedAt)
  if (updatedRelative && updatedRelative !== submittedRelative) {
    pushTextField(timelineFields, "Last updated", updatedRelative, {
      kind: "datetime",
      title: updatedFull || undefined,
    })
  }

  const companyType = String(input.profile.companyType ?? "").trim().toLowerCase()
  if (companyType && companyType !== "other") {
    pushTextField(organizationFields, "Company type", formatCompanyType(input.profile.companyType))
  }

  const jobTitle = String(input.profile.jobTitle ?? "").trim()
  const customJobTitle = String(input.profile.customJobTitle ?? "").trim()
  if (jobTitle === "Other" && customJobTitle) pushTextField(organizationFields, "Job title", customJobTitle)
  else pushTextField(organizationFields, "Job title", jobTitle)

  const phone = [input.profile.phoneCountryCode, input.profile.phoneNumber].filter(Boolean).join(" ").trim()
  pushTextField(organizationFields, "Phone", phone)

  const loginEmail = String(input.profile.email ?? "").trim()
  const companyEmail = String(input.profile.companyEmail ?? "").trim()
  if (loginEmail && loginEmail.toLowerCase() !== companyEmail.toLowerCase()) {
    pushTextField(contactFields, "Login email", loginEmail)
  }

  pushTextField(contactFields, "Email domain", input.profile.companyEmailDomain)

  const emailValidation = String(input.profile.emailValidationDecision ?? "").trim()
  if (emailValidation) {
    pushTextField(contactFields, "Email validation", emailValidation, { kind: "emailValidation" })
  }

  pushTextField(contactFields, "Username", input.profile.username)

  const assetChips = interests.map((interest) => formatAssetInterestType(interest)).filter(Boolean)
  if (assetChips.length) {
    pushTextField(preferenceFields, "Asset interests", assetChips.join(", "), {
      kind: "assetChips",
      chipValues: assetChips,
    })
  }

  if (hasEditorial) {
    const editorialSummary = mergeQuantityQuality(
      input.inquiry.imageQuantityRange,
      input.inquiry.imageQualityPreference,
    )
    pushTextField(preferenceFields, "Editorial", editorialSummary)
  }

  if (hasRoyaltyFree) {
    const royaltyFreeSummary = mergeQuantityQuality(
      input.inquiry.royaltyFreeQuantityRange,
      input.inquiry.royaltyFreeQualityPreference,
    )
    pushTextField(preferenceFields, "Royalty Free", royaltyFreeSummary)
  }

  if (hasVideo) {
    pushTextField(preferenceFields, "Video", formatImageQuantityRange(input.inquiry.videoQuantityRange))
  }

  if (hasCaricature) {
    pushTextField(preferenceFields, "Caricature", formatImageQuantityRange(input.inquiry.caricatureQuantityRange))
  }

  return [
    buildDetailGroup("timeline", "Timeline", timelineFields),
    buildDetailGroup("organization", "Organization", organizationFields),
    buildDetailGroup("contact", "Contact & Account", contactFields),
    buildDetailGroup("preferences", "Asset preferences", preferenceFields),
  ].filter((group): group is AccessInquiryDetailGroup => group !== null)
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
