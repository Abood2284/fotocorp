export interface SearchIntentParams {
  q?: string
  categoryId?: string
  eventId?: string
  city?: string
  contributorId?: string
  year?: number
  month?: number
  page?: number
  mode?: string
  sort?: string
  cursor?: string
}

export function hasSearchIntent(params: SearchIntentParams) {
  if (params.q?.trim()) return true
  if (params.categoryId) return true
  if (params.eventId) return true
  if (params.city) return true
  if (params.contributorId) return true
  if (params.year != null) return true
  if (params.month != null) return true
  if (params.page != null && params.page > 1) return true
  if (params.cursor) return true
  if (params.mode === "events") return true
  if (params.sort?.trim().toLowerCase() === "latest") return true
  return false
}
