"use client"

import { useQuery } from "@tanstack/react-query"

export interface SharedAuthSession {
  user?: {
    name?: string | null
    email?: string | null
  } | null
}

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

async function fetchSession(): Promise<SharedAuthSession | null> {
  const response = await fetch("/api/auth/get-session", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  })

  if (response.status === 401 || response.status === 204) return null
  if (!response.ok) return null

  const data = await response.json().catch(() => null) as SharedAuthSession | null
  return data?.user ? data : null
}
