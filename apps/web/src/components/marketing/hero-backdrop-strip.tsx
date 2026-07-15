"use client"

import { useState } from "react"

export interface HeroBackdropItem {
  id: string
  title: string
  href: string
  imageUrl: string | null
}

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

const STRIP_SLOT_COUNT = 15

interface HeroBackdropStripProps {
  items: HeroBackdropItem[]
}

export function HeroBackdropStrip({ items }: HeroBackdropStripProps) {
  const slots =
    items.length > 0
      ? Array.from({ length: STRIP_SLOT_COUNT }, (_, i) => items[i % items.length])
      : Array.from({ length: STRIP_SLOT_COUNT }, () => null)

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-stretch justify-center opacity-[0.38] sm:opacity-[0.34] md:opacity-[0.30]"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(180deg, transparent 0%, black 3%, black 97%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <div className="flex h-full min-h-[clamp(26rem,55vh,35rem)] w-max max-w-none shrink-0 items-stretch">
          {slots.map((item, i) => (
            <div
              key={`${item?.id ?? "fallback"}-${i}`}
              className="relative h-full w-28 shrink-0 overflow-hidden sm:w-32 md:w-36 lg:w-40"
            >
              {item?.imageUrl ? (
                <HeroImage
                  src={item.imageUrl}
                  alt=""
                  loading={i < 5 ? "eager" : "lazy"}
                  fallbackIndex={i}
                />
              ) : (
                <HeroFallback index={i} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_42%,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.28)_45%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.32)_0%,transparent_30%,transparent_70%,rgba(255,255,255,0.22)_100%)]" />
    </div>
  )
}

function HeroImage({
  alt,
  fallbackIndex,
  loading,
  src,
}: {
  alt: string
  fallbackIndex: number
  loading: "eager" | "lazy"
  src: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) return <HeroFallback index={fallbackIndex} />

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover brightness-[1.02] saturate-[1.02] contrast-[1.02]"
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

function HeroFallback({ index }: { index: number }) {
  return (
    <div
      className="h-full w-full"
      style={{ background: FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length] }}
    />
  )
}
