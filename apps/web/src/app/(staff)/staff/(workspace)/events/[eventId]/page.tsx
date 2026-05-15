import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ChevronLeft, Calendar as CalendarIcon, ExternalLink } from "lucide-react"
import { getAdminEvent } from "@/lib/api/admin-events-api"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StaffEventEditForm } from "@/components/staff/events/staff-event-edit-form"
import { StaffEventPurgeModal } from "@/components/staff/events/staff-event-purge-modal"

interface StaffEventDetailPageProps {
  params: Promise<{ eventId: string }>
}

export const metadata = {
  title: "Event Detail — Fotocorp Staff",
}

export default async function StaffEventDetailPage({ params }: StaffEventDetailPageProps) {
  const { eventId } = await params
  const response = await getAdminEvent(eventId).catch(() => undefined)

  if (response === undefined) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load event detail"
        description="Internal admin events service is unavailable."
      />
    )
  }

  if (response === null) notFound()

  const { event, assetStats } = response

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to events
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Event: {event.name}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/staff/catalog?eventId=${event.id}`} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Assets in Catalog
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event details</CardTitle>
            </CardHeader>
            <CardContent>
              <StaffEventEditForm event={event} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium text-muted-foreground">Total Assets</div>
                  <div className="mt-1 text-2xl font-bold">{assetStats.total}</div>
                </div>
                <div className="rounded-md border p-3 border-green-500/20 bg-green-500/5">
                  <div className="text-sm font-medium text-green-600 dark:text-green-400">Public</div>
                  <div className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{assetStats.public}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium text-muted-foreground">Private</div>
                  <div className="mt-1 text-2xl font-bold">{assetStats.private}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently purge this event and all associated assets, derivatives, logs, and R2 objects. This action cannot be undone. Only SUPER_ADMIN accounts can perform this action.
              </p>
              <StaffEventPurgeModal eventId={event.id} eventName={event.name} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
