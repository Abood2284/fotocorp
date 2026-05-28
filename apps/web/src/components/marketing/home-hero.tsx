import { SearchBar } from "@/components/shared/search-bar"
import { HeroBackdropStrip } from "@/components/marketing/hero-backdrop-strip"
import type { PublicHomepageEvent } from "@/features/assets/types"

interface HomeHeroProps {
  events: PublicHomepageEvent[]
}

export function HomeHero({ events }: HomeHeroProps) {
  return (
    <section
      className="relative flex min-h-72 w-full items-center justify-center overflow-hidden bg-white md:min-h-84"
      aria-label="Fotocorp image archive search"
    >
      <HeroBackdropStrip events={events} />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-6 text-center">
        <h1 className="fc-display-lg mb-2 w-full max-w-[100vw] whitespace-nowrap text-center font-normal leading-none text-foreground [font-size:clamp(1.5rem,5.25vw,3rem)]">
          India&apos;s licensed news photography
        </h1>
        <p className="fc-body-serif-md mb-4 max-w-md text-center text-muted-foreground">
          Editorial, sports, celebrity, and archive imagery for newsrooms and publishers.
        </p>

        <div className="relative z-20 w-full max-w-xl">
          <SearchBar
            size="lg"
            variant="sharp"
            showTypeSelect
            typeSelectMenuPlacement="above"
            navigate
            placeholder="Search 1M+ licensed images…"
            className="border border-border bg-background shadow-[0_2px_12px_rgba(26,37,64,0.08)] focus-within:shadow-[0_4px_20px_rgba(26,37,64,0.11)] transition-shadow"
          />
        </div>
      </div>
    </section>
  )
}
