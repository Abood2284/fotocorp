import Link from "next/link"
import { Calendar, ImageIcon, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getContributorImages, type ContributorImageItem } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "Contributor Images",
}

interface ContributorImagesPageProps {
  searchParams: Promise<{
    cursor?: string
  }>
}

export default async function ContributorImagesPage({ searchParams }: ContributorImagesPageProps) {
  await requireContributorPasswordReady()
  const params = await searchParams
  const cookieHeader = await getContributorCookieHeader()
  const result = await getContributorImages({ limit: 24, cursor: params.cursor }, { cookieHeader }).catch(() => null)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your image archive</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Images</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Only images linked to your contributor account are shown here. Original files and storage details are never exposed.
          </p>
        </div>
      </header>

      {!result ? (
        <section className="rounded-3xl border border-border bg-background p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">We could not load your images.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
        </section>
      ) : result.items.length === 0 ? (
        <section className="rounded-3xl border border-border bg-background p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">No images are currently linked to your contributor account.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Contact Fotocorp if you expected to see image records here.</p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <ContributorImageCard key={item.id} item={item} />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Link
              href="/contributor/images"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              First page
            </Link>
            {result.nextCursor && (
              <Link
                href={`/contributor/images?cursor=${encodeURIComponent(result.nextCursor)}`}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Next page
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ContributorImageCard({ item }: { item: ContributorImageItem }) {
  const title = item.headline || item.title || item.legacyImageCode || "Untitled image"
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="mt-2 text-xs">Preview not exposed</span>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.status}</Badge>
          <Badge variant="muted">{item.visibility}</Badge>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {item.legacyImageCode ?? "No Fotokey"}
          </p>
          <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-foreground">{title}</h2>
          {item.caption && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.caption}</p>}
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {item.event.name && <p className="font-medium text-foreground">{item.event.name}</p>}
          {item.event.date && (
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(item.event.date)}
            </p>
          )}
          {item.event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {item.event.location}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <DerivativeBadge label="THUMB" ready={item.derivatives.thumb} />
          <DerivativeBadge label="CARD" ready={item.derivatives.card} />
          <DerivativeBadge label="DETAIL" ready={item.derivatives.detail} />
        </div>
      </div>
    </article>
  )
}

function DerivativeBadge({ label, ready }: { label: string; ready: boolean }) {
  return <Badge variant={ready ? "success" : "muted"}>{label}</Badge>
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}
