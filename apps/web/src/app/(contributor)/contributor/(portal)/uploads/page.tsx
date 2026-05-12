import Link from "next/link"
import { UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getContributorEvents, getContributorUploadBatches } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "Upload batches",
}

const FILTER_LINKS: { label: string; status?: string }[] = [
  { label: "All" },
  { label: "Open", status: "OPEN" },
  { label: "Submitted", status: "SUBMITTED" },
  { label: "Completed", status: "COMPLETED" },
  { label: "Failed", status: "FAILED" },
]

function shortBatchRef(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

export default async function ContributorUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireContributorPasswordReady()
  const params = await searchParams
  const raw = params.status?.toUpperCase()
  const status =
    raw === "OPEN" || raw === "SUBMITTED" || raw === "COMPLETED" || raw === "FAILED" || raw === "CANCELLED"
      ? raw
      : undefined

  const cookieHeader = await getContributorCookieHeader()
  const [batchData, eventsData] = await Promise.all([
    getContributorUploadBatches({ status, limit: 50, offset: 0 }, { cookieHeader }),
    getContributorEvents({ scope: "available", limit: 100 }, { cookieHeader }).catch(() => ({
      ok: true as const,
      events: [],
      pagination: { limit: 0, offset: 0, total: 0 },
    })),
  ])

  const eventNameById = new Map(eventsData.events.map((e) => [e.id, e.name]))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            Uploads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bulk uploads for an event. Fotocorp reviews and publishes selected images — your files stay private until then.
          </p>
        </div>
        <Button asChild>
          <Link href="/contributor/uploads/new">New upload batch</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {FILTER_LINKS.map((f) => {
          const href = f.status ? `/contributor/uploads?status=${f.status}` : "/contributor/uploads"
          const active = (f.status ?? "") === (status ?? "")
          return (
            <Link
              key={f.label}
              href={href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batchData.batches.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No upload batches yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Batch</th>
                    <th className="pb-2 pr-3 font-medium">Event</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium tabular-nums">Files</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 pr-3 font-medium">Submitted</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batchData.batches.map((b) => (
                    <tr key={b.id} className="text-foreground">
                      <td className="py-3 pr-3 font-mono text-xs">{shortBatchRef(b.id)}</td>
                      <td className="py-3 pr-3">{eventNameById.get(b.eventId) ?? "—"}</td>
                      <td className="py-3 pr-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{b.status}</span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                        {b.uploadedFiles}/{b.totalFiles}
                        {b.failedFiles > 0 ? ` (${b.failedFiles} failed)` : ""}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground tabular-nums">
                        {new Date(b.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground tabular-nums">
                        {b.submittedAt
                          ? new Date(b.submittedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3">
                        <Link href={`/contributor/uploads/${b.id}`} className="font-medium text-primary hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
