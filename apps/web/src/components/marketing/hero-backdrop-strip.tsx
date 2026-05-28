"use client"

import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicHomepageEvent } from "@/features/assets/types"

const FALLBACK_GRADIENTS = [
  "linear-gradient(150deg,#111111 0%,#2a2a2a 50%,#555555 100%)",
  "linear-gradient(145deg,#1c1c1c 0%,#333333 50%,#666666 100%)",
  "linear-gradient(140deg,#0f0f0f 0%,#262626 50%,#525252 100%)",
  "linear-gradient(150deg,#1f1f1f 0%,#3d3d3d 50%,#7a7a7a 100%)",
  "linear-gradient(145deg,#121212 0%,#2c2c2c 50%,#5a5a5a 100%)",
  "linear-gradient(150deg,#222222 0%,#444444 50%,#888888 100%)",
  "linear-gradient(145deg,#181818 0%,#363636 50%,#737373 100%)",
  "linear-gradient(140deg,#1d1d1d 0%,#3a3a3a 50%,#777777 100%)",
  "linear-gradient(155deg,#151515 0%,#313131 50%,#6e6e6e 100%)",
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
                  className="h-full w-full min-w-28 object-cover grayscale saturate-0 sm:min-w-32 md:min-w-36 lg:min-w-40"
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

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_68%_at_50%_48%,#ffffff_0%,rgba(255,255,255,0.72)_38%,rgba(255,255,255,0.32)_64%,transparent_94%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-white/75 via-transparent to-white/75" />
    </div>
  )
}
