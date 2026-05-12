import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { DownloadHistoryList } from "@/components/account/download-history-list"
import { requireAuth } from "@/lib/app-user"
import { listDownloadHistory } from "@/lib/api/account-api"

export const metadata = {
  title: "My Downloads",
}

interface AccountDownloadsPageProps {
  searchParams?: Promise<{ year?: string; month?: string }>
}

const months = [
  ["1", "Jan"],
  ["2", "Feb"],
  ["3", "Mar"],
  ["4", "Apr"],
  ["5", "May"],
  ["6", "Jun"],
  ["7", "Jul"],
  ["8", "Aug"],
  ["9", "Sep"],
  ["10", "Oct"],
  ["11", "Nov"],
  ["12", "Dec"],
] as const

export default async function AccountDownloadsPage({ searchParams }: AccountDownloadsPageProps) {
  const appUser = await requireAuth()
  const params = await searchParams
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const result = await listDownloadHistory({
    authUserId: appUser.authUserId,
    year: params?.year,
    month: params?.month,
    limit: 25,
  }).catch(() => ({
    ok: true as const,
    items: [],
    nextCursor: null,
  }))

  return (
    <AccountShell
      title="My Downloads"
      description="Licensed subscriber downloads appear here by newest activity first."
    >
      <form className="mb-5 grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Year</span>
          <select name="year" defaultValue={params?.year ?? ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
            <option value="">All years</option>
            {yearOptions().map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Month</span>
          <select name="month" defaultValue={params?.month ?? ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
            <option value="">All months</option>
            {months.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Apply
          </button>
          <Link href="/account/downloads" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
            Clear
          </Link>
        </div>
      </form>

      {result.items.length > 0 ? (
        <DownloadHistoryList items={result.items} isSubscriber={subscriber} />
      ) : (
        <section className="rounded-2xl border border-border bg-muted/25 p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">No downloads yet.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Licensed downloads will appear here after you download subscriber files.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/search" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Search archive
            </Link>
            <Link href="/account/fotobox" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
              View Fotobox
            </Link>
          </div>
        </section>
      )}
    </AccountShell>
  )
}

function yearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, index) => current - index)
}
