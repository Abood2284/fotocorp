"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StaffCaricatureDetail } from "@/lib/api/staff-caricatures-types"
import type {
  CaricatureAssetMetadataPayload,
  CaricatureAssetStatus,
  CaricatureCategoryOption,
  CaricatureLanguage,
} from "@/lib/caricatures/caricature-upload-metadata"
import {
  CARICATURE_LANGUAGE_OPTIONS,
  CARICATURE_SHELL_PLACEHOLDER_DESCRIPTION,
  CARICATURE_SHELL_PLACEHOLDER_HEADLINE,
  CARICATURE_SHELL_PLACEHOLDER_TAG,
  caricatureLanguageRequiresOther,
  caricatureLanguageRequiresVisibleText,
  caricatureLanguageShowsTranslation,
  formatCaricatureStringList,
  toDatetimeLocalValue,
} from "@/lib/caricatures/caricature-upload-metadata"

interface StaffCaricatureMetadataEditFormProps {
  detail: StaffCaricatureDetail
  categories: CaricatureCategoryOption[]
  categoriesLoading: boolean
  saveBusy: boolean
  onCancel: () => void
  onSave: (payload: CaricatureAssetMetadataPayload) => Promise<void>
}

export function StaffCaricatureMetadataEditForm({
  detail,
  categories,
  categoriesLoading,
  saveBusy,
  onCancel,
  onSave,
}: StaffCaricatureMetadataEditFormProps) {
  const defaults = useMemo(() => resolveEditDefaults(detail), [detail])
  const [language, setLanguage] = useState<CaricatureLanguage>(defaults.language)
  const [status, setStatus] = useState<CaricatureAssetStatus>(defaults.status)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLanguage(defaults.language)
    setStatus(defaults.status)
    setError(null)
  }, [defaults])

  const showVisibleText = caricatureLanguageRequiresVisibleText(language)
  const showTranslation = caricatureLanguageShowsTranslation(language)
  const showLanguageOther = caricatureLanguageRequiresOther(language)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const publishedAtRaw = formData.get("publishedAt")?.toString().trim() ?? ""

    const payload: CaricatureAssetMetadataPayload = {
      headline: formData.get("headline")?.toString().trim() ?? "",
      description: formData.get("description")?.toString().trim() ?? "",
      credit: formData.get("credit")?.toString().trim() ?? "",
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
      status,
    }

    try {
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save caricature.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Edit submission</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Headline</FieldLabel>
            <Input name="headline" defaultValue={defaults.headline} required maxLength={500} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Description</FieldLabel>
            <textarea
              name="description"
              defaultValue={defaults.description}
              required
              rows={4}
              maxLength={5000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Credit</FieldLabel>
            <Input name="credit" defaultValue={defaults.credit} required maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Status</FieldLabel>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CaricatureAssetStatus)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending review</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Category</FieldLabel>
            <select
              name="categoryId"
              defaultValue={defaults.categoryId}
              required
              disabled={categoriesLoading || categories.length === 0}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                {categoriesLoading ? "Loading categories…" : "Select category"}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Published date</FieldLabel>
            <Input
              name="publishedAt"
              type="datetime-local"
              defaultValue={defaults.publishedAt}
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Language and visible text</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel required>Language</FieldLabel>
            <select
              value={language}
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
              <FieldLabel required>Specify language</FieldLabel>
              <Input
                name="languageOther"
                defaultValue={defaults.languageOther}
                required
                maxLength={200}
              />
            </div>
          ) : null}
          {showVisibleText ? (
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel required>Visible text</FieldLabel>
              <textarea
                name="visibleText"
                defaultValue={defaults.visibleText}
                required
                rows={3}
                maxLength={5000}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          {showTranslation ? (
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>English translation (optional)</FieldLabel>
              <textarea
                name="visibleTextTranslationEn"
                defaultValue={defaults.visibleTextTranslationEn}
                rows={3}
                maxLength={5000}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Search tags</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel required>Keywords (comma-separated)</FieldLabel>
            <textarea
              name="keywords"
              defaultValue={defaults.keywords}
              required
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Depicted subjects (comma-separated)</FieldLabel>
            <textarea
              name="depictedSubjects"
              defaultValue={defaults.depictedSubjects}
              required
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saveBusy || categoriesLoading}>
          {saveBusy ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saveBusy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </span>
  )
}

function resolveEditDefaults(detail: StaffCaricatureDetail) {
  const headline =
    detail.headline.trim() === CARICATURE_SHELL_PLACEHOLDER_HEADLINE ? "" : detail.headline.trim()
  const description =
    detail.description.trim() === CARICATURE_SHELL_PLACEHOLDER_DESCRIPTION
      ? ""
      : detail.description.trim()
  const keywords = detail.keywords.filter((value) => value !== CARICATURE_SHELL_PLACEHOLDER_TAG)
  const depictedSubjects = detail.depictedSubjects.filter(
    (value) => value !== CARICATURE_SHELL_PLACEHOLDER_TAG,
  )
  const status: CaricatureAssetStatus =
    detail.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT"
  const language = (CARICATURE_LANGUAGE_OPTIONS.some((option) => option.value === detail.language)
    ? detail.language
    : "NO_VISIBLE_TEXT") as CaricatureLanguage

  return {
    headline,
    description,
    credit: detail.credit,
    categoryId: detail.categoryId,
    language,
    languageOther: detail.languageOther ?? "",
    visibleText: detail.visibleText ?? "",
    visibleTextTranslationEn: detail.visibleTextTranslationEn ?? "",
    keywords: formatCaricatureStringList(keywords),
    depictedSubjects: formatCaricatureStringList(depictedSubjects),
    publishedAt: toDatetimeLocalValue(detail.publishedAt),
    status,
  }
}
