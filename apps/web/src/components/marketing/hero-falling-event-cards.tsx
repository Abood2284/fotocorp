"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicHomepageEvent } from "@/features/assets/types"

interface CardSlot {
  r: string
  dur: string
  ms: number
  width: number
  height: number
  style: React.CSSProperties
  eager?: boolean
}

// 10 positioned slots matching the concept layout (5 left, 5 right)
const SLOTS: CardSlot[] = [
  // LEFT
  { r: "-13deg", dur: "1.05s", ms: 180,  width: 160, height: 208, style: { left: "3%",  top: "10%" },          eager: true },
  { r:   "6deg", dur: "1.08s", ms: 340,  width: 185, height: 132, style: { left: "0%",  top: "46%" } },
  { r:  "-6deg", dur: "1.12s", ms: 500,  width: 155, height: 192, style: { left: "4%",  top: "63%" } },
  { r:   "4deg", dur:  ".97s", ms: 620,  width: 148, height: 172, style: { left: "14%", top: "19%" },          eager: true },
  { r:  "-9deg", dur: "1.0s",  ms: 760,  width: 172, height: 128, style: { left: "18%", bottom: "8%" } },
  // RIGHT
  { r:  "13deg", dur: "1.05s", ms: 240,  width: 168, height: 218, style: { right: "3%",  top: "7%" },          eager: true },
  { r:  "-8deg", dur: "1.09s", ms: 400,  width: 178, height: 136, style: { right: "1%",  top: "43%" } },
  { r:   "7deg", dur: "1.11s", ms: 560,  width: 160, height: 188, style: { right: "5%",  top: "61%" } },
  { r: "-15deg", dur:  ".96s", ms: 680,  width: 152, height: 168, style: { right: "14%", top: "22%" } },
  { r:   "9deg", dur: "1.0s",  ms: 820,  width: 160, height: 138, style: { right: "18%", bottom: "9%" } },
]

function formatEventTag(event: PublicHomepageEvent): string {
  if (!event.eventDate) return `${event.assetCount > 0 ? `${event.assetCount} images` : "Collection"}`
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(event.eventDate),
    )
  } catch {
    return `${event.assetCount} images`
  }
}

// Gradient fallbacks indexed by slot so each has a distinct colour
const FALLBACK_GRADIENTS = [
  "linear-gradient(160deg,#B03810 0%,#E46A28 45%,#F4A250 100%)",
  "linear-gradient(140deg,#1B3C22 0%,#2D6E44 50%,#5CAC78 100%)",
  "linear-gradient(150deg,#152744 0%,#1E497C 50%,#3A7CC0 100%)",
  "linear-gradient(145deg,#4A2710 0%,#8C5020 45%,#C88E48 100%)",
  "linear-gradient(155deg,#7A4A10 0%,#C47C20 50%,#E8A83C 100%)",
  "linear-gradient(155deg,#5A0E6E 0%,#9E1E98 45%,#DC5EC8 100%)",
  "linear-gradient(145deg,#6C0C1A 0%,#B41A2C 50%,#E4445C 100%)",
  "linear-gradient(150deg,#181818 0%,#2C2C2C 40%,#585858 80%,#868686 100%)",
  "linear-gradient(140deg,#0C3C3E 0%,#186E7A 50%,#2AAEC0 100%)",
  "linear-gradient(145deg,#281060 0%,#481E94 50%,#7448C4 100%)",
]

interface Props {
  events: PublicHomepageEvent[]
}

export function HeroFallingEventCards({ events }: Props) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mediaQuery.matches) {
      // Show all at final state immediately
      cardRefs.current.forEach((el) => {
        if (el) el.classList.add("fc-card-visible")
      })
      return
    }

    const timers = SLOTS.map((slot, i) =>
      setTimeout(() => {
        const el = cardRefs.current[i]
        if (el) el.classList.add("land")
      }, slot.ms),
    )

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div
      className="pointer-events-none absolute inset-0 z-2"
      aria-hidden="true"
    >
      {SLOTS.map((slot, i) => {
        const event = events[i]
        const cardStyle: React.CSSProperties = {
          ...slot.style,
          position: "absolute",
          width: slot.width,
          height: slot.height,
          // CSS custom props for the keyframe
          // @ts-expect-error CSS custom properties
          "--r": slot.r,
          "--dur": slot.dur,
        }

        const inner = event ? (
          <Link
            href={`/search?eventId=${event.id}`}
            className="pointer-events-auto block h-full w-full"
            tabIndex={-1}
          >
            {event.previewUrl ? (
              <PreviewImage
                src={event.previewUrl}
                alt={event.title}
                className="h-full w-full object-cover"
                loading={slot.eager ? "eager" : "lazy"}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: FALLBACK_GRADIENTS[i] }}
              />
            )}
            <div className="fc-card-meta absolute inset-x-0 bottom-0 z-1 bg-linear-to-t from-black/80 to-transparent px-3 pb-2.5 pt-7">
              <div className="fc-card-tag text-[9px] font-medium uppercase tracking-widest text-white/50">
                {formatEventTag(event)}
              </div>
              <div className="fc-card-name mt-0.5 line-clamp-1 text-[11px] text-white/82 font-normal">
                {event.title}
              </div>
            </div>
            {/* Light sheen */}
            <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,transparent_45%,rgba(0,0,0,0.18)_100%)]" />
          </Link>
        ) : (
          <>
            <div
              className="h-full w-full"
              style={{ background: FALLBACK_GRADIENTS[i] }}
            />
            <div className="fc-card-meta absolute inset-x-0 bottom-0 z-1 bg-linear-to-t from-black/80 to-transparent px-3 pb-2.5 pt-7">
              <div className="fc-card-tag text-[9px] font-medium uppercase tracking-widest text-white/50">
                Archive · Fotocorp
              </div>
              <div className="fc-card-name mt-0.5 text-[11px] text-white/82">
                Explore collection
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,transparent_45%,rgba(0,0,0,0.18)_100%)]" />
          </>
        )

        return (
          <div
            key={i}
            ref={(el) => { cardRefs.current[i] = el }}
            className="fc-falling-card overflow-hidden rounded-[10px] shadow-[0_28px_72px_rgba(0,0,0,.45),0_4px_18px_rgba(0,0,0,.32)]"
            style={cardStyle}
          >
            {inner}
          </div>
        )
      })}
    </div>
  )
}
