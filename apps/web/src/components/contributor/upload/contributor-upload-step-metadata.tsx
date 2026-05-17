"use client"

import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import {
  ContributorUploadMetadataItem,
  type MetadataDraft,
} from "@/components/contributor/upload/contributor-upload-metadata-item"

interface ContributorUploadStepMetadataProps {
  active: boolean
  items: TrackedFile[]
  onSaveItem: (key: string, draft: MetadataDraft) => Promise<void>
}

export function ContributorUploadStepMetadata({ active, items, onSaveItem }: ContributorUploadStepMetadataProps) {
  const completed = items.filter((row) => row.status === "done" && row.imageAssetId)

  if (!active) return null

  return (
    <section className="mx-auto w-full max-w-3xl lg:max-w-4xl">
      <header className="mb-6 text-center sm:mb-8">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Image metadata</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Add details for each upload. Changes save automatically after you pause typing.
        </p>
      </header>

      {completed.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground sm:text-base">
          Upload at least one image to add metadata.
        </p>
      ) : (
        <ul className="space-y-8 sm:space-y-10">
          {completed.map((row) => (
            <ContributorUploadMetadataItem
              key={row.key}
              row={row}
              onSave={(draft) => onSaveItem(row.key, draft)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
