"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginContributor, ContributorApiError } from "@/lib/api/contributor-api"

export function ContributorLoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await loginContributor(username, password)
      router.push("/contributor/dashboard")
      router.refresh()
    } catch (caught) {
      if (caught instanceof ContributorApiError && caught.status >= 500) {
        setError("We could not sign you in right now. Please try again.")
      } else {
        setError("Invalid username or password.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="contributor-username" className="text-sm font-medium text-foreground">
          Username
        </label>
        <Input
          id="contributor-username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="ph_000037"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contributor-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="contributor-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive-light px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  )
}
