"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { AdminEventListItem } from "@/features/events/admin-events-types"
import { updateAdminEventAction } from "@/app/(staff)/staff/(workspace)/events/actions"

export function StaffEventEditForm({ event }: { event: AdminEventListItem }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await updateAdminEventAction(event.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          Event updated successfully.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input name="name" defaultValue={event.name} required />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Source</label>
          <Input value={event.source} disabled className="bg-muted" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          name="description"
          defaultValue={event.description || ""}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Event Date</label>
          <Input
            name="eventDate"
            type="datetime-local"
            defaultValue={event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 16) : ""}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Location</label>
          <Input name="location" defaultValue={event.location || ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">City</label>
          <Input name="city" defaultValue={event.city || ""} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">State / Region</label>
          <Input name="stateRegion" defaultValue={event.stateRegion || ""} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Country</label>
          <Input name="country" defaultValue={event.country || ""} />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
