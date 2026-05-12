import Link from "next/link"
import { CalendarDays, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getContributorEvents } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

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
  searchParams: Promise<{ scope?: string; q?: string }>
}) {
  await requireContributorPasswordReady()
  const params = await searchParams
  const scope = params.scope === "available" ? "available" : "mine"
  const q = params.q?.trim() || undefined
  const cookieHeader = await getContributorCookieHeader()
  const data = await getContributorEvents({ scope, q, limit: 24, offset: 0 }, { cookieHeader })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            Events
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an event for your upload batch. Available events include legacy and shared events you can attach later.
          </p>
        </div>
        <Button asChild>
          <Link href="/contributor/events/new">Create event</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Link
          href={q ? `/contributor/events?scope=mine&q=${encodeURIComponent(q)}` : "/contributor/events?scope=mine"}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          My events
        </Link>
        <Link
          href={
            q ? `/contributor/events?scope=available&q=${encodeURIComponent(q)}` : "/contributor/events?scope=available"
          }
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            scope === "available" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          Available events
        </Link>
      </div>

      <form method="get" className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="scope" value={scope} />
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
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No events match this view.
                </td>
              </tr>
            ) : (
              data.events.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{event.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{event.eventDate ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cityLocation(event)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{createdByLabel(event.createdBySource)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{event.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.canEdit ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contributor/events/${event.id}/edit`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
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
        Showing {data.events.length} of {data.pagination.total} {scope === "mine" ? "in My events" : "active events"}.
      </p>
    </div>
  )
}
