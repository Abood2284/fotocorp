/** Preserves internal spaces; trims ends only. Comma-separated names are stored as one string. */
export function normalizeWhoIsInPicture(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function keywordsToTags(keywords: string | null | undefined): string[] {
  if (!keywords?.trim()) return []
  return Array.from(
    new Set(
      keywords
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean),
    ),
  )
}

export function tagsToKeywords(tags: string[]): string | null {
  const parts = tags.map((t) => t.trim()).filter(Boolean)
  if (parts.length === 0) return null
  return parts.join(", ")
}
