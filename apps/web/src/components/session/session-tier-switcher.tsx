"use client"

import { useMockSession, type MockUserTier } from "@/features/session/mock-session-provider"
import { Badge } from "@/components/ui/badge"

const TIER_OPTIONS: Array<{ label: string; value: MockUserTier }> = [
  { label: "Guest", value: "guest" },
  { label: "Free User", value: "free" },
  { label: "Paid User", value: "paid" },
]

export function SessionTierSwitcher({ className }: { className?: string }) {
  const { tier, setTier, activePlanLabel } = useMockSession()

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="session-tier">
        Mock session tier
      </label>
      <div className="flex items-center gap-2">
        <select
          id="session-tier"
          value={tier}
          onChange={(event) => setTier(event.target.value as MockUserTier)}
          className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white focus:outline-none"
        >
          {TIER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className="text-black">
              {option.label}
            </option>
          ))}
        </select>
        <Badge variant="secondary" className="text-[10px]">
          {activePlanLabel}
        </Badge>
      </div>
    </div>
  )
}
