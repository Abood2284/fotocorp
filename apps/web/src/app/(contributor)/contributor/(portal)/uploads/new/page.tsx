import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ContributorUploadFlow } from "@/components/contributor/contributor-upload-flow"
import { getContributorEvents } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "New upload batch",
}

export default async function NewContributorUploadPage() {
  await requireContributorPasswordReady()
  const cookieHeader = await getContributorCookieHeader()
  const events = await getContributorEvents({ scope: "available", limit: 100 }, { cookieHeader })

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/contributor/uploads"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to uploads
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">New upload batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an active event, add optional shared metadata, then upload images. Files are sent directly to secure storage.
        </p>
      </div>

      <ContributorUploadFlow initialEvents={events.events} />
    </div>
  )
}
