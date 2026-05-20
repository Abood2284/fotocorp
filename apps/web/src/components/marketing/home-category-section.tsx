"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PublicEventsGrid } from "@/components/assets/public-events-grid"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { fetchPublicLatestEvents, listPublicAssets } from "@/lib/api/fotocorp-api"
import type { PublicAsset, PublicEvent, PublicHomepageEvent } from "@/features/assets/types"

type TabType = "Editorial" | "Video" | "Caricature" | "Creative"
type EditorialSubcategory = "Latest" | "News" | "Sports" | "Entertainment" | "Retro"
type LoadState = "idle" | "loading" | "ready" | "error"

interface AssetSectionState {
  items: PublicAsset[]
  state: LoadState
}

const ASSET_SECTION_UNAVAILABLE_COPY = "This section is temporarily unavailable."
const LATEST_EVENTS_LIMIT = 15
const ASSET_SECTION_LIMIT = 15
const NEWEST_ASSETS_LIMIT = 50

const EDITORIAL_SECTIONS: Record<Exclude<EditorialSubcategory, "Latest">, { title: string; query: string }> = {
  News: { title: "News", query: "News" },
  Sports: { title: "Sports", query: "Sports" },
  Entertainment: { title: "Entertainment", query: "Entertainment" },
  Retro: { title: "Retro", query: "Retro" },
}

const CREATIVE_CARDS = [
  {
    id: 1,
    image: "/images/category_card_1.png",
    brand: "fotocorp",
    title: "Media Manager",
    subtitle: "Never Lose a Download Again",
    description: "Automatically store, manage, and access licensed Fotocorp content across teams and locations.",
    buttonText: "Explore Media Manager",
    link: "/services",
  },
  {
    id: 2,
    image: "/images/category_card_2.png",
    brand: "",
    title: "Latest Editors' Picks",
    subtitle: "",
    description: "Curated, compelling, and worth your time. Explore our latest gallery of Editors' Picks.",
    buttonText: "Browse Editor's Favourites",
    link: "/search?sort=newest",
  },
  {
    id: 3,
    image: "/images/category_card_3.png",
    brand: "",
    title: "Unrivaled Entertainment Coverage",
    subtitle: "",
    description: "Exclusive access. Insider moments. Experience the best of the Bollywood industry.",
    buttonText: "Explore Entertainment",
    link: "/search",
  },
]

function mapHomepageEventToPublicEvent(event: PublicHomepageEvent): PublicEvent {
  const displayDate = event.eventDate ?? event.createdAt
  return {
    id: event.id,
    name: event.title,
    eventDate: displayDate,
    createdAt: event.createdAt,
    assetCount: event.assetCount,
    preview: {
      url: event.previewUrl,
      width: event.previewWidth ?? 300,
      height: event.previewHeight ?? 200,
    },
  }
}

function useLazyAssetSection(options: {
  enabled: boolean
  query?: string
  limit: number
}): [RefObject<HTMLDivElement | null>, AssetSectionState] {
  const ref = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [section, setSection] = useState<AssetSectionState>({ items: [], state: "idle" })

  useEffect(() => {
    if (!options.enabled || nearViewport) return
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: "600px 0px" },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [nearViewport, options.enabled])

  useEffect(() => {
    if (!options.enabled || !nearViewport || section.state !== "idle") return
    let cancelled = false
    setSection((current) => ({ ...current, state: "loading" }))

    listPublicAssets({
      q: options.query,
      limit: options.limit,
      sort: "newest",
    })
      .then((response) => {
        if (!cancelled) setSection({ items: response.items, state: "ready" })
      })
      .catch(() => {
        if (!cancelled) setSection({ items: [], state: "error" })
      })

    return () => {
      cancelled = true
    }
  }, [nearViewport, options.enabled, options.limit, options.query, section.state])

  return [ref, section]
}

