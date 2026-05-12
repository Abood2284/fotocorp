"use client"

import { MockSessionProvider } from "@/features/session/mock-session-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockSessionProvider>
      {children}
    </MockSessionProvider>
  )
}
