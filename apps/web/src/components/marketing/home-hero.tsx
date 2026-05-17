import { SearchBar } from "@/components/shared/search-bar"
import { HeroFallingEventCards } from "@/components/marketing/hero-falling-event-cards"
import type { PublicHomepageEvent } from "@/features/assets/types"

const QUICK_LINKS = [
  { label: "Editorial coverage", href: "/search?sort=latest" },
  { label: "Celebrity imagery",  href: "/search?category=celebrity" },
  { label: "Sports archives",    href: "/search?category=sports" },
  { label: "Licensed downloads", href: "/search" },
]

interface HomeHeroProps {
  events: PublicHomepageEvent[]
}

export function HomeHero({ events }: HomeHeroProps) {
  return (
    <section
      className="hero-falling relative w-full overflow-hidden"
      style={{ minHeight: "calc(100dvh - 3.75rem)" }}
      aria-label="Fotocorp image archive search"
    >
      {/* ── Scoped CSS ──────────────────────────────────────────── */}
      <style>{`
        .hero-falling {
          background: #faf8f5;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Falling card base state */
        .hero-falling .fc-falling-card {
          opacity: 0;
          transform: translateY(-420px) rotate(var(--r)) scale(.88);
          will-change: transform, opacity;
        }

        @keyframes fcDropIn {
          0%   { transform: translateY(-420px) rotate(var(--r)) scale(.88); opacity: 0; }
          55%  { opacity: 1; }
          78%  { transform: translateY(7px) rotate(var(--r)) scale(1.02); opacity: 1; }
          100% { transform: translateY(0)    rotate(var(--r)) scale(1);    opacity: 1; }
        }

        .hero-falling .fc-falling-card.land {
          animation: fcDropIn var(--dur, 1.05s) cubic-bezier(.22,1,.36,1) forwards;
        }

        /* prefers-reduced-motion: skip animation */
        @media (prefers-reduced-motion: reduce) {
          .hero-falling .fc-falling-card {
            opacity: 1;
            transform: translateY(0) rotate(var(--r)) scale(1);
          }
          .hero-falling .fc-falling-card.land {
            animation: none;
          }
        }

        /* Mobile: hide cards 5+ */
        @media (max-width: 640px) {
          .hero-falling .fc-falling-card:nth-child(n+5) {
            display: none;
          }
        }

        /* Scroll cue pulse */
        @keyframes fcScrollPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .hero-falling .fc-scroll-line {
          animation: fcScrollPulse 2.2s ease-in-out infinite;
        }

        /* Pulse dot */
        @keyframes fcPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }

        .hero-falling .fc-pulse-dot {
          animation: fcPulseDot 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Background cards ───────────────────────────────────── */}
      <HeroFallingEventCards events={events} />

      {/* ── Centre content ─────────────────────────────────────── */}
      <main
        className="relative z-10 flex flex-col items-center text-center"
        style={{ maxWidth: 600, width: "100%", padding: "0 1.5rem" }}
      >
        {/* Badge */}
        <div
          className="fc-badge mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(192,124,10,0.35)] bg-[rgba(253,244,227,0.85)] px-3.5 py-[5px] text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[#9a6108]"
          role="presentation"
        >
          <span
            className="fc-pulse-dot h-1.5 w-1.5 rounded-full bg-[#c07c0a]"
            aria-hidden="true"
          />
          800K+ Licensable Images
        </div>

        {/* Headline */}
        <h1
          className="mb-5"
          style={{
            fontFamily: "var(--font-heading), Georgia, serif",
            fontSize: "clamp(3rem,6vw,5.4rem)",
            fontWeight: 900,
            lineHeight: 1.01,
            letterSpacing: "-0.025em",
            color: "var(--foreground)",
          }}
        >
          Every frame
          <br />
          of{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              color: "rgba(13,15,26,0.45)",
            }}
          >
            India.
          </em>
        </h1>

        {/* Sub-copy */}
        <p
          className="mb-10"
          style={{
            fontSize: "clamp(0.88rem,1.5vw,1.04rem)",
            fontWeight: 300,
            lineHeight: 1.72,
            color: "rgba(75,85,99,0.75)",
            maxWidth: 430,
          }}
        >
          From cricket grounds to corridors of power — Fotocorp is India&apos;s
          most trusted source for editorial, sports, celebrity &amp; archive
          photography.
        </p>

        {/* Search bar */}
        <div className="relative z-20 mb-5 w-full">
          <SearchBar
            size="lg"
            variant="pill"
            showTypeSelect
            typeSelectMenuPlacement="above"
            navigate
            placeholder="Search 800,000+ licensed images…"
            className="border border-[rgba(11,11,12,0.08)] bg-white shadow-[0_2px_16px_rgba(26,37,64,0.09)] focus-within:shadow-[0_4px_24px_rgba(26,37,64,0.13)] transition-shadow"
          />
        </div>

        {/* Quick links */}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1"
          aria-label="Browse categories"
        >
          <span className="mr-0.5 text-[0.76rem] text-[rgba(75,85,99,0.45)]">
            Browse:
          </span>
          {QUICK_LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center">
              {i > 0 && (
                <span
                  className="mx-1 text-[0.7rem] text-[rgba(75,85,99,0.28)]"
                  aria-hidden="true"
                >
                  ·
                </span>
              )}
              <a
                href={link.href}
                className="rounded-full border border-transparent px-2.5 py-1 text-[0.76rem] text-[rgba(75,85,99,0.55)] transition-all duration-150 hover:border-[rgba(11,11,12,0.12)] hover:text-foreground"
              >
                {link.label}
              </a>
            </span>
          ))}
        </nav>
      </main>

      {/* ── Scroll cue ─────────────────────────────────────────── */}
      <div
        className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5"
        aria-hidden="true"
      >
        <div className="fc-scroll-line h-9 w-px bg-linear-to-b from-[rgba(11,11,12,0.18)] to-transparent" />
        <span className="text-[0.65rem] uppercase tracking-[0.12em] text-[rgba(11,11,12,0.3)]">
          Scroll
        </span>
      </div>
    </section>
  )
}
