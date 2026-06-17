"use client"

import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { uploadFieldLabelClass, uploadSelectClass } from "@/components/contributor/upload/contributor-upload-field-styles"
import { Button } from "@/components/ui/button"

interface ContributorUploadStepCaricatureSetupProps {
  active: boolean
  staffMode?: boolean
  contributors: Array<{ id: string; displayName: string }>
  targetContributorId: string
  onTargetContributorIdChange: (value: string) => void
  onContinue: () => void
  continueDisabled?: boolean
}

export function ContributorUploadStepCaricatureSetup({
  active,
  staffMode = false,
  contributors,
  targetContributorId,
  onTargetContributorIdChange,
  onContinue,
  continueDisabled = false,
}: ContributorUploadStepCaricatureSetupProps) {
  return (
    <ContributorUploadStepCard active={active} className="mx-auto max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Caricature details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Caricatures are standalone assets and do not use editorial events. Continue to upload one
          image, then enter caricature metadata.
        </p>
      </div>

      {staffMode ? (
        <div className="mt-5 space-y-2">
          <label htmlFor="caricature-target-contributor" className={uploadFieldLabelClass}>
            Upload on behalf of <span className="text-destructive">*</span>
          </label>
          <select
            id="caricature-target-contributor"
            className={uploadSelectClass}
            value={targetContributorId}
            disabled={!active}
            onChange={(event) => onTargetContributorIdChange(event.target.value)}
          >
            <option value="">Select contributor…</option>
            {contributors.map((contributor) => (
              <option key={contributor.id} value={contributor.id}>
                {contributor.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-6">
        <Button type="button" className="w-full" disabled={!active || continueDisabled} onClick={onContinue}>
          Continue to upload
        </Button>
      </div>
    </ContributorUploadStepCard>
  )
}
