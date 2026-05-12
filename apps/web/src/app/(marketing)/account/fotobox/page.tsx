import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { FotoboxGrid } from "@/components/account/fotobox-grid"
import { requireAuth } from "@/lib/app-user"
import { listFotoboxItems } from "@/lib/api/account-api"

export const metadata = {
  title: "Fotobox",
}

export default async function AccountFotoboxPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const result = await listFotoboxItems({ authUserId: appUser.authUserId, limit: 24 }).catch(() => ({
    ok: true as const,
    items: [],
    nextCursor: null,
  }))

  return (
    <AccountShell
      title="My Fotobox"
      description="Save images while browsing the archive, then return here when you are ready to review or download."
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{result.items.length} saved image{result.items.length === 1 ? "" : "s"}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Search archive
          </Link>
          <Link href="/search?sort=latest" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
            View latest
          </Link>
        </div>
      </div>

      {result.items.length > 0 ? (
        <FotoboxGrid items={result.items} isSubscriber={subscriber} />
      ) : (
        <section className="rounded-2xl border border-border bg-muted/25 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Your Fotobox is empty.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Save images while browsing the archive, then return here when you are ready to review or download.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/search" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Search archive
            </Link>
            <Link href="/search?sort=latest" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
              View latest
            </Link>
          </div>
        </section>
      )}
    </AccountShell>
  )
}
