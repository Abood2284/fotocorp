"use client"

import { useQuery } from "@tanstack/react-query"

import {
  parseCaricatureClearAccessPayload,
  type CaricatureClearAccessState,
} from "@/lib/caricatures/caricature-clear-access-shared"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"

export const CARICATURE_CLEAR_ACCESS_QUERY_KEY = ["caricature-clear-access"] as const

export function useCaricatureClearAccess() {
  const { data: session, isPending: isSessionPending } = useSharedAuthSession()
  const isAuthenticated = Boolean(
    session?.kind === "user" || session?.kind === "staff" || session?.kind === "contributor",
  )

  const accessQuery = useQuery({
    queryKey: CARICATURE_CLEAR_ACCESS_QUERY_KEY,
    queryFn: fetchCaricatureClearAccess,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  return {
    hasClearAccess: Boolean(accessQuery.data?.hasClearAccess),
    ownedAssetIds: accessQuery.data?.ownedAssetIds ?? [],
    isPending: isSessionPending || (isAuthenticated && accessQuery.isPending),
  }
}

async function fetchCaricatureClearAccess(): Promise<CaricatureClearAccessState> {
  const emptyAccess: CaricatureClearAccessState = {
    hasClearAccess: false,
    ownedAssetIds: [],
    isContributor: false,
  }
  const response = await fetch("/api/account/caricature-access", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  })

  if (response.status === 401) return emptyAccess
  if (!response.ok) return emptyAccess

  const data = await response.json().catch(() => null)
  return parseCaricatureClearAccessPayload(data)
}
