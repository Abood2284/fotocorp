"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { PublicAssetFiltersResponse } from "@/features/assets/types"

const EMPTY_FILTERS: PublicAssetFiltersResponse = { categories: [], events: [], cities: [], sources: [] }

interface SearchFiltersContextValue {
  filters: PublicAssetFiltersResponse
  isLoading: boolean
  mergeFilters: (filters: PublicAssetFiltersResponse) => void
}

const SearchFiltersContext = createContext<SearchFiltersContextValue | null>(null)

export function SearchFiltersProvider({
  children,
  initialFilters,
}: {
  children: ReactNode
  initialFilters?: PublicAssetFiltersResponse
}) {
  const [state, setState] = useState({
    filters: initialFilters ?? EMPTY_FILTERS,
    isLoading: !initialFilters,
  })

  const mergeFilters = useCallback((filters: PublicAssetFiltersResponse) => {
    setState({ filters, isLoading: false })
  }, [])

  const value = useMemo(
    () => ({ ...state, mergeFilters }),
    [state, mergeFilters],
  )

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  )
}

export function useSearchFilters() {
  const context = useContext(SearchFiltersContext)
  if (!context) {
    throw new Error("useSearchFilters must be used within SearchFiltersProvider")
  }
  return context
}
