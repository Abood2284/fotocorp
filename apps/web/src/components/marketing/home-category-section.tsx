"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import type { PublicAsset, PublicEvent } from "@/features/assets/types"
import { PublicEventsGrid } from "@/components/assets/public-events-grid"
import { PublicAssetMosaic } from "@/components/assets/public-asset-mosaic"
import { PublicAssetCard } from "@/components/assets/public-asset-card"

interface HomeCategorySectionProps {
  events: PublicEvent[]
  creativeAssets: PublicAsset[]
  newsAssets: PublicAsset[]
  sportsAssets: PublicAsset[]
  entertainmentAssets: PublicAsset[]
  retroAssets: PublicAsset[]
}

type TabType = "Editorial" | "Video" | "Caricature" | "Creative"
type EditorialSubcategory = "Latest" | "News" | "Sports" | "Entertainment" | "Retro"

import { ChevronLeft, ChevronRight } from "lucide-react"

const CREATIVE_CARDS = [
  { 
    id: 1, 
    image: "/images/category_card_1.png", 
    brand: "fotocorp",
    title: "Media Manager", 
    subtitle: "Never Lose a Download Again", 
    description: "Automatically store, manage, and access licensed Fotocorp content across teams and locations.",
    buttonText: "Explore Media Manager",
    link: "/services"
  },
  { 
    id: 2, 
    image: "/images/category_card_2.png", 
    brand: "",
    title: "Latest Editors' Picks", 
    subtitle: "", 
    description: "Curated, compelling, and worth your time. Explore our latest gallery of Editors' Picks.",
    buttonText: "Browse Editor's Favourites",
    link: "/search?sort=newest"
  },
  { 
    id: 3, 
    image: "/images/category_card_3.png", 
    brand: "",
    title: "Unrivaled Entertainment Coverage", 
    subtitle: "", 
    description: "Exclusive access. Insider moments. Experience the best of the Bollywood industry.",
    buttonText: "Explore Entertainment",
    link: "/search"
  },
]

