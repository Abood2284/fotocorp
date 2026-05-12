"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

export type MockUserTier = "guest" | "free" | "paid"
export type EntitlementState = "not-subscribed" | "subscribed" | "upgrade-plan" | "preview-only"

interface MockSessionContextValue {
  tier: MockUserTier
  setTier: (tier: MockUserTier) => void
  isSubscribed: boolean
  activePlanLabel: string
  entitlementState: EntitlementState
}

const STORAGE_KEY = "fotocorp.mock-session-tier"

const MockSessionContext = createContext<MockSessionContextValue | null>(null)

function getDefaultTier(): MockUserTier {
  return "guest"
}

function getActivePlanLabel(tier: MockUserTier): string {
  if (tier === "paid") return "Pro"
  if (tier === "free") return "Free"
  return "Guest"
}

function getEntitlementState(tier: MockUserTier): EntitlementState {
  if (tier === "paid") return "subscribed"
  if (tier === "free") return "upgrade-plan"
  return "preview-only"
}

export function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<MockUserTier>(getDefaultTier())

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as MockUserTier | null
    if (!stored) return
    if (stored !== "guest" && stored !== "free" && stored !== "paid") return
    setTier(stored)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, tier)
  }, [tier])

  const value = useMemo<MockSessionContextValue>(
    () => ({
      tier,
      setTier,
      isSubscribed: tier === "paid",
      activePlanLabel: getActivePlanLabel(tier),
      entitlementState: getEntitlementState(tier),
    }),
    [tier],
  )

  return (
    <MockSessionContext.Provider value={value}>
      {children}
    </MockSessionContext.Provider>
  )
}

export function useMockSession() {
  const context = useContext(MockSessionContext)
  if (!context) throw new Error("useMockSession must be used within MockSessionProvider")
  return context
}
