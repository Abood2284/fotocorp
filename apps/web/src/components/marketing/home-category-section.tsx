"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import { PublicEventsGrid } from "@/components/assets/public-events-grid"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { fetchRoyaltyFreeFeaturedAssets, fetchPublicEventCategoryBrowse, fetchPublicLatestEvents } from "@/lib/api/fotocorp-api"
import type {
  PublicEvent,
  PublicEventBrowseSection,
  PublicHomepageEvent,
  PublicLatestEventsResponse,
  PublicLatestEventsSection,
} from "@/features/assets/types"

type TabType = "Editorial" | "Video" | "Caricature" | "Creative"
type EditorialSubcategory = "Latest" | "News" | "Sports" | "Entertainment" | "Retro"
type LoadState = "loading" | "ready" | "error"

interface HomeCategorySectionProps {
  initialTab?: "Editorial" | "Creative"
}

const LATEST_EVENTS_LIMIT = 15
const CATEGORY_BROWSE_EVENTS_LIMIT = 25
const CREATIVE_ASSETS_LIMIT = 50
const RECENT_EVENTS_WINDOW_DAYS = 30

const EDITORIAL_SECTIONS: Record<EditorialSubcategory, PublicLatestEventsSection> = {
  Latest: "latest",
  News: "news",
  Sports: "sports",
  Entertainment: "entertainment",
  Retro: "retro",
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

async function fetchHomepageEventsSection(section: PublicLatestEventsSection): Promise<{
  response: PublicLatestEventsResponse
  mode: "latest" | "category-browse"
}> {
  if (section === "latest") {
    const response = await fetchPublicLatestEvents({
      windowDays: RECENT_EVENTS_WINDOW_DAYS,
      limit: LATEST_EVENTS_LIMIT,
      section,
    })
    return { response, mode: "latest" }
  }

  const response = await fetchPublicEventCategoryBrowse({
    limit: CATEGORY_BROWSE_EVENTS_LIMIT,
    section: section as PublicEventBrowseSection,
  })
  return { response, mode: "category-browse" }
}

export function HomeCategorySection({ initialTab = "Editorial" }: HomeCategorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>(initialTab === "Creative" ? "Creative" : "Editorial")
  const [editorialSub, setEditorialSub] = useState<EditorialSubcategory>("Latest")
  const selectedSection = EDITORIAL_SECTIONS[editorialSub]
  const [eventPageItems, setEventPageItems] = useState<PublicHomepageEvent[]>([])
  const [eventPageCursor, setEventPageCursor] = useState<string | null>(null)
  const [hasMoreEventPages, setHasMoreEventPages] = useState(false)
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)
  const eventQuery = useQuery({
    queryKey: [
      "homepage-events",
      selectedSection,
      selectedSection === "latest" ? RECENT_EVENTS_WINDOW_DAYS : "archive",
      selectedSection === "latest" ? LATEST_EVENTS_LIMIT : CATEGORY_BROWSE_EVENTS_LIMIT,
    ],
    queryFn: () => fetchHomepageEventsSection(selectedSection),
    staleTime: selectedSection === "latest" ? 60_000 : 86_400_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const royaltyFreeQuery = useQuery({
    queryKey: ["homepage-royalty-free-featured", CREATIVE_ASSETS_LIMIT],
    queryFn: () => fetchRoyaltyFreeFeaturedAssets({ limit: CREATIVE_ASSETS_LIMIT }),
    enabled: activeTab === "Creative",
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const baseEventData = eventQuery.data

  useEffect(() => {
    if (initialTab !== "Creative") return
    setActiveTab("Creative")
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [initialTab])

  useEffect(() => {
    setEventPageItems([])
    setEventPageCursor(null)
    setHasMoreEventPages(false)
  }, [selectedSection])

  useEffect(() => {
    setEventPageItems([])
    setEventPageCursor(baseEventData?.response.nextCursor ?? null)
    setHasMoreEventPages(baseEventData?.response.hasMore ?? false)
  }, [baseEventData?.response.hasMore, baseEventData?.response.nextCursor, selectedSection])

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
    if (!eventPageCursor || loadingMoreEvents || !baseEventData) return
    setLoadingMoreEvents(true)

    try {
      const response = baseEventData.mode === "latest"
        ? await fetchPublicLatestEvents({
            windowDays: RECENT_EVENTS_WINDOW_DAYS,
            limit: LATEST_EVENTS_LIMIT,
            cursor: eventPageCursor,
            section: selectedSection,
          })
        : await fetchPublicEventCategoryBrowse({
            limit: CATEGORY_BROWSE_EVENTS_LIMIT,
            cursor: eventPageCursor,
            section: selectedSection as PublicEventBrowseSection,
          })
      setEventPageItems((current) => [...current, ...response.items])
      setEventPageCursor(response.nextCursor)
      setHasMoreEventPages(response.hasMore)
    } catch {
      setHasMoreEventPages(false)
    } finally {
      setLoadingMoreEvents(false)
    }
  }, [baseEventData, eventPageCursor, loadingMoreEvents, selectedSection])

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

  const latestEventItems = useMemo(
    () => [
      ...(baseEventData?.response.items ?? []),
      ...eventPageItems,
    ].map(mapHomepageEventToPublicEvent),
    [baseEventData?.response.items, eventPageItems],
  )

  return (
    <section
      ref={sectionRef}
      id="homepage-categories"
      className="scroll-mt-16 w-full bg-background pt-4 pb-10"
    >
      <div className="mx-auto flex w-full flex-col items-center">
        <div className="flex w-full flex-wrap justify-center gap-x-12 gap-y-4 pb-0 text-xs font-bold uppercase tracking-wider text-foreground sm:gap-x-16 font-sans">
          <button
            onClick={() => handleTabClick("Editorial")}
            className={`pb-1.5 transition-all cursor-pointer ${
              activeTab === "Editorial"
                ? "border-b-2 border-black text-black font-bold"
                : "border-b-2 border-transparent text-muted-foreground hover:text-black"
            }`}
          >
            Editorial
          </button>
          <button
            disabled
            className="cursor-not-allowed border-b-2 border-transparent pb-1.5 text-muted-foreground/50"
          >
            Video
          </button>
          <button
            disabled
            className="cursor-not-allowed border-b-2 border-transparent pb-1.5 text-muted-foreground/50"
          >
            Caricature
          </button>
          <button
            onClick={() => handleTabClick("Creative")}
            className={`pb-1.5 transition-all cursor-pointer ${
              activeTab === "Creative"
                ? "border-b-2 border-black text-black font-bold"
                : "border-b-2 border-transparent text-muted-foreground hover:text-black"
            }`}
          >
            Royalty Free
          </button>
        </div>

        {activeTab === "Editorial" && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-sans text-xs font-bold uppercase tracking-wider">
            {(["Latest", "News", "Sports", "Entertainment", "Retro"] as EditorialSubcategory[]).map((sub) => (
              <button
                key={sub}
                onClick={() => setEditorialSub(sub)}
                className={`px-4 py-2 transition-colors cursor-pointer rounded-none border ${
                  editorialSub === sub
                    ? "bg-black text-white border-black"
                    : "bg-transparent text-foreground border-border hover:bg-black/5 hover:border-black"
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
            <LatestEventsPanel
              events={latestEventItems}
              hasMore={hasMoreEventPages}
              loadingMore={loadingMoreEvents}
              onLoadMore={loadMoreEvents}
              onShowCreative={() => setActiveTab("Creative")}
              onShowLatest={() => {
                setActiveTab("Editorial")
                setEditorialSub("Latest")
              }}
              state={eventQuery.isError ? "error" : eventQuery.isFetching && !baseEventData ? "loading" : "ready"}
              sectionLabel={editorialSub}
            />
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
                    className="relative h-[250px] w-[90vw] max-w-[1300px] shrink-0 snap-center overflow-hidden rounded-none border border-border bg-muted sm:h-[300px] lg:h-[380px]"
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover brightness-[0.82] saturate-[0.92]"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/75"
                      aria-hidden
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.75)]">
                      {card.brand && (
                        <div className="mb-1.5 font-sans text-xs font-bold uppercase tracking-wider !text-white">
                          {card.brand}
                        </div>
                      )}
                      <h3 className="mb-2 font-heading text-3xl font-normal !text-white sm:text-4xl lg:text-5xl">
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="mb-3 font-body text-xl font-normal !text-white sm:text-2xl">
                          {card.subtitle}
                        </p>
                      )}
                      {card.description && (
                        <p className="mb-6 max-w-2xl font-body text-sm font-normal !text-white sm:text-base lg:text-lg">
                          {card.description}
                        </p>
                      )}
                      <Link
                        href={card.link}
                        className="bg-white text-black border border-white font-sans uppercase text-xs tracking-wider font-bold px-6 py-3 rounded-none transition-colors hover:bg-transparent hover:text-white"
                      >
                        {card.buttonText}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={scrollLeft}
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-none bg-black/75 p-2.5 text-white opacity-0 transition-opacity hover:bg-black group-hover:opacity-100 sm:left-4 sm:block cursor-pointer"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={scrollRight}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-none bg-black/75 p-2.5 text-white opacity-0 transition-opacity hover:bg-black group-hover:opacity-100 sm:right-4 sm:block cursor-pointer"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="mt-1 w-full">
              {royaltyFreeQuery.isError ? (
                <RoyaltyFreeEmptyState
                  error
                  onShowLatest={() => {
                    setActiveTab("Editorial")
                    setEditorialSub("Latest")
                  }}
                />
              ) : royaltyFreeQuery.isFetching && !royaltyFreeQuery.data ? (
                <SectionSkeleton featuredGrid />
              ) : (royaltyFreeQuery.data?.items.length ?? 0) === 0 ? (
                <RoyaltyFreeEmptyState
                  onShowLatest={() => {
                    setActiveTab("Editorial")
                    setEditorialSub("Latest")
                  }}
                />
              ) : (
                <PublicAssetGrid
                  assets={royaltyFreeQuery.data?.items ?? []}
                  featured
                  className="px-4 sm:px-6 lg:px-8"
                />
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
  onShowCreative,
  onShowLatest,
  state,
  sectionLabel,
}: {
  events: PublicEvent[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onShowCreative: () => void
  onShowLatest: () => void
  state: LoadState
  sectionLabel: EditorialSubcategory
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
      <EditorialEmptyState
        sectionLabel={sectionLabel}
        onShowCreative={onShowCreative}
        onShowLatest={onShowLatest}
      />
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
            className="button-outline-square w-full max-w-xs text-xs uppercase tracking-wider cursor-pointer disabled:cursor-wait disabled:opacity-70"
          >
            {loadingMore ? "Loading more events..." : "Load more events"}
          </button>
        </div>
      )}
    </div>
  )
}

function EditorialEmptyState({
  onShowCreative,
  onShowLatest,
  sectionLabel,
}: {
  onShowCreative: () => void
  onShowLatest: () => void
  sectionLabel: EditorialSubcategory
}) {
  const isLatest = sectionLabel === "Latest"
  const browseHref = isLatest ? "/search?sort=newest" : `/search?q=${encodeURIComponent(sectionLabel)}`
  const title = isLatest
    ? "No recent Editorial events yet."
    : `No ${sectionLabel} events found.`
  const description = isLatest
    ? "View the latest image coverage or explore royalty-free picks."
    : `Browse all ${sectionLabel} images or view latest Editorial coverage.`

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:px-8">
      <h3 className="font-heading text-2xl font-normal text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={browseHref} className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider">
          {isLatest ? "Search Images" : `Browse all ${sectionLabel} images`}
        </Link>
        {!isLatest && (
          <button
            type="button"
            onClick={onShowLatest}
            className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider"
          >
            View Latest Editorial
          </button>
        )}
        <button
          type="button"
          onClick={onShowCreative}
          className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider"
        >
          Explore Royalty-Free Picks
        </button>
      </div>
    </div>
  )
}

function RoyaltyFreeEmptyState({
  error = false,
  onShowLatest,
}: {
  error?: boolean
  onShowLatest: () => void
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:px-8">
      <h3 className="font-heading text-2xl font-normal text-foreground">
        {error ? "Royalty-free picks are temporarily unavailable." : "Royalty-free picks are being prepared."}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Browse latest editorial coverage or check back soon.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onShowLatest}
          className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider"
        >
          View Latest Editorial
        </button>
        <Link href="/search" className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider">
          Search Images
        </Link>
      </div>
    </div>
  )
}

function SectionSkeleton({
  tall = false,
  featuredGrid = false,
}: {
  tall?: boolean
  featuredGrid?: boolean
}) {
  if (featuredGrid) {
    return (
      <div className="w-full animate-pulse px-4 sm:px-6 lg:px-8" aria-hidden>
        {[0, 1, 2].map((rowIndex) => (
          <div
            key={rowIndex}
            className="mb-2 flex h-[220px] w-full gap-2 sm:h-[280px] sm:gap-3"
          >
            {Array.from({ length: 4 }).map((_, tileIndex) => (
              <div key={tileIndex} className="h-full flex-1 rounded-none bg-muted" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const heightClass = tall ? "h-[300px] sm:h-[400px] lg:h-[500px]" : "h-56"

  return (
    <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-8">
      {Array.from({ length: tall ? 5 : 10 }).map((_, index) => (
        <div key={index} className={`${heightClass} animate-pulse rounded-none bg-muted`} />
      ))}
    </div>
  )
}
