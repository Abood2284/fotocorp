import { AlertTriangle } from "lucide-react"
import { getAdminCatalogFilters } from "@/lib/api/admin-catalog-api"
import { EmptyState } from "@/components/shared/empty-state"

export const metadata = {
  title: "Admin Catalog Categories — Fotocorp",
}

export default async function AdminCatalogCategoriesPage() {
  const filters = await getAdminCatalogFilters().catch(() => null)
  if (!filters) {
    return <EmptyState icon={AlertTriangle} title="Unable to load categories" description="Internal admin catalog service is unavailable." />
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Category distribution</h2>
        <p className="mt-1 text-sm text-muted-foreground">Read-only category counts across all imported image rows.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Category</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground">Assets</th>
            </tr>
          </thead>
          <tbody>
            {filters.categories.map((category) => (
              <tr key={category.id} className="border-t border-border">
                <td className="px-3 py-2">{category.name}</td>
                <td className="px-3 py-2 text-right font-medium">{category.assetCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