export function HomeCategorySection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>("Editorial")
  const [editorialSub, setEditorialSub] = useState<EditorialSubcategory>("Latest")
  const [latestEvents, setLatestEvents] = useState<PublicHomepageEvent[]>([])
  const [latestEventsState, setLatestEventsState] = useState<LoadState>("loading")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMoreEvents, setHasMoreEvents] = useState(false)
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)

  const [newsRef, news] = useLazyAssetSection({
    enabled: activeTab === "Editorial" && (editorialSub === "Latest" || editorialSub === "News"),
    query: EDITORIAL_SECTIONS.News.query,
    limit: ASSET_SECTION_LIMIT,
  })
  const [sportsRef, sports] = useLazyAssetSection({
    enabled: activeTab === "Editorial" && (editorialSub === "Latest" || editorialSub === "Sports"),
    query: EDITORIAL_SECTIONS.Sports.query,
    limit: ASSET_SECTION_LIMIT,
  })
  const [entertainmentRef, entertainment] = useLazyAssetSection({
    enabled: activeTab === "Editorial" && (editorialSub === "Latest" || editorialSub === "Entertainment"),
    query: EDITORIAL_SECTIONS.Entertainment.query,
    limit: ASSET_SECTION_LIMIT,
  })
  const [retroRef, retro] = useLazyAssetSection({
    enabled: activeTab === "Editorial" && (editorialSub === "Latest" || editorialSub === "Retro"),
    query: EDITORIAL_SECTIONS.Retro.query,
    limit: ASSET_SECTION_LIMIT,
  })
  const [newestRef, newest] = useLazyAssetSection({
    enabled: activeTab === "Creative",
    limit: NEWEST_ASSETS_LIMIT,
  })

  useEffect(() => {
    let cancelled = false
    setLatestEventsState("loading")

    fetchPublicLatestEvents({ windowDays: 30, limit: LATEST_EVENTS_LIMIT })
      .then((response) => {
        if (cancelled) return
        setLatestEvents(response.items)
        setNextCursor(response.nextCursor)
        setHasMoreEvents(response.hasMore)
        setLatestEventsState("ready")
      })
      .catch(() => {
        if (!cancelled) setLatestEventsState("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeTab === "Creative" && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      if (container.children.length > 1) {
        requestAnimationFrame(() => {
          const secondCard = container.children[1] as HTMLElement
          container.scrollLeft = secondCard.offsetLeft - (container.clientWidth - secondCard.clientWidth) / 2
        })
      }
    }
  }, [activeTab])

  const loadMoreEvents = useCallback(async () => {
    if (!nextCursor || loadingMoreEvents) return
    setLoadingMoreEvents(true)

    try {
      const response = await fetchPublicLatestEvents({
        windowDays: 30,
        limit: LATEST_EVENTS_LIMIT,
        cursor: nextCursor,
      })
      setLatestEvents((current) => [...current, ...response.items])
      setNextCursor(response.nextCursor)
      setHasMoreEvents(response.hasMore)
    } catch {
      setLatestEventsState("error")
    } finally {
      setLoadingMoreEvents(false)
    }
  }, [loadingMoreEvents, nextCursor])

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -window.innerWidth * 0.8, behavior: "smooth" })
  }

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: window.innerWidth * 0.8, behavior: "smooth" })
  }

  const handleTabClick = (tab: TabType) => {
    if (tab === "Video" || tab === "Caricature") return
    setActiveTab(tab)
  }

  const latestEventItems = latestEvents.map(mapHomepageEventToPublicEvent)

  return (
    <section className="w-full bg-background pt-4 pb-10">
      <div className="mx-auto flex w-full flex-col items-center">
        <div className="flex w-full flex-wrap justify-center gap-x-12 gap-y-4 pb-0 text-base font-medium text-foreground sm:gap-x-16 sm:text-[17px]">
          <button
            onClick={() => handleTabClick("Editorial")}
            className={`pb-1 transition-all ${
              activeTab === "Editorial"
                ? "border-b-[3px] border-accent font-semibold text-foreground"
                : "border-b-[3px] border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Editorial
          </button>
          <button
            disabled
            className="cursor-not-allowed border-b-[3px] border-transparent pb-1 text-muted-foreground opacity-50"
          >
            Video
          </button>
          <button
            disabled
            className="cursor-not-allowed border-b-[3px] border-transparent pb-1 text-muted-foreground opacity-50"
          >
            Caricature
          </button>
          <button
            onClick={() => handleTabClick("Creative")}
            className={`pb-1 transition-all ${
              activeTab === "Creative"
                ? "border-b-[3px] border-accent font-semibold text-foreground"
                : "border-b-[3px] border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Creative
          </button>
        </div>

        {activeTab === "Editorial" && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm font-medium">
            {(["Latest", "News", "Sports", "Entertainment", "Retro"] as EditorialSubcategory[]).map((sub) => (
              <button
                key={sub}
                onClick={() => setEditorialSub(sub)}
                className={`rounded px-5 py-1.5 transition-colors ${
                  editorialSub === sub ? "bg-[#555] text-background hover:bg-[#444]" : "text-foreground hover:bg-black/5"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 w-full">
        {activeTab === "Editorial" && (
          <div className="flex w-full flex-col gap-12 pb-8">
            {editorialSub === "Latest" ? (
              <>
                <LatestEventsPanel
                  events={latestEventItems}
                  hasMore={hasMoreEvents}
                  loadingMore={loadingMoreEvents}
                  onLoadMore={loadMoreEvents}
                  state={latestEventsState}
                />

                <div className="mt-6 flex flex-col gap-12">
                  <AssetSection refObject={newsRef} title="News" section={news} />
                  <AssetSection refObject={sportsRef} title="Sports" section={sports} />
                  <AssetSection refObject={entertainmentRef} title="Entertainment" section={entertainment} />
                  <AssetSection refObject={retroRef} title="Retro" section={retro} />
                </div>
              </>
            ) : (
              <div className="mt-2 w-full px-4 sm:px-6 lg:px-8">
                {editorialSub === "News" && <AssetGridOnly refObject={newsRef} section={news} />}
                {editorialSub === "Sports" && <AssetGridOnly refObject={sportsRef} section={sports} />}
                {editorialSub === "Entertainment" && (
                  <AssetGridOnly refObject={entertainmentRef} section={entertainment} />
                )}
                {editorialSub === "Retro" && <AssetGridOnly refObject={retroRef} section={retro} />}
              </div>
            )}
          </div>
        )}

        {activeTab === "Creative" && (
          <div className="flex flex-col gap-1">
            <div className="group relative w-full">
              <div
                ref={scrollContainerRef}
                className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-6 sm:px-8 lg:px-[5vw] [&::-webkit-scrollbar]:hidden"
              >
                {CREATIVE_CARDS.map((card) => (
                  <div
                    key={card.id}
                    className="relative h-[250px] w-[90vw] max-w-[1300px] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted shadow-sm sm:h-[300px] lg:h-[380px]"
                  >
                    <img src={card.image} alt={card.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                      {card.brand && (
                        <div className="mb-1 text-sm font-semibold tracking-wider text-white sm:text-base">
                          {card.brand}
                        </div>
                      )}
                      <h3 className="mb-2 text-3xl font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl lg:text-5xl">
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="mb-3 text-xl font-medium text-white drop-shadow-sm sm:text-2xl">
                          {card.subtitle}
                        </p>
                      )}
                      {card.description && (
                        <p className="mb-6 max-w-2xl text-sm text-white drop-shadow-sm sm:text-base lg:text-lg">
                          {card.description}
                        </p>
                      )}
                      <Link
                        href={card.link}
                        className="rounded bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:text-base"
                      >
                        {card.buttonText}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={scrollLeft}
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100 sm:left-4 sm:block"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={scrollRight}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100 sm:right-4 sm:block"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <div ref={newestRef} className="mt-1 w-full">
              {newest.state === "error" ? (
                <SectionUnavailable />
              ) : newest.state !== "ready" ? (
                <SectionSkeleton />
              ) : (
                <PublicAssetGrid assets={newest.items} dense />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function LatestEventsPanel({
  events,
  hasMore,
  loadingMore,
  onLoadMore,
  state,
}: {
  events: PublicEvent[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  state: LoadState
}) {
  if (state === "error") {
    return (
      <div className="w-full px-4 py-12 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        Latest events are temporarily unavailable.
      </div>
    )
  }

  if (state === "loading") {
    return <SectionSkeleton tall />
  }

  if (events.length === 0) {
    return (
      <div className="w-full px-4 py-12 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        No public events added in the last 30 days.
      </div>
    )
  }

  return (
    <div className="w-full">
      <PublicEventsGrid events={events} />
      {hasMore && (
        <div className="mt-6 flex justify-center px-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
          >
            {loadingMore ? "Loading more events..." : "Load more events"}
          </button>
        </div>
      )}
    </div>
  )
}

function AssetSection({
  refObject,
  section,
  title,
}: {
  refObject: RefObject<HTMLDivElement | null>
  section: AssetSectionState
  title: string
}) {
  return (
    <div ref={refObject} className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h2 className="fc-heading-2 text-foreground">{title}</h2>
      </div>
      <AssetSectionBody section={section} />
    </div>
  )
}

function AssetGridOnly({
  refObject,
  section,
}: {
  refObject: RefObject<HTMLDivElement | null>
  section: AssetSectionState
}) {
  return (
    <div ref={refObject}>
      <AssetSectionBody section={section} />
    </div>
  )
}

function AssetSectionBody({ section }: { section: AssetSectionState }) {
  if (section.state === "error") return <SectionUnavailable />
  if (section.state !== "ready") return <SectionSkeleton />

  return <PublicAssetGrid assets={section.items} limit={section.items.length} />
}

function SectionUnavailable() {
  return <div className="py-12 text-center text-sm text-muted-foreground">{ASSET_SECTION_UNAVAILABLE_COPY}</div>
}

function SectionSkeleton({ tall = false }: { tall?: boolean }) {
  const heightClass = tall ? "h-[300px] sm:h-[400px] lg:h-[500px]" : "h-56"

  return (
    <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-8">
      {Array.from({ length: tall ? 5 : 10 }).map((_, index) => (
        <div key={index} className={`${heightClass} animate-pulse rounded-sm bg-muted`} />
      ))}
    </div>
  )
}
