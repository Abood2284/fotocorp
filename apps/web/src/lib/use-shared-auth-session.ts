"use client"

import { useQuery } from "@tanstack/react-query"
import type { SharedAuthSession, UnifiedAuthSession } from "@/lib/auth-session-types"

export const SHARED_AUTH_SESSION_QUERY_KEY = ["auth-session"] as const

export function useSharedAuthSession() {
  return useQuery({
    queryKey: SHARED_AUTH_SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

async function fetchSession(): Promise<UnifiedAuthSession | null> {
  const response = await fetch("/api/auth/get-session", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  })

  if (response.status === 401 || response.status === 204) return null
  if (!response.ok) return null

  const data = (await response.json().catch(() => null)) as SharedAuthSession | null
  if (!data?.kind) return null

  return data as UnifiedAuthSession
}

/** Subscriber-only consumers (Fotobox, etc.) */
export function useSubscriberAuthUser() {
  const query = useSharedAuthSession()
  const user = query.data?.kind === "user" ? query.data.user ?? null : null
  return {
    ...query,
    data: user ? { user } : null,
  }
}
