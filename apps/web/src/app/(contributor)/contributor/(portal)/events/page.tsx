import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getContributorEvents } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"
import { CalendarDays, Pencil } from "lucide-react"

export const metadata = {
  title: "Contributor Events",
}

function createdByLabel(source: string) {
  if (source === "LEGACY_IMPORT") return "Legacy import"
  if (source === "ADMIN") return "Admin"
  if (source === "CONTRIBUTOR") return "Contributor"
  if (source === "SYSTEM") return "System"
  return source
}

function cityLocation(event: { city: string | null; location: string | null }) {
  return [event.city, event.location].filter(Boolean).join(" · ") || "—"
}

export default async function ContributorEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireContributorPasswordReady()
  const params = await searchParams
  const q = params.q?.trim() || undefined
  const cookieHeader = await getContributorCookieHeader()
  const data = await getContributorEvents({ scope: "mine", q, limit: 24, offset: 0 }, { cookieHeader })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <CalendarDays className="text-muted-foreground" size={32} />
            My events
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage events for your editorial upload batches.
          </p>
        </div>
        <Button asChild>
          <Link href="/contributor/uploads/new">Create event</Link>
        </Button>
      </div>

      <form method="get" className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-muted-foreground">Search</span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, city, location…"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Event name</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">City / Location</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No events yet. Create one from a new upload.
                </td>
              </tr>
            ) : (
              data.events.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{event.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{event.eventDate ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cityLocation(event)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{createdByLabel(event.createdBySource)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{event.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.canEdit ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contributor/events/${event.id}/edit`}>
                          <Pencil className="mr-1" size={14} />
                          Edit
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {data.events.length} of {data.pagination.total} in My events.
      </p>
    </div>
  )
}
