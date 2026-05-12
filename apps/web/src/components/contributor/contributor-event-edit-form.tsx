"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ContributorEventDto } from "@/lib/api/contributor-api"
import { ContributorApiError, updateContributorEvent } from "@/lib/api/contributor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function ContributorEventEditForm(props: { event: ContributorEventDto }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    try {
      await updateContributorEvent(props.event.id, {
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

  const e = props.event

  return (
    <form
      className="mx-auto max-w-xl space-y-6"
      onSubmit={(ev) => {
        ev.preventDefault()
        void onSubmit(new FormData(ev.currentTarget))
      }}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Event name
        </label>
        <Input id="name" name="name" required minLength={2} maxLength={180} defaultValue={e.name} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="eventDate" className="text-sm font-medium text-foreground">
            Event date
          </label>
          <Input id="eventDate" name="eventDate" type="date" defaultValue={e.eventDate ?? ""} />
        </div>
        <div className="space-y-2">
          <label htmlFor="eventTime" className="text-sm font-medium text-foreground">
            Event time
          </label>
          <Input id="eventTime" name="eventTime" defaultValue={e.eventTime ?? ""} placeholder="e.g. 7:00 PM" />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="country" className="text-sm font-medium text-foreground">
          Country
        </label>
        <Input id="country" name="country" defaultValue={e.country ?? ""} />
      </div>
      <div className="space-y-2">
        <label htmlFor="stateRegion" className="text-sm font-medium text-foreground">
          State / Region
        </label>
        <Input id="stateRegion" name="stateRegion" defaultValue={e.stateRegion ?? ""} />
      </div>
      <div className="space-y-2">
        <label htmlFor="city" className="text-sm font-medium text-foreground">
          City
        </label>
        <Input id="city" name="city" defaultValue={e.city ?? ""} />
      </div>
      <div className="space-y-2">
        <label htmlFor="location" className="text-sm font-medium text-foreground">
          Location
        </label>
        <Input id="location" name="location" defaultValue={e.location ?? ""} />
      </div>
      <div className="space-y-2">
        <label htmlFor="keywords" className="text-sm font-medium text-foreground">
          Keywords
        </label>
        <Input id="keywords" name="keywords" defaultValue={e.keywords ?? ""} />
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={e.description ?? ""}
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
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/contributor/events")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
