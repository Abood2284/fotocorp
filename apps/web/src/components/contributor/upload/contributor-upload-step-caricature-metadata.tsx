"use client"

import { useMemo, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  CaricatureAssetMetadataPayload,
  CaricatureAssetRecord,
  CaricatureCategoryOption,
  CaricatureLanguage,
} from "@/lib/caricatures/caricature-upload-metadata"
import {
  CARICATURE_LANGUAGE_OPTIONS,
  caricatureLanguageRequiresOther,
  caricatureLanguageRequiresVisibleText,
  caricatureLanguageShowsTranslation,
  caricatureUploadWizardSaveStatus,
  resolveCaricatureMetadataFormDefaults,
  toDatetimeLocalValue,
} from "@/lib/caricatures/caricature-upload-metadata"
import { getCaricatureUploadWizardOriginalUrl } from "@/lib/search/caricature-search"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"

interface ContributorUploadStepCaricatureMetadataProps {
  active: boolean
  staffMode: boolean
  categories: CaricatureCategoryOption[]
  asset: CaricatureAssetRecord | null
  defaultCredit: string
  hasOriginalFile: boolean
  onSave: (payload: CaricatureAssetMetadataPayload) => Promise<void>
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
  submitBusy,
  submitError,
  onDismissSubmitError,
}: ContributorUploadStepCaricatureMetadataProps) {
  const [language, setLanguage] = useState<CaricatureLanguage>(
    asset?.language ?? "NO_VISIBLE_TEXT",
  )
  const [error, setError] = useState<string | null>(null)

  const formDefaults = useMemo(
    () => resolveCaricatureMetadataFormDefaults(asset, defaultCredit),
    [asset, defaultCredit],
  )

  const showVisibleText = caricatureLanguageRequiresVisibleText(language)
  const showTranslation = caricatureLanguageShowsTranslation(language)
  const showLanguageOther = caricatureLanguageRequiresOther(language)
  const originalPreviewUrl =
    asset?.id && hasOriginalFile ? getCaricatureUploadWizardOriginalUrl(asset.id, staffMode) : null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    onDismissSubmitError()

    const formData = new FormData(event.currentTarget)
    const publishedAtRaw = formData.get("publishedAt")?.toString().trim() ?? ""

    const payload: CaricatureAssetMetadataPayload = {
      headline: formData.get("headline")?.toString().trim() ?? "",
      description: formData.get("description")?.toString().trim() ?? "",
      credit: formDefaults.credit,
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
      status: caricatureUploadWizardSaveStatus(),
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
        ) : !staffMode ? (
          <div className="rounded border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Submitting sends this caricature to staff review. Publishing happens after staff approval.
          </div>
        ) : null}

        {originalPreviewUrl ? (
          <div className="overflow-hidden rounded-md border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalPreviewUrl}
              alt="Uploaded caricature original"
              className="mx-auto max-h-[420px] w-auto max-w-full object-contain"
            />
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <CaricatureFieldLabel required>Headline</CaricatureFieldLabel>
              <Input
                name="headline"
                defaultValue={formDefaults.headline}
                required
                maxLength={500}
                disabled={!active}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <CaricatureFieldLabel required>Description</CaricatureFieldLabel>
              <textarea
                name="description"
                defaultValue={formDefaults.description}
                required
                rows={4}
                maxLength={5000}
                disabled={!active}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <CaricatureFieldLabel required>Category</CaricatureFieldLabel>
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
              <CaricatureFieldLabel required>Published date</CaricatureFieldLabel>
              <Input
                name="publishedAt"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(asset?.publishedAt ?? new Date().toISOString())}
                required
                disabled={!active}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Language and visible text</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <CaricatureFieldLabel required>Language</CaricatureFieldLabel>
              <select
                name="language"
                value={language}
                required
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
                <CaricatureFieldLabel required>Specify language</CaricatureFieldLabel>
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
                <CaricatureFieldLabel required>Visible text</CaricatureFieldLabel>
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
                <CaricatureFieldLabel>English translation (optional)</CaricatureFieldLabel>
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
              <CaricatureFieldLabel required>Keywords (comma-separated)</CaricatureFieldLabel>
              <textarea
                name="keywords"
                defaultValue={formDefaults.keywords}
                required
                rows={2}
                disabled={!active}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <CaricatureFieldLabel required>Depicted subjects (comma-separated)</CaricatureFieldLabel>
              <textarea
                name="depictedSubjects"
                defaultValue={formDefaults.depictedSubjects}
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
            {submitBusy ? "Saving…" : staffMode ? "Save & send for review" : "Submit for review"}
          </Button>
        </div>
      </form>
    </ContributorUploadStepCard>
  )
}

function CaricatureFieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
  )
}
