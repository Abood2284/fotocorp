export const CONTRIBUTOR_UPLOAD_TYPE_OPTIONS = [
  {
    value: "EDITORIAL",
    label: "Editorial",
    description: "JPEG editorial image batches.",
  },
  {
    value: "CARICATURE",
    label: "Caricature",
    description: "Single caricature artwork uploads.",
  },
] as const

export type ContributorUploadType = (typeof CONTRIBUTOR_UPLOAD_TYPE_OPTIONS)[number]["value"]

export function normalizeContributorUploadTypes(raw: unknown): ContributorUploadType[] {
  if (!Array.isArray(raw)) return ["EDITORIAL"]

  const unique = new Set<ContributorUploadType>()
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const value = entry.trim().toUpperCase()
    if (value === "EDITORIAL" || value === "CARICATURE") unique.add(value)
  }

  if (unique.size === 0) return ["EDITORIAL"]
  return CONTRIBUTOR_UPLOAD_TYPE_OPTIONS.map((option) => option.value).filter((value) => unique.has(value))
}

export function contributorUploadTypeToBatchAssetType(
  type: ContributorUploadType,
): "IMAGE" | "CARICATURE" {
  return type === "CARICATURE" ? "CARICATURE" : "IMAGE"
}

export function allowedBatchAssetTypesFromUploadTypes(
  allowedUploadTypes: readonly ContributorUploadType[],
): Array<"IMAGE" | "CARICATURE"> {
  return normalizeContributorUploadTypes(allowedUploadTypes).map(contributorUploadTypeToBatchAssetType)
}
