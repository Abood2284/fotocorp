import Link from "next/link"
import { notFound } from "next/navigation"
import { ContributorEventEditForm } from "@/components/contributor/contributor-event-edit-form"
import { getContributorEvent, ContributorApiError } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "Edit Event",
}

export default async function ContributorEditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireContributorPasswordReady()
  const { eventId } = await params
  const cookieHeader = await getContributorCookieHeader()

  let detail: Awaited<ReturnType<typeof getContributorEvent>>
  try {
    detail = await getContributorEvent(eventId, { cookieHeader })
  } catch (err) {
    if (err instanceof ContributorApiError && err.status === 404) notFound()
    throw err
  }

  if (!detail.event.canEdit) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Cannot edit this event</h1>
        <p className="text-sm text-muted-foreground">
          You can only edit events you created. This event is available for reference or future uploads.
        </p>
        <Link href="/contributor/events" className="text-sm font-medium text-primary hover:underline">
          ← Back to events
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Edit event</h1>
        <p className="mt-1 text-sm text-muted-foreground">{detail.event.name}</p>
        <Link href="/contributor/events" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          ← Back to events
        </Link>
      </div>
      <ContributorEventEditForm event={detail.event} />
    </div>
  )
}
