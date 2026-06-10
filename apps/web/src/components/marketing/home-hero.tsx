import { SearchBar } from "@/components/shared/search-bar";
import { HeroBackdropStrip, type HeroBackdropItem } from "@/components/marketing/hero-backdrop-strip";

interface HomeHeroProps {
  items: HeroBackdropItem[];
}

export function HomeHero({ items }: HomeHeroProps) {
  return (
    <section
      className="relative flex min-h-[clamp(26rem,55vh,35rem)] w-full items-center justify-center overflow-hidden bg-white"
      aria-label="Fotocorp image archive search"
    >
      <HeroBackdropStrip items={items} />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl -translate-y-2 flex-col items-center px-4 text-center sm:px-6 md:-translate-y-4 md:px-8">
        <h1 className="w-full max-w-[34ch] font-heading font-normal leading-[0.98] tracking-tight text-foreground text-[clamp(1.5rem,4.1vw,3rem)] sm:max-w-[42ch] sm:leading-none md:max-w-none">
          <span className="block min-[480px]:hidden">
            Access India&apos;s largest archive
          </span>
          <span className="block min-[480px]:hidden">
            of people &amp; editorial images
          </span>
          <span className="hidden min-[480px]:block">
            Access India&apos;s largest archive of
          </span>
          <span className="hidden min-[480px]:block">
            people &amp; editorial images
          </span>
        </h1>
        <p className="fc-body-serif-md mx-auto mt-3 mb-6 w-full max-w-[54ch] text-foreground text-[clamp(1rem,1.45vw,1.125rem)] leading-snug [text-shadow:0_0_20px_rgba(255,255,255,0.95),0_1px_3px_rgba(255,255,255,0.85)] md:mt-4 md:mb-7">
          <span className="block">
            One million pictures spanning personalities, places and events
          </span>
          <span className="block">
            that have defined India over the years&hellip;and updated daily
          </span>
        </p>

        <div className="relative z-20 w-full">
          <SearchBar
            size="lg"
            variant="sharp"
            navigate
            placeholder="AI-enabled search across 1M+ images"
            className="border border-border/90 bg-background/96 backdrop-blur-md transition-shadow shadow-[0_14px_44px_rgba(13,15,26,0.12)] focus-within:shadow-[0_18px_54px_rgba(13,15,26,0.16)]"
          />
        </div>
      </div>
    </section>
  );
}
