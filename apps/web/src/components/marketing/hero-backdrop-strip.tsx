"use client"

import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicHomepageEvent } from "@/features/assets/types"

const FALLBACK_GRADIENTS = [
  "linear-gradient(150deg,#1a2540 0%,#263460 55%,#3a5a8c 100%)",
  "linear-gradient(145deg,#4A2710 0%,#8C5020 50%,#C88E48 100%)",
  "linear-gradient(140deg,#1B3C22 0%,#2D6E44 50%,#5CAC78 100%)",
  "linear-gradient(150deg,#152744 0%,#1E497C 50%,#3A7CC0 100%)",
  "linear-gradient(145deg,#6C0C1A 0%,#B41A2C 50%,#E4445C 100%)",
  "linear-gradient(150deg,#181818 0%,#3a3a3a 50%,#686868 100%)",
  "linear-gradient(145deg,#9a6108 0%,#c07c0a 50%,#e8b84a 100%)",
  "linear-gradient(140deg,#0C3C3E 0%,#186E7A 50%,#2AAEC0 100%)",
  "linear-gradient(155deg,#5A0E6E 0%,#9E1E98 50%,#DC5EC8 100%)",
]

const STRIP_SLOT_COUNT = 9

interface HeroBackdropStripProps {
  events: PublicHomepageEvent[]
}

export function HeroBackdropStrip({ events }: HeroBackdropStripProps) {
  const slots = Array.from({ length: STRIP_SLOT_COUNT }, (_, i) => events[i])

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-stretch justify-center opacity-[0.52] saturate-[0.95] contrast-[1.04] sm:opacity-50 md:opacity-[0.48]"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(180deg, transparent 0%, black 8%, black 92%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <div className="flex h-full min-h-52 w-max max-w-none shrink-0 items-stretch gap-0.5 py-3 sm:min-h-56 sm:py-4 md:min-h-0 md:py-5">
          {slots.map((event, i) => (
            <div
              key={i}
              className="relative aspect-[3/4] h-full w-auto shrink-0 overflow-hidden bg-muted"
            >
              {event?.previewUrl ? (
                <PreviewImage
                  src={event.previewUrl}
                  alt=""
                  className="h-full w-full min-w-28 object-cover sm:min-w-32 md:min-w-36 lg:min-w-40"
                  loading={i < 3 ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="h-full min-w-28 sm:min-w-32 md:min-w-36 lg:min-w-40"
                  style={{ background: FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length] }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_68%_at_50%_48%,#faf8f5_0%,rgba(250,248,245,0.72)_38%,rgba(250,248,245,0.32)_64%,transparent_94%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-surface-warm/75 via-transparent to-surface-warm/75" />
    </div>
  )
}
