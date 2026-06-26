interface ResolvePreviewObjectIdInput {
  assetId: string
  legacyImageCode: string | null
  originalStorageKey: string | null
}

export function resolvePreviewObjectId(input: ResolvePreviewObjectIdInput): string {
  const legacyImageCode = input.legacyImageCode?.trim()
  if (legacyImageCode) return legacyImageCode

  const originalStorageKey = input.originalStorageKey?.trim()
  if (originalStorageKey) {
    const filename = originalStorageKey.split("/").pop() ?? ""
    const stem = filename.replace(/\.[^.]+$/, "")
    if (stem) return stem
  }

  throw new Error(
    `Cannot build preview key: missing legacyImageCode/originalStorageKey for asset ${input.assetId}`,
  )
}
