import { AlertTriangle, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { getAdminEvent } from "@/lib/api/admin-events-api"
import { assertStaffRouteAccess, requireStaff } from "@/lib/staff-session"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffUploadFlow } from "@/components/staff/staff-upload-flow"

interface StaffEventUploadPageProps {
  params: Promise<{ eventId: string }>
}

export const metadata = {
  title: "Upload assets to event — Fotocorp Staff",
}

export const dynamic = "force-dynamic"

export default async function StaffEventUploadPage({ params }: StaffEventUploadPageProps) {
  const staff = await requireStaff()
  await assertStaffRouteAccess(staff.role)

  const { eventId } = await params
  const response = await getAdminEvent(eventId).catch(() => undefined)

  if (response === undefined) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load event"
        description="Internal admin events service is unavailable."
      />
    )
  }

  if (response === null) notFound()

  const { event } = response

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/staff/events/${event.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to {event.name}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Upload assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add JPEG images to <strong>{event.name}</strong>. Select a photographer, upload files, then submit the batch for review.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
            Loading upload wizard…
          </div>
        }
      >
        <StaffUploadFlow existingEvent={{ id: event.id, name: event.name }} />
      </Suspense>
    </div>
  )
}
