"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Calendar, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminEventListResponse } from "@/features/events/admin-events-types"

export function StaffEventsClient({ initialData }: { initialData: AdminEventListResponse }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const val = formData.get("q")?.toString().trim()
    const sp = new URLSearchParams(searchParams)
    if (val) {
      sp.set("q", val)
    } else {
      sp.delete("q")
    }
    sp.set("page", "1")
    router.push(`/staff/events?${sp.toString()}`)
  }

  function handleFilterChange(key: string, value: string | null) {
    const sp = new URLSearchParams(searchParams)
    if (value) {
      sp.set(key, value)
    } else {
      sp.delete(key)
    }
    sp.set("page", "1")
    router.push(`/staff/events?${sp.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Events</h2>
      </div>

      <div className="flex items-center gap-4 border-b border-border pb-4">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search events by name..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <select
          value={searchParams.get("source") ?? ""}
          onChange={(e) => handleFilterChange("source", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All Sources</option>
          <option value="Fotocorp">Fotocorp</option>
          <option value="LEGACY_IMPORT">Legacy Import</option>
          <option value="MANUAL">Manual</option>
        </select>

        <select
          value={searchParams.get("hasAssets") ?? ""}
          onChange={(e) => handleFilterChange("hasAssets", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Any Asset Status</option>
          <option value="true">Has Assets</option>
          <option value="false">Empty (No Assets)</option>
        </select>

        <Input
          type="number"
          min="0"
          placeholder="Min assets"
          className="w-28 h-9"
          value={searchParams.get("assetsMin") ?? ""}
          onChange={(e) => handleFilterChange("assetsMin", e.target.value)}
        />
        
        <Input
          type="number"
          min="0"
          placeholder="Max assets"
          className="w-28 h-9"
          value={searchParams.get("assetsMax") ?? ""}
          onChange={(e) => handleFilterChange("assetsMax", e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium">Event Name</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-right font-medium">Assets</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialData.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No events found matching your criteria.
                </td>
              </tr>
            ) : null}
            {initialData.items.map((event) => (
              <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{event.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {event.source}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {event.location || event.city || "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {event.photoCount || 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/staff/events/${event.id}`}>View & Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {initialData.items.length} of {initialData.total} events
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={initialData.page <= 1}
            onClick={() => handleFilterChange("page", String(initialData.page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={initialData.page * initialData.limit >= initialData.total}
            onClick={() => handleFilterChange("page", String(initialData.page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
