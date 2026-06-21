"use client"

import type { UploadWizardStep } from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepCaricatureFiles } from "@/components/contributor/upload/contributor-upload-step-caricature-files"
import { ContributorUploadStepCaricatureMetadata } from "@/components/contributor/upload/contributor-upload-step-caricature-metadata"
import { ContributorUploadStepCaricatureSetup } from "@/components/contributor/upload/contributor-upload-step-caricature-setup"
import { ContributorUploadLayout, ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { Button } from "@/components/ui/button"
import type {
  CaricatureAssetMetadataPayload,
  CaricatureAssetRecord,
  CaricatureCategoryOption,
} from "@/lib/caricatures/caricature-upload-metadata"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import type { ContributorAuthResponse } from "@/lib/api/contributor-api"
import { caricatureUploadActionTitle } from "@/lib/upload-wizard-caricature"

interface CaricatureUploadWizardPanelProps {
  currentStep: UploadWizardStep
  staffMode: boolean
  isPortalAdmin?: boolean
  session?: ContributorAuthResponse
  contributors: Array<{ id: string; displayName: string }>
  targetContributorId: string
  onTargetContributorIdChange: (value: string) => void
  tracked: TrackedFile[]
  rejectedFiles: { file: File; reason: string }[]
  uploadBusy?: boolean
  uploadProgress?: number | null
  onFilePicked: (list: FileList | null) => void
  onRemoveFile: () => void
  categories: CaricatureCategoryOption[]
  caricatureAsset: CaricatureAssetRecord | null
  defaultCredit: string
  hasOriginalFile: boolean
  onSetupContinue: () => void
  onUploadContinue: () => void | Promise<void>
  onSaveMetadata: (payload: CaricatureAssetMetadataPayload) => Promise<void>
  submitBusy: boolean
  submitError: string | null
  onDismissSubmitError: () => void
}

export function CaricatureUploadWizardPanel({
  currentStep,
  staffMode,
  isPortalAdmin = false,
  session,
  contributors,
  targetContributorId,
  onTargetContributorIdChange,
  tracked,
  rejectedFiles,
  uploadBusy = false,
  uploadProgress = null,
  onFilePicked,
  onRemoveFile,
  categories,
  caricatureAsset,
  defaultCredit,
  hasOriginalFile,
  onSetupContinue,
  onUploadContinue,
  onSaveMetadata,
  submitBusy,
  submitError,
  onDismissSubmitError,
}: CaricatureUploadWizardPanelProps) {
  const hasLocalFile = tracked.length > 0
  const setupDisabled = staffMode && !targetContributorId

  if (currentStep === 4) {
    return (
      <ContributorUploadStepCaricatureMetadata
        active
        staffMode={staffMode}
        categories={categories}
        asset={caricatureAsset}
        defaultCredit={defaultCredit}
        hasOriginalFile={hasOriginalFile || Boolean(caricatureAsset?.hasOriginalFile)}
        onSave={onSaveMetadata}
        submitBusy={submitBusy}
        submitError={submitError}
        onDismissSubmitError={onDismissSubmitError}
      />
    )
  }

  return (
    <ContributorUploadLayout
      rightLocked={
        (currentStep === 2 && setupDisabled) ||
        (currentStep === 3 && (!hasLocalFile || uploadBusy))
      }
      left={
        <>
          {currentStep === 2 ? (
            <ContributorUploadStepCaricatureSetup
              active
              staffMode={staffMode}
              isPortalAdmin={isPortalAdmin}
              session={session}
              contributors={contributors}
              targetContributorId={targetContributorId}
              onTargetContributorIdChange={onTargetContributorIdChange}
              onContinue={onSetupContinue}
              continueDisabled={setupDisabled}
            />
          ) : null}
          {currentStep === 3 ? (
            <ContributorUploadStepCaricatureFiles
              active
              tracked={tracked}
              rejectedFiles={rejectedFiles}
              uploadBusy={uploadBusy}
              uploadProgress={uploadProgress}
              onFilePicked={onFilePicked}
              onRemoveFile={onRemoveFile}
            />
          ) : null}
        </>
      }
      right={
        currentStep === 2 || currentStep === 3 ? (
          <ContributorUploadStepCard active>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {caricatureUploadActionTitle(currentStep)}
            </h2>
            <div className="mt-4 sm:mt-5">
              <Button
                type="button"
                className="h-11 w-full text-sm sm:h-12 sm:text-base"
                disabled={currentStep === 2 ? setupDisabled : !hasLocalFile || uploadBusy}
                onClick={() => {
                  if (currentStep === 2) onSetupContinue()
                  else void onUploadContinue()
                }}
              >
                {uploadBusy ? "Uploading…" : currentStep === 2 ? "Continue to upload" : caricatureUploadActionTitle(currentStep)}
              </Button>
            </div>
          </ContributorUploadStepCard>
        ) : null
      }
    />
  )
}
