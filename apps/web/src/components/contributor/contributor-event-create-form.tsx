"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createContributorEvent, ContributorApiError } from "@/lib/api/contributor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function ContributorEventCreateForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    try {
      await createContributorEvent({
        name: String(formData.get("name") ?? "").trim(),
        eventDate: String(formData.get("eventDate") ?? "").trim() || undefined,
        eventTime: String(formData.get("eventTime") ?? "").trim() || undefined,
        country: String(formData.get("country") ?? "").trim() || undefined,
        stateRegion: String(formData.get("stateRegion") ?? "").trim() || undefined,
        city: String(formData.get("city") ?? "").trim() || undefined,
        location: String(formData.get("location") ?? "").trim() || undefined,
        keywords: String(formData.get("keywords") ?? "").trim() || undefined,
        description: String(formData.get("description") ?? "").trim() || undefined,
      })
      router.push("/contributor/events")
      router.refresh()
    } catch (err) {
      if (err instanceof ContributorApiError) setError(err.message)
      else setError("Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="mx-auto max-w-xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit(new FormData(e.currentTarget))
      }}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Event name <span className="text-destructive">*</span>
        </label>
        <Input id="name" name="name" required minLength={2} maxLength={180} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="eventDate" className="text-sm font-medium text-foreground flex items-center justify-between">
            Event date <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Input id="eventDate" name="eventDate" type="date" />
        </div>
        <div className="space-y-2">
          <label htmlFor="eventTime" className="text-sm font-medium text-foreground flex items-center justify-between">
            Event time <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Input id="eventTime" name="eventTime" placeholder="e.g. 7:00 PM" />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="country" className="text-sm font-medium text-foreground flex items-center justify-between">
          Country <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="country" name="country" />
      </div>
      <div className="space-y-2">
        <label htmlFor="stateRegion" className="text-sm font-medium text-foreground flex items-center justify-between">
          State / Region <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="stateRegion" name="stateRegion" />
      </div>
      <div className="space-y-2">
        <label htmlFor="city" className="text-sm font-medium text-foreground flex items-center justify-between">
          City <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="city" name="city" />
      </div>
      <div className="space-y-2">
        <label htmlFor="location" className="text-sm font-medium text-foreground flex items-center justify-between">
          Location <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="location" name="location" />
      </div>
      <div className="space-y-2">
        <label htmlFor="keywords" className="text-sm font-medium text-foreground flex items-center justify-between">
          Keywords <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="keywords" name="keywords" placeholder="Comma-separated" />
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground flex items-center justify-between">
          Description <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className={cn(
            "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
