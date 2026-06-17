"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  CaricatureAssetMetadataPayload,
  CaricatureAssetRecord,
  CaricatureCategoryOption,
  CaricatureLanguage,
  CaricaturePreviewGenerationStatus,
} from "@/lib/caricatures/caricature-upload-metadata"
import {
  CARICATURE_LANGUAGE_OPTIONS,
  CARICATURE_STATUS_OPTIONS,
  caricatureLanguageRequiresOther,
  caricatureLanguageRequiresVisibleText,
  caricatureLanguageShowsTranslation,
  formatCaricatureStringList,
  toDatetimeLocalValue,
} from "@/lib/caricatures/caricature-upload-metadata"
import { getStaffCaricatureOriginalUrl } from "@/lib/search/caricature-search"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"

interface ContributorUploadStepCaricatureMetadataProps {
  active: boolean
  staffMode: boolean
  categories: CaricatureCategoryOption[]
  asset: CaricatureAssetRecord | null
  defaultCredit: string
  hasOriginalFile: boolean
  onSave: (payload: CaricatureAssetMetadataPayload) => Promise<void>
  onGeneratePreviews?: () => Promise<void>
  generatePreviewsBusy?: boolean
  generatePreviewsMessage?: string | null
  submitBusy: boolean
  submitError: string | null
  onDismissSubmitError: () => void
}

