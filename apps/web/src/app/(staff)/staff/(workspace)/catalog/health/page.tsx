import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { getAdminCatalogStats } from "@/lib/api/admin-catalog-api"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Admin Catalog Health — Fotocorp",
}

export default async function AdminCatalogHealthPage() {
  const stats = await getAdminCatalogStats().catch(() => null)
  if (!stats) {
    return <EmptyState icon={AlertTriangle} title="Unable to load catalog health" description="Internal admin catalog service is unavailable." />
  }

  const checks = [
    {
      label: "R2 mapping coverage",
      value: ratio(stats.totalAssets - stats.missingR2Count, stats.totalAssets),
      healthy: stats.missingR2Count === 0,
      detail: `${stats.missingR2Count.toLocaleString()} missing of ${stats.totalAssets.toLocaleString()}`,
    },
    {
      label: "Card preview readiness",
      value: ratio(stats.readyCardPreviewCount, stats.totalAssets),
      healthy: stats.missingCardPreviewCount === 0,
      detail: `${stats.missingCardPreviewCount.toLocaleString()} missing READY card previews`,
    },
    {
      label: "Derivative failure rate",
      value: ratio(stats.failedDerivativeCount, stats.totalAssets),
      healthy: stats.failedDerivativeCount === 0,
      detail: `${stats.failedDerivativeCount.toLocaleString()} rows with FAILED derivatives`,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Catalog health</h2>
        <p className="mt-1 text-sm text-muted-foreground">Read-only operational summary for R2 mapping and preview derivative status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {checks.map((check) => (
          <Card key={check.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{check.label}</CardTitle>
              {check.healthy ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{check.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ratio(part: number, whole: number) {
  if (whole <= 0) return "0.00%"
  return `${((part / whole) * 100).toFixed(2)}%`
}
