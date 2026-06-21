import type { MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"

const METADATA_FIELD_KEYS = ["whoIsInPicture", "caption", "keywords"] as const

export type MetadataFieldKey = (typeof METADATA_FIELD_KEYS)[number]

export function applyMetadataDraftPatch(input: {
  syncMode: boolean
  current: MetadataDraft
  patch: Partial<MetadataDraft>
}): MetadataDraft {
  const { syncMode, current, patch } = input
  if (!syncMode) return { ...current, ...patch }

  const editedKey = METADATA_FIELD_KEYS.find((key) => patch[key] !== undefined)
  if (!editedKey) return { ...current, ...patch }

  const value = patch[editedKey]!
  return {
    whoIsInPicture: value,
    caption: value,
    keywords: value,
  }
}
