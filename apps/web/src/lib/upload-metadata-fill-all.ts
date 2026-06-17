import type { MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"

export function buildFillAllMetadataDraft(eventTitle: string): MetadataDraft | null {
  const value = eventTitle.trim()
  if (!value) return null
  return {
    caption: value,
    keywords: value,
    whoIsInPicture: value,
  }
}

export function isFillAllDisabled(eventTitle: string): boolean {
  return eventTitle.trim().length === 0
}
