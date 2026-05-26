"use client"

import { ToastProvider } from "@/components/staff/shared/toast"

export function StaffProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  )
}
