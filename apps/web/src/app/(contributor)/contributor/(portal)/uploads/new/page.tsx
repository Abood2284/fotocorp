import Link from "next/link"
import { Suspense } from "react"

import { ContributorUploadFlow } from "@/components/contributor/contributor-upload-flow"
import { getContributorMe } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "New upload batch",
}

export default async function NewContributorUploadPage() {
  await requireContributorPasswordReady()
  const cookieHeader = await getContributorCookieHeader()
  const session = await getContributorMe({ cookieHeader })

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/contributor/uploads"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to uploads
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">New upload batch</h1>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
            Loading upload wizard…
          </div>
        }
      >
        <ContributorUploadFlow initialSession={session} />
      </Suspense>
    </div>
  )
}
