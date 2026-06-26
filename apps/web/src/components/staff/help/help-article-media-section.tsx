import type { HelpArticleMediaItem } from "@/lib/api/staff-help-api"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"

interface HelpArticleMediaSectionProps {
  media: HelpArticleMediaItem[]
}

export function HelpArticleMediaSection({ media }: HelpArticleMediaSectionProps) {
  const readyMedia = media.filter((item) => item.displayUrl || item.uploadStatus === "READY" || !item.uploadStatus)
  if (!readyMedia.length) return null

  const sorted = [...readyMedia].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Media</h2>
      <div className="space-y-6">
        {sorted.map((item) => (
          <article key={item.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
            {item.title ? <h3 className="font-medium text-foreground">{item.title}</h3> : null}
            {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}

            {item.mediaType === "VIDEO" ? (
              <video
                controls
                preload="metadata"
                className="w-full max-w-3xl rounded-md border border-border bg-black"
                src={getHelpMediaDisplayUrl(item.id)}
              >
                Your browser does not support embedded video playback.
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getHelpMediaDisplayUrl(item.id)}
                alt={item.title ?? item.description ?? "Help article screenshot"}
                loading="lazy"
                className="w-full max-w-3xl rounded-md border border-border object-contain bg-background"
              />
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
