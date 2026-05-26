import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { FotoboxBoardPage } from "@/components/account/fotobox-board-page"
import { requireAuth } from "@/lib/app-user"
import { listFotoboxBoards } from "@/lib/api/account-api"

export const metadata = {
  title: "Fotobox",
}

export default async function AccountFotoboxPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"

  const boardsResult = await listFotoboxBoards(appUser.authUserId).catch(() => ({
    ok: true as const,
    boards: [],
  }))

  const boards = boardsResult.boards ?? []

  return (
    <AccountShell
      title="My Fotobox"
      description="Organize saved images into boards, then return here to review or download."
    >
      {boards.length > 0 ? (
        <FotoboxBoardPage initialBoards={boards} isSubscriber={subscriber} />
      ) : (
        <section className="rounded-2xl border border-border bg-muted/25 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Your Fotobox is empty.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Save images while browsing the archive, create boards to organize them, then return here when ready to review or download.
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
