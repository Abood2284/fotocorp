const UNSAFE_METADATA_KEYS = new Set([
  "original_storage_key",
  "storage_key",
  "storagekey",
  "url",
  "signedurl",
  "signed_url",
  "bucket",
  "password",
  "passwordhash",
  "password_hash",
  "temporarypassword",
  "temporary_password",
  "secret",
  "token",
  "useragent",
  "user_agent",
  "ip_address",
  "ipaddress",
])

function isUnsafeKey(key: string) {
  return UNSAFE_METADATA_KEYS.has(key.trim().toLowerCase())
}

export function sanitizeAuditMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "object" || Array.isArray(value)) return null

  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKey(key)) continue
    if (entry === null || entry === undefined) continue
    if (typeof entry === "object" && !Array.isArray(entry)) {
      const nested = sanitizeAuditMetadata(entry)
      if (nested && Object.keys(nested).length > 0) output[key] = nested
      continue
    }
    if (Array.isArray(entry)) {
      const sanitized = entry
        .map((item) => (typeof item === "object" && item !== null ? sanitizeAuditMetadata(item) : item))
        .filter((item) => item !== null && item !== undefined)
      if (sanitized.length > 0) output[key] = sanitized
      continue
    }
    if (typeof entry === "string" && entry.length > 240) {
      output[key] = `${entry.slice(0, 237)}...`
      continue
    }
    output[key] = entry
  }

  return Object.keys(output).length > 0 ? output : null
}

export function buildAuditSummary(
  source: string,
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) return action.replaceAll("_", " ").toLowerCase()

  if (source === "staff") {
    if (typeof metadata.username === "string") return `Staff user ${metadata.username}`
    if (typeof metadata.reason === "string") return `Auth event: ${metadata.reason}`
    if (typeof metadata.previousStatus === "string" && typeof metadata.nextStatus === "string") {
      return `Status ${metadata.previousStatus} → ${metadata.nextStatus}`
    }
    return action.replaceAll("_", " ").toLowerCase()
  }

  const before = sanitizeAuditMetadata(metadata.before)
  const after = sanitizeAuditMetadata(metadata.after)
  const changedKeys = new Set<string>()
  if (before) for (const key of Object.keys(before)) changedKeys.add(key)
  if (after) for (const key of Object.keys(after)) changedKeys.add(key)

  if (changedKeys.size > 0) {
    const labels = [...changedKeys].slice(0, 4).map((key) => key.replaceAll("_", " "))
    const suffix = changedKeys.size > 4 ? ` +${changedKeys.size - 4} more` : ""
    return `Updated ${labels.join(", ")}${suffix}`
  }

  return action.replaceAll("_", " ").toLowerCase()
}
