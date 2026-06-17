import type { ReactNode } from "react"

import {
  CARICATURE_LANGUAGE_OPTIONS,
  CARICATURE_SHELL_PLACEHOLDER_DESCRIPTION,
  CARICATURE_SHELL_PLACEHOLDER_HEADLINE,
  CARICATURE_SHELL_PLACEHOLDER_TAG,
} from "@/lib/caricatures/caricature-upload-metadata"
import type { StaffCaricatureDetail } from "@/lib/api/staff-caricatures-api"

interface StaffCaricatureMetadataDisplayProps {
  detail: StaffCaricatureDetail
}

export function StaffCaricatureMetadataDisplay({ detail }: StaffCaricatureMetadataDisplayProps) {
  const headline = sanitizeHeadline(detail.headline)
  const description = sanitizeDescription(detail.description)
  const keywords = sanitizeTags(detail.keywords)
  const depictedSubjects = sanitizeTags(detail.depictedSubjects)
  const languageLabel = formatCaricatureLanguageLabel(detail.language)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Submission details</h3>
        <MetadataGrid>
          <MetadataField label="Headline" value={headline} />
          <MetadataField label="Description" value={description} multiline />
          <MetadataField label="Credit" value={detail.credit} />
          <MetadataField label="Category" value={detail.categoryName} />
          <MetadataField label="Published date" value={formatDisplayDate(detail.publishedAt)} />
          <MetadataField label="Status" value={detail.status.replaceAll("_", " ")} />
          <MetadataField label="Visibility" value={detail.visibility} />
          <MetadataField label="Submitted" value={formatDisplayDate(detail.createdAt)} />
          <MetadataField label="Last updated" value={formatDisplayDate(detail.updatedAt)} />
        </MetadataGrid>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Language and visible text</h3>
        <MetadataGrid>
          <MetadataField label="Language" value={languageLabel} />
          {detail.language === "OTHER" && detail.languageOther ? (
            <MetadataField label="Specified language" value={detail.languageOther} />
          ) : null}
          {detail.hasVisibleText && detail.visibleText ? (
            <MetadataField label="Visible text" value={detail.visibleText} multiline />
          ) : null}
          {detail.visibleTextTranslationEn ? (
            <MetadataField label="English translation" value={detail.visibleTextTranslationEn} multiline />
          ) : null}
          {!detail.hasVisibleText ? (
            <MetadataField label="Visible text in image" value="No visible text" />
          ) : null}
        </MetadataGrid>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Search tags</h3>
        <MetadataGrid>
          <MetadataTags label="Keywords" values={keywords} />
          <MetadataTags label="Depicted subjects" values={depictedSubjects} />
        </MetadataGrid>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Processing</h3>
        <MetadataGrid>
          <MetadataField
            label="Original file"
            value={detail.hasOriginalFile ? "Attached" : "Missing"}
          />
          <MetadataField label="Preview status" value={formatPreviewStatus(detail.previewGenerationStatus)} />
          <MetadataField label="Asset ID" value={detail.id} mono />
        </MetadataGrid>
      </section>
    </div>
  )
}

function MetadataGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
}

function MetadataField({
  label,
  value,
  multiline = false,
  mono = false,
}: {
  label: string
  value: string
  multiline?: boolean
  mono?: boolean
}) {
  if (!value.trim()) return null

  return (
    <div className={multiline ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-sm text-foreground ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""} ${mono ? "font-mono text-xs break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}

function MetadataTags({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null

  return (
    <div className="sm:col-span-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground"
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  )
}

function sanitizeHeadline(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === CARICATURE_SHELL_PLACEHOLDER_HEADLINE) return ""
  return trimmed
}

function sanitizeDescription(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === CARICATURE_SHELL_PLACEHOLDER_DESCRIPTION) return ""
  return trimmed
}

function sanitizeTags(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean).filter((value) => value !== CARICATURE_SHELL_PLACEHOLDER_TAG)
}

function formatCaricatureLanguageLabel(language: string): string {
  const match = CARICATURE_LANGUAGE_OPTIONS.find((option) => option.value === language)
  return match?.label ?? language.replaceAll("_", " ")
}

function formatDisplayDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatPreviewStatus(status: string): string {
  switch (status) {
    case "NONE":
      return "Not queued"
    case "QUEUED":
      return "Queued"
    case "GENERATING":
      return "Generating"
    case "READY":
      return "Ready"
    case "FAILED":
      return "Failed"
    default:
      return status.replaceAll("_", " ")
  }
}
