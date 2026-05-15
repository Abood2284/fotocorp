"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info } from "lucide-react"
import { purgeAdminEventAction } from "@/app/(staff)/staff/(workspace)/events/actions"
import type { AdminEventPurgeResult } from "@/features/events/admin-events-types"

export function StaffEventPurgeModal({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdminEventPurgeResult | null>(null)

  async function handlePurge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const exactName = formData.get("exactName")?.toString() || ""
    const phrase = formData.get("phrase")?.toString() || ""
    const password = formData.get("password")?.toString() || ""

    if (exactName !== eventName) {
      setError("Event name does not match exactly.")
      setIsSubmitting(false)
      return
    }

    if (phrase !== "PURGE EVENT") {
      setError("You must type exactly: PURGE EVENT")
      setIsSubmitting(false)
      return
    }

    if (!password) {
      setError("Password is required.")
      setIsSubmitting(false)
      return
    }

    try {
      const res = await purgeAdminEventAction(eventId, formData)
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        setResult(res.data)
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-800 dark:text-green-300">
          <strong>Event permanently purged.</strong>
          <ul className="mt-2 list-disc pl-5">
            <li>Assets deleted from DB: {result.dbDeleted.assets}</li>
            <li>Derivatives deleted from DB: {result.dbDeleted.derivatives}</li>
            <li>Originals deleted from R2: {result.r2Results.originalsDeleted} (Failed: {result.r2Results.originalsFailed})</li>
            <li>Previews deleted from R2: {result.r2Results.previewsDeleted} (Failed: {result.r2Results.previewsFailed})</li>
            <li>Uploads deleted from R2: {result.r2Results.uploadsDeleted} (Failed: {result.r2Results.uploadsFailed})</li>
          </ul>
          {(result.r2Results.originalsFailed > 0 || result.r2Results.previewsFailed > 0 || result.r2Results.uploadsFailed > 0) && (
            <div className="mt-3 flex items-start gap-2 rounded bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Some R2 objects failed to delete. The database records were successfully purged, but there may be orphaned objects in the storage buckets.</p>
            </div>
          )}
        </div>
        <Button onClick={() => router.push("/staff/events")} variant="outline">
          Return to Events List
        </Button>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        Permanently Purge Event
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-destructive bg-destructive/5 p-4">
      <div className="mb-4 flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" />
        Confirm Permanent Purge
      </div>
      
      <form onSubmit={handlePurge} className="space-y-4">
        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">1. Confirm Event Name</label>
          <p className="text-xs text-muted-foreground">Type: <strong className="select-all bg-muted px-1">{eventName}</strong></p>
          <Input name="exactName" autoComplete="off" placeholder={eventName} required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">2. Confirmation Phrase</label>
          <p className="text-xs text-muted-foreground">Type: <strong className="select-all bg-muted px-1">PURGE EVENT</strong></p>
          <Input name="phrase" autoComplete="off" placeholder="PURGE EVENT" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">3. Administrator Password</label>
          <p className="text-xs text-muted-foreground">Confirm your SUPER_ADMIN password.</p>
          <Input name="password" type="password" required />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            {isSubmitting ? "Purging..." : "Confirm Purge"}
          </Button>
        </div>
      </form>
    </div>
  )
}
