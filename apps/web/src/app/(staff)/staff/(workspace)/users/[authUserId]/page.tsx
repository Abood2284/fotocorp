import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { StaffUserDetailPanel } from "@/components/staff/users/staff-user-detail-panel"
import { StaffUserDownloadsList } from "@/components/staff/users/staff-user-downloads-list"
import { StaffUserDownloadPdfButton } from "@/components/staff/users/staff-user-download-pdf-button"
import { getInternalAdminUser, listInternalAdminUserDownloads } from "@/lib/api/admin-assets-api"

export const metadata = {
  title: "User detail — Fotocorp Staff",
}

interface StaffUserDetailPageProps {
  params: Promise<{ authUserId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffUserDetailPage({ params, searchParams }: StaffUserDetailPageProps) {
  const { authUserId } = await params
  const sp = await searchParams

  const from = typeof sp.from === "string" ? sp.from.trim() : undefined
  const to = typeof sp.to === "string" ? sp.to.trim() : undefined
  const cursor = typeof sp.cursor === "string" ? sp.cursor.trim() : undefined

  const userResponse = await getInternalAdminUser(authUserId).catch(() => null)
  if (!userResponse?.user) notFound()

  const downloadQuery = new URLSearchParams()
  if (from) downloadQuery.set("from", from)
  if (to) downloadQuery.set("to", to)
  if (cursor) downloadQuery.set("cursor", cursor)
  downloadQuery.set("limit", "25")

  const downloadsResponse = await listInternalAdminUserDownloads(authUserId, downloadQuery).catch(() => ({
    ok: true as const,
    items: [],
    nextCursor: null,
    total: 0,
  }))

  const nextQuery = new URLSearchParams()
  if (from) nextQuery.set("from", from)
  if (to) nextQuery.set("to", to)
  if (downloadsResponse.nextCursor) nextQuery.set("cursor", downloadsResponse.nextCursor)
  const nextHref = nextQuery.toString() ? `?${nextQuery.toString()}` : ""

  const clearQuery = new URLSearchParams()
  if (from) clearQuery.set("from", from)
  if (to) clearQuery.set("to", to)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/staff/users"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} />
            Back to users
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {userResponse.user.displayName || userResponse.user.username || "Unnamed user"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{userResponse.user.email}</p>
          {userResponse.user.username ? (
            <p className="mt-0.5 text-sm text-muted-foreground">@{userResponse.user.username}</p>
          ) : null}
        </div>
      </div>

      <StaffUserDetailPanel user={userResponse.user} />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Downloads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Images this user has downloaded. Filter by date and export a PDF report.
            </p>
          </div>
          <StaffUserDownloadPdfButton
            authUserId={authUserId}
            user={userResponse.user}
            from={from}
            to={to}
            totalDownloads={downloadsResponse.total}
          />
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            From
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="h-9 rounded border border-border bg-background px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            To
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="h-9 rounded border border-border bg-background px-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Apply
            </button>
            <Link
              href={`/staff/users/${authUserId}`}
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Clear
            </Link>
          </div>
          <p className="w-full text-xs text-muted-foreground">
            {downloadsResponse.total.toLocaleString()} download{downloadsResponse.total === 1 ? "" : "s"} in this view
          </p>
        </form>

        {downloadsResponse.items.length > 0 ? (
          <>
            <StaffUserDownloadsList items={downloadsResponse.items} />
            {downloadsResponse.nextCursor ? (
              <div className="flex justify-end">
                <Link
                  href={`/staff/users/${authUserId}${nextHref}`}
                  className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Load more
                  <ChevronRight size={14} />
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
            No downloads found for the selected date range.
          </div>
        )}
      </section>
    </div>
  )
}