export function HomeCategorySection({ 
  events, 
  creativeAssets,
  newsAssets,
  sportsAssets,
  entertainmentAssets,
  retroAssets,
}: HomeCategorySectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>("Editorial")
  const [editorialSub, setEditorialSub] = useState<EditorialSubcategory>("Latest")

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const latestEvents = events.filter((e) => {
    const targetDate = e.eventDate ? new Date(e.eventDate) : (e.createdAt ? new Date(e.createdAt) : null)
    if (!targetDate) return false
    return targetDate >= thirtyDaysAgo || (e.createdAt && new Date(e.createdAt) >= thirtyDaysAgo)
  })

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

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -window.innerWidth * 0.8, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: window.innerWidth * 0.8, behavior: 'smooth' })
    }
  }

  const handleTabClick = (tab: TabType) => {
    if (tab === "Video" || tab === "Caricature") return // Disabled
    setActiveTab(tab)
  }

  return (
    <section className="w-full bg-background pt-8 pb-10">
      <div className="mx-auto flex w-full flex-col items-center">
        <div className="flex w-full flex-wrap justify-center gap-x-12 sm:gap-x-16 gap-y-4 pt-2 pb-0 text-base sm:text-[17px] font-medium text-foreground">
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
            className="pb-1 border-b-[3px] border-transparent text-muted-foreground opacity-50 cursor-not-allowed"
          >
            Video
          </button>
          <button
            disabled
            className="pb-1 border-b-[3px] border-transparent text-muted-foreground opacity-50 cursor-not-allowed"
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
                  editorialSub === sub
                    ? "bg-[#555] text-background hover:bg-[#444]"
                    : "text-foreground hover:bg-black/5"
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
          <div className="flex flex-col gap-12 w-full pb-8">
            {editorialSub === "Latest" ? (
              <>
                {latestEvents.length > 0 && (
                  <div className="w-full">
                    <PublicEventsGrid events={latestEvents} />
                  </div>
                )}

                {creativeAssets.length > 0 && (
                  <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="mb-4">
                      <h2 className="fc-heading-2 text-foreground">Latest</h2>
                    </div>
                    <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                      {creativeAssets.map((asset, index) => (
                        <PublicAssetCard
                          key={asset.id}
                          asset={asset}
                          variant="grid"
                          priority={index < 8}
                          className="mb-2 break-inside-avoid"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-12 mt-6">
                  {newsAssets.length > 0 && (
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                      <div className="mb-4">
                        <h2 className="fc-heading-2 text-foreground">News</h2>
                      </div>
                      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                        {newsAssets.map((asset, index) => (
                          <PublicAssetCard key={asset.id} asset={asset} variant="grid" priority={index < 8} className="mb-2 break-inside-avoid" />
                        ))}
                      </div>
                    </div>
                  )}

                  {sportsAssets.length > 0 && (
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                      <div className="mb-4">
                        <h2 className="fc-heading-2 text-foreground">Sports</h2>
                      </div>
                      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                        {sportsAssets.map((asset, index) => (
                          <PublicAssetCard key={asset.id} asset={asset} variant="grid" priority={index < 8} className="mb-2 break-inside-avoid" />
                        ))}
                      </div>
                    </div>
                  )}

                  {entertainmentAssets.length > 0 && (
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                      <div className="mb-4">
                        <h2 className="fc-heading-2 text-foreground">Entertainment</h2>
                      </div>
                      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                        {entertainmentAssets.map((asset, index) => (
                          <PublicAssetCard key={asset.id} asset={asset} variant="grid" priority={index < 8} className="mb-2 break-inside-avoid" />
                        ))}
                      </div>
                    </div>
                  )}

                  {retroAssets.length > 0 && (
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                      <div className="mb-4">
                        <h2 className="fc-heading-2 text-foreground">Retro</h2>
                      </div>
                      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                        {retroAssets.map((asset, index) => (
                          <PublicAssetCard key={asset.id} asset={asset} variant="grid" priority={index < 8} className="mb-2 break-inside-avoid" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full px-4 sm:px-6 lg:px-8 mt-2">
                <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
                  {(editorialSub === "News" ? newsAssets :
                    editorialSub === "Sports" ? sportsAssets :
                    editorialSub === "Entertainment" ? entertainmentAssets :
                    editorialSub === "Retro" ? retroAssets : []).map((asset, index) => (
                    <PublicAssetCard key={asset.id} asset={asset} variant="grid" priority={index < 8} className="mb-2 break-inside-avoid" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "Creative" && (
          <div className="flex flex-col gap-1">
            {/* Catalog of promotional rectangle cards, horizontal scrolling */}
            <div className="group relative w-full">
              <div 
                ref={scrollContainerRef}
                className="flex w-full overflow-x-auto pb-2 px-4 sm:px-8 lg:px-[5vw] snap-x snap-mandatory gap-4 sm:gap-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {CREATIVE_CARDS.map((card) => (
                  <div 
                    key={card.id}
                    className="relative h-[250px] w-[90vw] max-w-[1300px] sm:h-[300px] lg:h-[380px] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted shadow-sm"
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                      {card.brand && (
                        <div className="mb-1 text-sm sm:text-base font-semibold tracking-wider text-white" style={{ color: '#ffffff' }}>
                          {card.brand}
                        </div>
                      )}
                      <h3 className="mb-2 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white drop-shadow-md" style={{ color: '#ffffff' }}>
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="mb-3 text-xl sm:text-2xl font-medium text-white drop-shadow-sm" style={{ color: '#ffffff' }}>
                          {card.subtitle}
                        </p>
                      )}
                      {card.description && (
                        <p className="mb-6 max-w-2xl text-sm sm:text-base lg:text-lg text-white drop-shadow-sm" style={{ color: '#ffffff' }}>
                          {card.description}
                        </p>
                      )}
                      <Link 
                        href={card.link}
                        className="rounded bg-primary px-6 py-2.5 text-sm sm:text-base font-medium text-white transition-colors hover:bg-primary/90"
                      >
                        {card.buttonText}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scroll Controls */}
              <button 
                onClick={scrollLeft}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100 hidden sm:block"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button 
                onClick={scrollRight}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100 hidden sm:block"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Creative images grid (up to 50 images) */}
            <div className="w-full mt-1">
              <PublicAssetMosaic assets={creativeAssets} dense />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
