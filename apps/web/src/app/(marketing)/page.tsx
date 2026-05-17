import { Suspense } from "react"
import { SearchBar } from "@/components/shared/search-bar"
import { HomeCategorySection } from "@/components/marketing/home-category-section"
import { HeroCollectionCards } from "@/components/marketing/hero-collection-cards"

export const metadata = {
  title: "Fotocorp — India's Premier News Photo Agency",
  description:
    "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai.",
}

const TRUST_ITEMS = [
  "Editorial coverage",
  "Celebrity imagery",
  "Sports archives",
  "Licensed downloads",
]

export default function HomePage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="hero-section relative w-full overflow-x-hidden"
        aria-label="Fotocorp image archive search"
      >
        {/* Scoped keyframes + layout helpers */}
        <style>{`
          .hero-section {
            background: #faf8f5;
            background-image:
              radial-gradient(ellipse 70% 55% at 75% 50%, rgba(192, 124, 10, 0.055) 0%, transparent 65%),
              radial-gradient(ellipse 50% 40% at 10% 85%, rgba(26, 37, 64, 0.06) 0%, transparent 60%);
            min-height: clamp(560px, 90vh, 820px);
            display: flex;
            align-items: center;
          }

          /* Faint dot-grid texture */
          .hero-section::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: radial-gradient(circle, rgba(26, 37, 64, 0.07) 1px, transparent 1px);
            background-size: 28px 28px;
            pointer-events: none;
          }

          /* Oversized ARCHIVE watermark */
          .hero-watermark {
            position: absolute;
            right: -3%;
            top: 50%;
            transform: translateY(-50%);
            font-size: clamp(6rem, 14vw, 14rem);
            font-weight: 700;
            letter-spacing: -0.04em;
            color: transparent;
            -webkit-text-stroke: 1.5px rgba(26, 37, 64, 0.055);
            user-select: none;
            pointer-events: none;
            white-space: nowrap;
            font-family: var(--font-body, system-ui, sans-serif);
            line-height: 1;
          }

          @keyframes fcFadeSlideUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .hero-animate {
            animation: fcFadeSlideUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
            opacity: 0;
          }

          .hero-card {
            animation: fcFadeSlideUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
            opacity: 0;
          }

          .hero-cards-grid {
            display: grid;
            gap: 1rem;
            height: 100%;
            grid-template-rows: 1fr 1fr;
          }

          @media (max-width: 1023px) {
            .hero-cards-grid {
              display: flex;
              gap: 0.75rem;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              scroll-snap-type: x mandatory;
              scrollbar-width: none;
              padding-bottom: 4px;
            }
            .hero-cards-grid::-webkit-scrollbar { display: none; }
            .hero-card {
              min-width: 260px;
              height: 220px;
              scroll-snap-align: start;
              flex-shrink: 0;
            }
          }

          @media (min-width: 1024px) {
            .hero-card {
              height: 100%;
            }
          }
        `}</style>

        {/* ARCHIVE watermark */}
        <span className="hero-watermark" aria-hidden="true">ARCHIVE</span>

        {/* Inner grid */}
        <div className="relative z-10 mx-auto w-full max-w-[1260px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[58fr_42fr] lg:items-center lg:gap-10 xl:gap-14">

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex flex-col">

              {/* Eyebrow */}
              <span
                className="hero-animate mb-5 inline-block w-fit rounded-sm border border-[rgba(192,124,10,0.35)] bg-[rgba(253,244,227,0.75)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9a6108]"
                style={{ animationDelay: "0ms" }}
              >
                800K+ licensable images
              </span>

              {/* Headline */}
              <h1
                className="hero-animate fc-display mb-5 text-[#0B0B0C]"
                style={{ animationDelay: "80ms" }}
              >
                India&apos;s foremost news photo agency.
              </h1>

              {/* Body */}
              <p
                className="hero-animate fc-body-lg mb-8 max-w-[520px] text-[#5F6368]"
                style={{ animationDelay: "160ms" }}
              >
                Based in Mumbai and offering Pan-India coverage, Fotocorp is your
                trusted source for high-quality editorial, celebrity, sports, and
                archive images.
              </p>

              {/* Search bar */}
              <div
                className="hero-animate relative z-20 mb-5 w-full"
                style={{ animationDelay: "240ms" }}
              >
                <SearchBar
                  size="lg"
                  variant="pill"
                  showTypeSelect
                  typeSelectMenuPlacement="above"
                  navigate
                  placeholder="Search editorial, celebrity, sports, archive images..."
                  className="border border-[rgba(11,11,12,0.08)] bg-white shadow-[0_2px_16px_rgba(26,37,64,0.09)] focus-within:shadow-[0_4px_24px_rgba(26,37,64,0.13)] transition-shadow"
                />
              </div>

              {/* Trust / value row */}
              <div
                className="hero-animate relative z-0 flex flex-wrap items-center gap-x-4 gap-y-2"
                style={{ animationDelay: "320ms" }}
              >
                {TRUST_ITEMS.map((item, i) => (
                  <span key={item} className="flex items-center gap-2 text-[13px] text-[#5F6368]">
                    {i > 0 && (
                      <span className="h-3 w-px rounded-full bg-[#c9c0b0]" aria-hidden="true" />
                    )}
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
            <div className="h-[460px] lg:h-[500px] xl:h-[540px]">
              <Suspense fallback={
                <div className="hero-cards-grid">
                  <div className="w-full animate-pulse rounded-2xl bg-muted" />
                  <div className="w-full animate-pulse rounded-2xl bg-muted" />
                </div>
              }>
                <HeroCollectionCards />
              </Suspense>
            </div>

          </div>
        </div>
      </section>

      <HomeCategorySection />
    </>
  )
}
