"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginStaff, StaffApiError } from "@/lib/api/staff-api"
import { resolveStaffPostLoginRedirect } from "@/lib/staff/staff-route-access"

export function StaffLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const me = await loginStaff(username, password)
      const next = resolveStaffPostLoginRedirect(me.staff.role, searchParams.get("callbackUrl"))
      router.push(next)
      router.refresh()
    } catch (caught) {
      if (caught instanceof StaffApiError && caught.status >= 500) {
        setError("We could not sign you in right now. Please try again.")
      } else {
        setError("Invalid username or password")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="staff-username" className="text-sm font-medium text-zinc-800">
          Username <span className="text-red-600">*</span>
        </label>
        <Input
          id="staff-username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="border-zinc-300 bg-white"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="staff-password" className="text-sm font-medium text-zinc-800">
          Password <span className="text-red-600">*</span>
        </label>
        <Input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-zinc-300 bg-white"
          required
        />
      </div>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      <Button type="submit" className="w-full bg-zinc-900 text-white hover:bg-zinc-800" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
