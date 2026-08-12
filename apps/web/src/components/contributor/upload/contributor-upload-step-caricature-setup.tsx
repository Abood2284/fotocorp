"use client"

import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { uploadFieldLabelClass, uploadSelectClass } from "@/components/contributor/upload/contributor-upload-field-styles"
import type { ContributorAuthResponse } from "@/lib/api/contributor-api"
import { cn } from "@/lib/utils"

interface ContributorUploadStepCaricatureSetupProps {
  active: boolean
  staffMode?: boolean
  isPortalAdmin?: boolean
  session?: ContributorAuthResponse
  contributors: Array<{ id: string; displayName: string }>
  targetContributorId: string
  onTargetContributorIdChange: (value: string) => void
}

export function ContributorUploadStepCaricatureSetup({
  active,
  staffMode = false,
  isPortalAdmin = false,
  session,
  contributors,
  targetContributorId,
  onTargetContributorIdChange,
}: ContributorUploadStepCaricatureSetupProps) {
  const contributorOptions = staffMode
    ? contributors
    : isPortalAdmin
      ? contributors.length > 0
        ? contributors
        : session
          ? [{ id: session.contributor.id, displayName: session.contributor.displayName }]
          : []
      : session
        ? [{ id: session.contributor.id, displayName: session.contributor.displayName }]
        : []

  const selectValue = staffMode ? targetContributorId : targetContributorId || session?.contributor.id || ""
  const contributorSelectDisabled = !active || (!staffMode && !isPortalAdmin)

  return (
    <ContributorUploadStepCard active={active} className="mx-auto max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Caricature details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Caricatures are standalone assets and do not use editorial events. Continue to upload one
          image, then enter caricature metadata.
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <label htmlFor="caricature-target-contributor" className={uploadFieldLabelClass}>
          Upload on behalf of{staffMode ? <span className="text-destructive"> *</span> : null}
        </label>
        <select
          id="caricature-target-contributor"
          className={cn(uploadSelectClass, contributorSelectDisabled && "bg-muted/40 text-foreground")}
          value={selectValue}
          disabled={contributorSelectDisabled}
          onChange={(event) => onTargetContributorIdChange(event.target.value)}
        >
          {staffMode ? <option value="">Select contributor…</option> : null}
          {contributorOptions.map((contributor) => (
            <option key={contributor.id} value={contributor.id}>
              {contributor.displayName}
            </option>
          ))}
        </select>
      </div>
    </ContributorUploadStepCard>
  )
}
