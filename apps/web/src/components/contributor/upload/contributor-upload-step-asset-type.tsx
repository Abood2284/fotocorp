"use client"

import type { UploadBatchAssetType } from "@/components/contributor/contributor-upload-types"
import { UPLOAD_ASSET_TYPE_OPTIONS } from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { cn } from "@/lib/utils"

interface ContributorUploadStepAssetTypeProps {
  active: boolean
  selectedType: UploadBatchAssetType
  hint?: string
  onSelect: (assetType: UploadBatchAssetType) => void
}

export function ContributorUploadStepAssetType({
  active,
  selectedType,
  hint,
  onSelect,
}: ContributorUploadStepAssetTypeProps) {
  return (
    <ContributorUploadStepCard active={active} className="mx-auto max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">What are you uploading?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hint ?? "Choose the asset type for this batch, then continue to event details."}
        </p>
      </div>
      <div className="mt-5 grid gap-3">
        {UPLOAD_ASSET_TYPE_OPTIONS.map((option) => {
          if (option.enabled) {
            const isSelected = selectedType === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={!active}
                onClick={() => onSelect(option.value)}
                className={cn(
                  "rounded-xl border-2 px-4 py-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </button>
            )
          }

          return (
            <div
              key={option.value}
              className="rounded-xl border border-border bg-muted/20 px-4 py-3 opacity-60"
              aria-disabled
            >
              <p className="text-sm font-medium text-muted-foreground">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Coming soon</p>
            </div>
          )
        })}
      </div>
    </ContributorUploadStepCard>
  )
}
