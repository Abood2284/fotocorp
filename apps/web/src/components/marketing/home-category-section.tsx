"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { PublicEventsGrid } from "@/components/assets/public-events-grid"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { CaricatureSearchResultGrid } from "@/components/search/caricature-search-result-grid"
import {
  fetchPublicEventCategoryBrowse,
  fetchPublicLatestCaricatures,
  fetchPublicLatestEvents,
  fetchRoyaltyFreeFeaturedAssets,
} from "@/lib/api/fotocorp-api"
import type {
  PublicEvent,
  PublicEventBrowseSection,
  PublicHomepageCaricature,
  PublicHomepageEvent,
  PublicLatestEventsResponse,
  PublicLatestEventsSection,
} from "@/features/assets/types"
import { mapHomepageCaricatureToGridItem } from "@/lib/search/caricature-search"

type TabType = "Editorial" | "Video" | "Caricature" | "Creative"
type EditorialSubcategory = "Latest" | "News" | "Sports" | "Entertainment" | "Fashion" | "Retro"
type LoadState = "loading" | "ready" | "error"

interface HomeCategorySectionProps {
  initialTab?: "Editorial"
}

const LATEST_EVENTS_LIMIT = 15
const LATEST_CARICATURES_LIMIT = 15
const CATEGORY_BROWSE_EVENTS_LIMIT = 25
const RECENT_EVENTS_WINDOW_DAYS = 30
const RECENT_CARICATURES_WINDOW_DAYS = 30
const ROYALTY_FREE_FEATURED_LIMIT = 50
const ROYALTY_FREE_FEATURED_STALE_MS = 86_400_000

