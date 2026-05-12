import Link from "next/link"
import { ContributorEventCreateForm } from "@/components/contributor/contributor-event-create-form"
import { requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "Create Event",
}

export default async function ContributorNewEventPage() {
  await requireContributorPasswordReady()

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Create event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an event for your upload batch. You can edit this information later.
        </p>
        <Link href="/contributor/events" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          ← Back to events
        </Link>
      </div>
      <ContributorEventCreateForm />
    </div>
  )
}
