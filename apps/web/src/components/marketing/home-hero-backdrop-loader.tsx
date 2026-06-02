"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { HomeHero } from "@/components/marketing/home-hero"
import type { HeroBackdropItem } from "@/components/marketing/hero-backdrop-strip"
import { fetchPublicHomepageHeroSet } from "@/lib/api/fotocorp-api"

export function HomeHeroBackdropLoader() {
  const heroQuery = useQuery({
    queryKey: ["homepage", "hero-set"],
    queryFn: fetchPublicHomepageHeroSet,
    staleTime: 5 * 60 * 1000,
  })

  const items = useMemo(
    () => mapHeroSetItems(heroQuery.data?.items ?? []),
    [heroQuery.data?.items],
  )

  return <HomeHero items={items} />
}

function mapHeroSetItems(
  items: Array<{
    assetId: string
    title: string
    previewUrl: string
  }>,
): HeroBackdropItem[] {
  return items.flatMap((item) => {
    const imageUrl = normalizeImageUrl(item.previewUrl)
    if (!imageUrl) return []

    return [
      {
        id: item.assetId,
        title: item.title,
        href: `/assets/${encodeURIComponent(item.assetId)}`,
        imageUrl,
      },
    ]
  })
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  if (normalized === "null") return null
  if (normalized === "undefined") return null
  return normalized
}