const EDITORIAL_SECTIONS: Record<EditorialSubcategory, PublicLatestEventsSection> = {
  Latest: "latest",
  News: "news",
  Sports: "sports",
  Entertainment: "entertainment",
  Fashion: "fashion",
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
    previewAssetId: event.previewAssetId ?? null,
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

export function HomeCategorySection(_props: HomeCategorySectionProps = {}) {
  const searchParams = useSearchParams()
  const sectionRef = useRef<HTMLElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>("Editorial")
  const [editorialSub, setEditorialSub] = useState<EditorialSubcategory>("Latest")
  const selectedSection = EDITORIAL_SECTIONS[editorialSub]
  const [eventPageItems, setEventPageItems] = useState<PublicHomepageEvent[]>([])
  const [eventPageCursor, setEventPageCursor] = useState<string | null>(null)
  const [hasMoreEventPages, setHasMoreEventPages] = useState(false)
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)
  const [caricaturePageItems, setCaricaturePageItems] = useState<PublicHomepageCaricature[]>([])
  const [caricaturePageCursor, setCaricaturePageCursor] = useState<string | null>(null)
  const [hasMoreCaricaturePages, setHasMoreCaricaturePages] = useState(false)
  const [loadingMoreCaricatures, setLoadingMoreCaricatures] = useState(false)
  const tabParam = searchParams.get("tab")

  useEffect(() => {
    if (tabParam?.toLowerCase() !== "caricature") return
    setActiveTab("Caricature")
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [tabParam])
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
  const caricatureQuery = useQuery({
    queryKey: ["homepage-caricatures", RECENT_CARICATURES_WINDOW_DAYS, LATEST_CARICATURES_LIMIT],
    queryFn: () => fetchPublicLatestCaricatures({
      windowDays: RECENT_CARICATURES_WINDOW_DAYS,
      limit: LATEST_CARICATURES_LIMIT,
    }),
    enabled: activeTab === "Caricature",
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const baseEventData = eventQuery.data
  const baseCaricatureData = caricatureQuery.data
  const royaltyFreeQuery = useQuery({
    queryKey: ["homepage", "royalty-free-featured", ROYALTY_FREE_FEATURED_LIMIT],
    queryFn: () => fetchRoyaltyFreeFeaturedAssets({ limit: ROYALTY_FREE_FEATURED_LIMIT }),
    enabled: activeTab === "Creative",
    staleTime: ROYALTY_FREE_FEATURED_STALE_MS,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const royaltyFreeAssets = royaltyFreeQuery.data?.items ?? []
  const royaltyFreeState: LoadState = royaltyFreeQuery.isError
    ? "error"
    : royaltyFreeQuery.isFetching && royaltyFreeAssets.length === 0
      ? "loading"
      : "ready"

  useEffect(() => {
    setEventPageItems([])
    setEventPageCursor(null)
    setHasMoreEventPages(false)
  }, [selectedSection])

  useEffect(() => {
    setCaricaturePageItems([])
    setCaricaturePageCursor(null)
    setHasMoreCaricaturePages(false)
  }, [activeTab])

  useEffect(() => {
    setEventPageItems([])
    setEventPageCursor(baseEventData?.response.nextCursor ?? null)
    setHasMoreEventPages(baseEventData?.response.hasMore ?? false)
  }, [baseEventData?.response.hasMore, baseEventData?.response.nextCursor, selectedSection])

  useEffect(() => {
    setCaricaturePageItems([])
    setCaricaturePageCursor(baseCaricatureData?.nextCursor ?? null)
    setHasMoreCaricaturePages(baseCaricatureData?.hasMore ?? false)
  }, [baseCaricatureData?.hasMore, baseCaricatureData?.nextCursor, activeTab])

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

  const loadMoreCaricatures = useCallback(async () => {
    if (!caricaturePageCursor || loadingMoreCaricatures) return
    setLoadingMoreCaricatures(true)

    try {
      const response = await fetchPublicLatestCaricatures({
        windowDays: RECENT_CARICATURES_WINDOW_DAYS,
        limit: LATEST_CARICATURES_LIMIT,
        cursor: caricaturePageCursor,
      })
      setCaricaturePageItems((current) => [...current, ...response.items])
      setCaricaturePageCursor(response.nextCursor)
      setHasMoreCaricaturePages(response.hasMore)
    } catch {
      setHasMoreCaricaturePages(false)
    } finally {
      setLoadingMoreCaricatures(false)
    }
  }, [caricaturePageCursor, loadingMoreCaricatures])

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -window.innerWidth * 0.8, behavior: "smooth" })
  }

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: window.innerWidth * 0.8, behavior: "smooth" })
  }

  const handleTabClick = (tab: TabType) => {
    if (tab === "Video" || tab === "Creative") return
    setActiveTab(tab)
  }

  const latestEventItems = useMemo(
    () => [
      ...(baseEventData?.response.items ?? []),
      ...eventPageItems,
    ].map(mapHomepageEventToPublicEvent),
    [baseEventData?.response.items, eventPageItems],
  )

  const latestCaricatureItems = useMemo(
    () => [
      ...(baseCaricatureData?.items ?? []),
      ...caricaturePageItems,
    ].map(mapHomepageCaricatureToGridItem),
    [baseCaricatureData?.items, caricaturePageItems],
  )

  return (
    <section
      ref={sectionRef}
      id="homepage-categories"
      className="scroll-mt-16 w-full bg-background pt-4 pb-10"
    >
      <div className="mx-auto flex w-full flex-col items-center px-4 sm:px-6">
        <div className="mx-auto inline-grid w-max max-w-full grid-cols-1 justify-items-stretch">
          <div
            className="pointer-events-none invisible col-start-1 row-start-1 flex h-0 w-full flex-wrap items-center justify-center gap-3 overflow-hidden font-sans text-xs font-bold uppercase tracking-wider select-none sm:gap-3.5"
            aria-hidden
          >
            {(["Latest", "News", "Sports", "Entertainment", "Fashion", "Retro"] as EditorialSubcategory[]).map((sub) => (
              <span key={sub} className="rounded-none border px-3 py-2 sm:px-4">
                {sub}
              </span>
            ))}
          </div>

          <div className="col-start-1 row-start-1 flex w-full justify-between gap-6 pb-0 font-sans text-xs font-bold uppercase tracking-wider text-foreground sm:gap-8">
            <button
              onClick={() => handleTabClick("Editorial")}
              className={`shrink-0 pb-1.5 transition-all cursor-pointer ${
                activeTab === "Editorial"
                  ? "border-b-2 border-black text-black font-bold"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-black"
              }`}
            >
              Editorial
            </button>
            <button
              disabled
              className="shrink-0 cursor-not-allowed border-b-2 border-transparent pb-1.5 text-muted-foreground/50"
            >
              Video
            </button>
            <button
              onClick={() => handleTabClick("Caricature")}
              className={`shrink-0 pb-1.5 transition-all cursor-pointer ${
                activeTab === "Caricature"
                  ? "border-b-2 border-black text-black font-bold"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-black"
              }`}
            >
              Caricature
            </button>
            <button
              disabled
              className="shrink-0 cursor-not-allowed border-b-2 border-transparent pb-1.5 text-muted-foreground/50"
            >
              Royalty Free
            </button>
          </div>

          {activeTab === "Editorial" && (
            <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-3 font-sans text-xs font-bold uppercase tracking-wider sm:gap-3.5">
              {(["Latest", "News", "Sports", "Entertainment", "Fashion", "Retro"] as EditorialSubcategory[]).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setEditorialSub(sub)}
                  className={`cursor-pointer rounded-none border px-3 py-2 transition-colors sm:px-4 ${
                    editorialSub === sub
                      ? "border-black bg-black text-white"
                      : "border-border bg-transparent text-foreground hover:border-black hover:bg-black/5"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`w-full ${activeTab === "Editorial" ? "mt-6" : "mt-3"}`}>
        {activeTab === "Editorial" && (
          <div className="flex w-full flex-col gap-12 pb-8">
            <LatestEventsPanel
              events={latestEventItems}
              hasMore={hasMoreEventPages}
              loadingMore={loadingMoreEvents}
              onLoadMore={loadMoreEvents}
              onShowLatest={() => {
                setActiveTab("Editorial")
                setEditorialSub("Latest")
              }}
              state={eventQuery.isError ? "error" : eventQuery.isFetching && !baseEventData ? "loading" : "ready"}
              sectionLabel={editorialSub}
            />
          </div>
        )}

        {activeTab === "Caricature" && (
          <div className="flex w-full flex-col gap-12 pb-8">
            <LatestCaricaturesPanel
              items={latestCaricatureItems}
              hasMore={hasMoreCaricaturePages}
              loadingMore={loadingMoreCaricatures}
              onLoadMore={loadMoreCaricatures}
              state={caricatureQuery.isError ? "error" : caricatureQuery.isFetching && !baseCaricatureData ? "loading" : "ready"}
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
              {royaltyFreeState === "loading" ? (
                <SectionSkeleton featuredGrid />
              ) : royaltyFreeState === "error" || royaltyFreeAssets.length === 0 ? (
                <RoyaltyFreeEmptyState
                  error={royaltyFreeState === "error"}
                  onShowLatest={() => {
                    setActiveTab("Editorial")
                    setEditorialSub("Latest")
                  }}
                />
              ) : (
                <PublicAssetGrid
                  assets={royaltyFreeAssets}
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

function LatestCaricaturesPanel({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  state,
}: {
  items: ReturnType<typeof mapHomepageCaricatureToGridItem>[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  state: LoadState
}) {
  if (state === "error") {
    return (
      <div className="w-full px-4 py-12 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        Latest caricatures are temporarily unavailable.
      </div>
    )
  }

  if (state === "loading") {
    return <CaricatureCardGridSkeleton />
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <h3 className="font-heading text-2xl font-normal text-foreground">No recent caricatures yet.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse the caricature archive or check back soon for new work.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/search?segment=caricature"
            className="button-outline-square px-5 py-3 text-xs uppercase tracking-wider"
          >
            Browse Caricatures
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <CaricatureSearchResultGrid items={items} />
      {hasMore && (
        <div className="mt-6 flex justify-center px-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="button-outline-square w-full max-w-xs text-xs uppercase tracking-wider cursor-pointer disabled:cursor-wait disabled:opacity-70"
          >
            {loadingMore ? "Loading more caricatures..." : "Load more caricatures"}
          </button>
        </div>
      )}
    </div>
  )
}

function LatestEventsPanel({
  events,
  hasMore,
  loadingMore,
  onLoadMore,
  onShowLatest,
  state,
  sectionLabel,
}: {
  events: PublicEvent[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
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
  onShowLatest,
  sectionLabel,
}: {
  onShowLatest: () => void
  sectionLabel: EditorialSubcategory
}) {
  const isLatest = sectionLabel === "Latest"
  const browseHref = isLatest ? "/search?mode=events" : `/search?q=${encodeURIComponent(sectionLabel)}`
  const title = isLatest
    ? "No recent Editorial events yet."
    : `No ${sectionLabel} events found.`
  const description = isLatest
    ? "View the latest image coverage or browse editorial categories."
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

function CaricatureCardGridSkeleton() {
  return (
    <div className="w-full animate-pulse" aria-hidden>
      {[0, 1, 2].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap: 2, height: 320, marginBottom: 2 }}
        >
          {[1.3, 0.85, 1.1].map((flexGrow, tileIndex) => (
            <div
              key={tileIndex}
              className="h-full bg-muted"
              style={{ flex: flexGrow }}
            />
          ))}
        </div>
      ))}
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
