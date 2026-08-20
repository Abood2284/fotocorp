import { Mail } from "lucide-react"

import { SUBSCRIPTION_MAILTO } from "@/lib/subscription-inquiry-mailto"

export function HomeAnniversaryBanner() {
  return (
    <section
      aria-labelledby="fotocorp-anniversary-title"
      className="relative isolate overflow-hidden border-b border-white/15 bg-black text-white"
    >
      <div className="mx-auto flex min-h-[4.25rem] w-full max-w-[1600px] items-center">
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)]">
          <div className="home-anniversary-marquee-track flex w-max items-center">
            <AnniversaryMarqueeItem />
            <AnniversaryMarqueeItem isDuplicate />
          </div>
        </div>

        <div className="relative z-10 shrink-0 bg-black py-2 pr-3 pl-2 sm:pr-6 sm:pl-3 lg:pr-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-full w-8 bg-gradient-to-l from-black to-transparent"
          />
          <a
            href={SUBSCRIPTION_MAILTO}
            className="inline-flex min-h-9 items-center justify-center gap-2 border border-white bg-white px-3 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-black transition-colors duration-200 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-4 sm:text-[10px]"
          >
            <Mail aria-hidden className="size-3.5" strokeWidth={1.75} />
            <span className="sm:hidden">Email us</span>
            <span className="hidden sm:inline">Contact licensing</span>
          </a>
        </div>
      </div>
    </section>
  )
}

interface AnniversaryMarqueeItemProps {
  isDuplicate?: boolean
}

function AnniversaryMarqueeItem({ isDuplicate = false }: AnniversaryMarqueeItemProps) {
  const titleClassName =
    "whitespace-nowrap font-heading text-lg font-normal leading-tight tracking-tight text-white sm:text-xl"

  return (
    <div
      aria-hidden={isDuplicate || undefined}
      className="flex shrink-0 items-center gap-4 py-2 pr-12 pl-4 sm:gap-5 sm:pr-16 sm:pl-6 lg:pl-8"
    >
      <div>
        {isDuplicate ? (
          <div className={titleClassName}>22 Years of Capturing India’s Stories</div>
        ) : (
          <h2 id="fotocorp-anniversary-title" className={titleClassName}>
            22 Years of Capturing India’s Stories
          </h2>
        )}
      </div>

      <span aria-hidden className="h-8 w-px shrink-0 bg-white/20" />

      <div className="whitespace-nowrap font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60">
        Subscriptions from{" "}
        <span className="font-heading text-lg font-normal normal-case tracking-normal text-white">
          ₹5,000
        </span>
        <span className="ml-1 normal-case tracking-normal">/ month</span>
      </div>
    </div>
  )
}
