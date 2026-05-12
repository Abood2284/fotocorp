import Link from "next/link"
import { ArrowRight, AlertTriangle } from "lucide-react"
import { getAdminAssetStats } from "@/lib/api/admin-assets-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { staffNavItemsForRole } from "@/lib/staff/staff-navigation"
import { requireStaff } from "@/lib/staff-session"

export const metadata = {
  title: "Staff Dashboard — Fotocorp",
}

export default async function StaffDashboardPage() {
  const staff = await requireStaff()
  const stats = await getAdminAssetStats().catch(() => null)

  const modules = staffNavItemsForRole(staff.role).filter((item) => item.href !== "/staff/dashboard")

  if (!stats) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load dashboard"
        description="Internal staff assets API request failed."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational snapshot for assets, previews, and ingestion coverage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total assets" value={stats.totalAssets.toLocaleString()} hint="All imported rows" />
        <StatCard label="Approved public" value={stats.approvedPublicAssets.toLocaleString()} hint="Publicly visible assets" />
        <StatCard label="Missing R2" value={stats.missingR2Count.toLocaleString()} hint="Source object not verified" />
        <StatCard label="Failed derivatives" value={stats.failedDerivativeCount.toLocaleString()} hint="At least one variant failed" />
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No workspace modules are assigned to your role yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff modules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md border border-border bg-background p-3 transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {label}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