export function ContributorUploadStepCaricatureMetadata({
  active,
  staffMode,
  categories,
  asset,
  defaultCredit,
  hasOriginalFile,
  onSave,
  onGeneratePreviews,
  generatePreviewsBusy = false,
  generatePreviewsMessage = null,
  submitBusy,
  submitError,
  onDismissSubmitError,
}: ContributorUploadStepCaricatureMetadataProps) {
  const [language, setLanguage] = useState<CaricatureLanguage>(
    asset?.language ?? "NO_VISIBLE_TEXT",
  )
  const [error, setError] = useState<string | null>(null)

  const showVisibleText = caricatureLanguageRequiresVisibleText(language)
  const showTranslation = caricatureLanguageShowsTranslation(language)
  const showLanguageOther = caricatureLanguageRequiresOther(language)
  const previewStatus = asset?.previewGenerationStatus ?? (asset?.hasReadyPreviewDerivatives ? "READY" : "NONE")
  const canQueuePreviews = staffMode && hasOriginalFile && previewStatus !== "READY" && previewStatus !== "GENERATING"
  const staffOriginalUrl = staffMode && asset?.id && hasOriginalFile ? getStaffCaricatureOriginalUrl(asset.id) : null

  const statusOptions = useMemo(() => {
    if (!staffMode) return CARICATURE_STATUS_OPTIONS.filter((option) => option.value === "PENDING_REVIEW")
    return CARICATURE_STATUS_OPTIONS.filter(
      (option) => option.value === "DRAFT" || option.value === "PENDING_REVIEW",
    )
  }, [staffMode])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    onDismissSubmitError()

    const formData = new FormData(event.currentTarget)
    const publishedAtRaw = formData.get("publishedAt")?.toString().trim() ?? ""

    const payload: CaricatureAssetMetadataPayload = {
      headline: formData.get("headline")?.toString().trim() ?? "",
      description: formData.get("description")?.toString().trim() ?? "",
      credit: formData.get("credit")?.toString().trim() ?? defaultCredit,
      categoryId: formData.get("categoryId")?.toString().trim() ?? "",
      language,
      languageOther: formData.get("languageOther")?.toString().trim() || null,
      visibleText: formData.get("visibleText")?.toString().trim() || null,
      visibleTextTranslationEn: formData.get("visibleTextTranslationEn")?.toString().trim() || null,
      keywords: (formData.get("keywords")?.toString() ?? "")
        .split(/[,;\n\r]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
      depictedSubjects: (formData.get("depictedSubjects")?.toString() ?? "")
        .split(/[,;\n\r]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
      publishedAt: publishedAtRaw ? new Date(publishedAtRaw).toISOString() : "",
      status: staffMode
        ? ((formData.get("status")?.toString().trim() ?? "DRAFT") as CaricatureAssetMetadataPayload["status"])
        : "PENDING_REVIEW",
    }

    try {
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save caricature metadata.")
    }
  }

  return (
    <ContributorUploadStepCard active={active} className="mx-auto max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {(error || submitError) && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error ?? submitError}
          </div>
        )}

        {!hasOriginalFile ? (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            Upload the caricature image on the previous step before saving metadata.
          </div>
        ) : staffMode ? (
          <div className="rounded border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Save as draft or pending review, then approve from the Caricatures queue to publish automatically.
          </div>
        ) : (
          <div className="rounded border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Submitting sends this caricature to staff review. Publishing happens after staff approval.
          </div>
        )}

        {staffMode && hasOriginalFile ? (
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Staff review</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {describePreviewGenerationStatus(previewStatus)}
                </p>
              </div>
              {onGeneratePreviews ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canQueuePreviews || generatePreviewsBusy}
                  onClick={() => void onGeneratePreviews()}
                >
                  {generatePreviewsBusy ? "Queueing…" : "Generate blurred previews"}
                </Button>
              ) : null}
            </div>

            {generatePreviewsMessage ? (
              <div className="rounded border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {generatePreviewsMessage}
              </div>
            ) : null}

            {staffOriginalUrl ? (
              <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staffOriginalUrl}
                  alt="Clean caricature original for staff review"
                  className="mx-auto max-h-[420px] w-auto max-w-full object-contain"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Core metadata</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Headline</label>
              <Input name="headline" defaultValue={asset?.headline ?? ""} required maxLength={500} disabled={!active} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                name="description"
                defaultValue={asset?.description ?? ""}
                required
                rows={4}
                maxLength={5000}
                disabled={!active}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Credit</label>
              <Input name="credit" defaultValue={asset?.credit ?? defaultCredit} required maxLength={500} disabled={!active} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                name="categoryId"
                defaultValue={asset?.categoryId ?? ""}
                required
                disabled={!active}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Published date</label>
              <Input
                name="publishedAt"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(asset?.publishedAt ?? new Date().toISOString())}
                required
                disabled={!active}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={asset?.status ?? "DRAFT"}
                disabled={!active}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Language and visible text</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Language</label>
              <select
                name="language"
                value={language}
                disabled={!active}
                onChange={(event) => setLanguage(event.target.value as CaricatureLanguage)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {CARICATURE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {showLanguageOther ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Specify language</label>
                <Input
                  name="languageOther"
                  defaultValue={asset?.languageOther ?? ""}
                  required
                  maxLength={200}
                  disabled={!active}
                />
              </div>
            ) : null}
            {showVisibleText ? (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Visible text</label>
                <textarea
                  name="visibleText"
                  defaultValue={asset?.visibleText ?? ""}
                  required
                  rows={3}
                  maxLength={5000}
                  disabled={!active}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : null}
            {showTranslation ? (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  English translation (optional)
                </label>
                <textarea
                  name="visibleTextTranslationEn"
                  defaultValue={asset?.visibleTextTranslationEn ?? ""}
                  rows={3}
                  maxLength={5000}
                  disabled={!active}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Search tags</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Keywords (comma-separated)</label>
              <textarea
                name="keywords"
                defaultValue={formatCaricatureStringList(asset?.keywords ?? [])}
                required
                rows={2}
                disabled={!active}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Depicted subjects (comma-separated)
              </label>
              <textarea
                name="depictedSubjects"
                defaultValue={formatCaricatureStringList(asset?.depictedSubjects ?? [])}
                required
                rows={2}
                disabled={!active}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={!active || submitBusy || !hasOriginalFile}>
            {submitBusy ? "Saving…" : staffMode ? "Save caricature" : "Submit for review"}
          </Button>
        </div>
      </form>
    </ContributorUploadStepCard>
  )
}

function describePreviewGenerationStatus(status: CaricaturePreviewGenerationStatus): string {
  switch (status) {
    case "NONE":
      return "No blurred previews yet. Staff approval will queue preview generation automatically."
    case "QUEUED":
      return "Blurred previews are queued. Processing starts automatically after staff approval."
    case "GENERATING":
      return "Preview generation is in progress on the jobs worker."
    case "READY":
      return "Blurred previews are ready."
    case "FAILED":
      return "Preview generation failed. Staff can approve again to retry."
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
