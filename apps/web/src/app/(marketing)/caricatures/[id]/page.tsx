import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PreviewImage } from "@/components/assets/preview-image"
import { getPublicCaricature } from "@/lib/api/fotocorp-api"
import { buildCaricatureSearchBackHref, formatCaricatureLanguageLabel } from "@/lib/search/caricature-search"
import { cn } from "@/lib/utils"

interface CaricatureDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ q?: string; segment?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: CaricatureDetailPageProps) {
  const { id } = await params
  const result = await getPublicCaricature(id).catch(() => null)
  if (!result) {
    return { title: "Caricature Not Found — Fotocorp" }
  }

  const { caricature } = result
  const preview = caricature.previews.detail ?? caricature.previews.card
  return {
    title: `${caricature.headline} — Fotocorp`,
    description: caricature.description,
    openGraph: {
      title: `${caricature.headline} — Fotocorp`,
      description: caricature.description,
      images: preview?.url ? [{ url: preview.url, alt: caricature.headline }] : [],
    },
  }
}

export default async function CaricatureDetailPage({ params, searchParams }: CaricatureDetailPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const result = await getPublicCaricature(id).catch(() => null)
  if (!result) notFound()

  const { caricature } = result
  const preview = caricature.previews.detail ?? caricature.previews.card
  const backHref = buildCaricatureSearchBackHref(resolvedSearchParams?.q)
  const publishedDate = formatPublishedDate(caricature.publishedAt)

  return (
    <div className="bg-background pb-20">
      <div className="border-b border-border bg-surface-warm/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={16} aria-hidden />
            Back to caricatures
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:px-6">
        <section className="space-y-4">
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-border bg-muted",
              preview ? "mx-auto w-full" : "flex min-h-[320px] items-center justify-center",
            )}
            style={preview ? { aspectRatio: `${preview.width} / ${preview.height}` } : undefined}
          >
            {preview ? (
              <PreviewImage
                src={preview.url}
                alt={caricature.headline}
                className="h-full w-full object-contain"
                loading="eager"
              />
            ) : (
              <p className="px-6 text-center text-sm text-muted-foreground">
                Preview is being prepared.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Public preview only. Licensed downloads require an active caricature entitlement.
          </p>
        </section>

        <aside className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caricature</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{caricature.headline}</h1>
            <p className="text-sm text-muted-foreground">{caricature.description}</p>
          </div>

          <dl className="grid gap-4 text-sm">
            <DetailRow label="Credit" value={caricature.credit} />
            <DetailRow label="Category" value={caricature.categoryName} />
            <DetailRow label="Language" value={formatCaricatureLanguageLabel(caricature.language)} />
            <DetailRow label="Published" value={publishedDate} />
          </dl>

          {caricature.hasVisibleText && caricature.visibleText ? (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Visible text</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{caricature.visibleText}</p>
              {caricature.visibleTextTranslationEn ? (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">English translation</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {caricature.visibleTextTranslationEn}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {caricature.keywords.length > 0 ? (
            <TagSection label="Keywords" values={caricature.keywords} />
          ) : null}

          {caricature.depictedSubjects.length > 0 ? (
            <TagSection label="Depicted subjects" values={caricature.depictedSubjects} />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  )
}

function TagSection({ label, values }: { label: string; values: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li
            key={value}
            className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
          >
            {value}
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatPublishedDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}
