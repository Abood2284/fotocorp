"use client"

import { useEffect } from "react"
import type { PublicAssetFiltersResponse } from "@/features/assets/types"
import { useSearchFilters } from "@/components/search/search-filters-context"

export function SearchFiltersBridge({ filters }: { filters: PublicAssetFiltersResponse }) {
  const { mergeFilters } = useSearchFilters()

  useEffect(() => {
    mergeFilters(filters)
  }, [filters, mergeFilters])

  return null
}
