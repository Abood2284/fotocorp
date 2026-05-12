import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContributorApiError, getContributorUploadBatch } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export async function generateMetadata({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  return { title: `Upload batch ${batchId.slice(0, 8)}` }
}

function formatBytes(n: number | null) {
  if (n === null) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ContributorUploadBatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requireContributorPasswordReady()
  const { batchId } = await params
  const cookieHeader = await getContributorCookieHeader()

  let data: Awaited<ReturnType<typeof getContributorUploadBatch>>
  try {
    data = await getContributorUploadBatch(batchId, { cookieHeader })
  } catch (e) {
    if (e instanceof ContributorApiError && e.status === 404) notFound()
    throw e
  }

  const { batch, event, items } = data
  const eventSubtitle = [event.eventDate, [event.city, event.location].filter(Boolean).join(" · ")].filter(Boolean).join(" · ")

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/contributor/uploads"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All uploads
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Upload batch</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{batch.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="mt-1 font-medium text-foreground">{batch.status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Files</p>
            <p className="mt-1 font-medium tabular-nums text-foreground">
              {batch.uploadedFiles} uploaded / {batch.totalFiles} total
              {batch.failedFiles > 0 ? ` · ${batch.failedFiles} failed` : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Submitted at</p>
            <p className="mt-1 text-foreground tabular-nums">
              {batch.submittedAt
                ? new Date(batch.submittedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="mt-1 text-foreground tabular-nums">
              {new Date(batch.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          {batch.commonTitle ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Common title</p>
              <p className="mt-1 text-foreground">{batch.commonTitle}</p>
            </div>
          ) : null}
          {batch.commonCaption ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Common caption</p>
              <p className="mt-1 text-foreground">{batch.commonCaption}</p>
            </div>
          ) : null}
          {batch.commonKeywords ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Common keywords</p>
              <p className="mt-1 text-foreground">{batch.commonKeywords}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium text-foreground">{event.name}</p>
          <p className="mt-1 text-muted-foreground">{eventSubtitle || "—"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Status: {event.status}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files in this batch.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.mimeType ?? "—"} · {formatBytes(item.sizeBytes)}
                      </p>
                      {item.failureMessage ? (
                        <p className="mt-1 text-xs text-destructive">
                          {item.failureCode ? `${item.failureCode}: ` : ""}
                          {item.failureMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{item.uploadStatus}</span>
                      {item.imageAssetId ? (
                        <span className="font-mono text-xs text-muted-foreground">Asset {item.imageAssetId.slice(0, 8)}…</span>
                      ) : null}
                      {item.imageAssetStatus && item.imageAssetVisibility ? (
                        <span className="text-xs text-muted-foreground">
                          {item.imageAssetStatus} · {item.imageAssetVisibility}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
