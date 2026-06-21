import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface CaricatureDetailMetadataRow {
  label: string
  value: string | null | undefined
}

interface CaricatureDetailMetadataSectionProps {
  title?: string
  rows: CaricatureDetailMetadataRow[]
  className?: string
  showTitle?: boolean
}

export function CaricatureDetailMetadataSection({
  title = "Details",
  rows,
  className,
  showTitle = true,
}: CaricatureDetailMetadataSectionProps) {
  const visibleRows = rows.filter((row) => row.value?.trim())
  if (visibleRows.length === 0) return null

  return (
    <section className={cn(showTitle ? "space-y-3" : undefined, className)}>
      {showTitle ? (
        <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      ) : null}
      <dl className="divide-y divide-border/50">
        {visibleRows.map((row) => (
          <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

interface CaricatureDetailChipSectionProps {
  title: string
  values: string[]
  variant?: "default" | "subjects"
  className?: string
  embedded?: boolean
}

export function CaricatureDetailChipSection({
  title,
  values,
  variant = "default",
  className,
  embedded = false,
}: CaricatureDetailChipSectionProps) {
  if (values.length === 0) return null

  return (
    <section className={cn(embedded ? "space-y-2" : "space-y-3", className)}>
      <h3
        className={cn(
          embedded
            ? "text-[11px] font-medium text-muted-foreground"
            : "text-xs font-semibold text-muted-foreground",
        )}
      >
        {title}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <li
            key={value}
            className={cn(
              "px-2.5 py-1 text-xs",
              variant === "subjects"
                ? "bg-primary-wash text-primary"
                : "border border-border/80 bg-muted/50 text-foreground",
            )}
          >
            {value}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface CaricatureDetailPanelProps {
  title: string
  children: ReactNode
  className?: string
}

export function CaricatureDetailPanel({ title, children, className }: CaricatureDetailPanelProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <h2 className="border-b border-border/50 pb-2.5 text-xs font-semibold text-foreground">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

interface CaricatureArtworkTextSectionProps {
  originalText: string | null
  translation: string | null
  languageLabel: string | null
  showOriginal: boolean
  className?: string
}

export function CaricatureArtworkTextSection({
  originalText,
  translation,
  languageLabel,
  showOriginal,
  className,
}: CaricatureArtworkTextSectionProps) {
  const hasOriginal = showOriginal && Boolean(originalText?.trim())
  const hasTranslation = Boolean(translation?.trim())

  if (!hasOriginal && !hasTranslation) return null

  return (
    <section className={cn("space-y-5", className)}>
      <h2 className="border-b border-border/50 pb-2.5 text-xs font-semibold text-foreground">
        In the artwork
      </h2>

      <div className="space-y-5">
        {hasOriginal ? (
          <div className="border-l-2 border-primary pl-4">
            {languageLabel ? (
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{languageLabel}</p>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{originalText}</p>
          </div>
        ) : null}

        {hasTranslation ? (
          <div
            className={cn(
              "border-l-2 border-border pl-4",
              hasOriginal && "border-t border-border-subtle pt-5",
            )}
          >
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">English translation</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-body">{translation}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

interface CaricatureDetailTextBlockProps {
  title: string
  children: ReactNode
  className?: string
}

/** @deprecated Prefer CaricatureArtworkTextSection for grouped artwork copy. */
export function CaricatureDetailTextBlock({ title, children, className }: CaricatureDetailTextBlockProps) {
  return (
    <section className={cn("space-y-2 border-t border-border bg-background px-4 py-5 sm:px-5", className)}>
      <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  )
}

interface CaricatureCategoryLabelProps {
  className?: string
}

export function CaricatureCategoryLabel({ className }: CaricatureCategoryLabelProps) {
  return (
    <p className={cn("text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground", className)}>
      Caricature
    </p>
  )
}

interface CaricatureStatusBadgeProps {
  label: string
  className?: string
}

export function CaricatureStatusBadge({ label, className }: CaricatureStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700",
        className,
      )}
    >
      {label}
    </span>
  )
}
