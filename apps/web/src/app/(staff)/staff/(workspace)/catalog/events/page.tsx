
import { AlertTriangle } from "lucide-react"
import { getAdminCatalogFilters } from "@/lib/api/admin-catalog-api"
import { EmptyState } from "@/components/shared/empty-state"

import Link from "next/link"

export const metadata = {
  title: "Admin Catalog Events — Fotocorp",
}

export default async function AdminCatalogEventsPage() {
  const filters = await getAdminCatalogFilters().catch(() => null)
  if (!filters) {
    return <EmptyState icon={AlertTriangle} title="Unable to load event catalog" description="Internal admin catalog service is unavailable." />
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Event catalog coverage</h2>
        <p className="mt-1 text-sm text-muted-foreground">Read-only event counts across the imported asset catalog.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Event</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Event date</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground">Assets</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filters.events.map((event) => (
              <tr key={event.id} className="border-t border-border">
                <td className="px-3 py-2">{event.name ?? "Untitled event"}</td>
                <td className="px-3 py-2 text-muted-foreground">{event.eventDate ? new Date(event.eventDate).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-3 py-2 text-right font-medium">{event.assetCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <Link href={`/staff/catalog?eventId=${encodeURIComponent(event.id)}`} className="font-medium text-primary hover:underline">
                      Open in catalog
                    </Link>
                    {event.assetCount > 0 ? (
                      <Link
                        href={`/staff/catalog?eventId=${encodeURIComponent(event.id)}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Bulk edit metadata
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
