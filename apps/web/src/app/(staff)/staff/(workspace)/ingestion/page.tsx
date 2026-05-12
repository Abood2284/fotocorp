import { AlertTriangle, Workflow } from "lucide-react"
import { getAssetRepository } from "@/features/assets/repository"
import { EmptyState } from "@/components/shared/empty-state"
import { IngestionRunsPanel } from "@/components/admin/ingestion-runs-panel"

export default async function StaffIngestionPage() {
  const repository = getAssetRepository()
  const runs = await repository.listIngestionRuns().catch(() => null)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Ingestion operations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor ingestion runs, inspect errors, and triage pipeline health.
        </p>
      </div>
      {runs === null ? (
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load ingestion runs"
          description="The provisional API is unavailable. Retry shortly or run in fixture mode."
        />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No ingestion runs available"
          description="Run ingestion from the API side to populate this dashboard."
        />
      ) : (
        <IngestionRunsPanel runs={runs} />
      )}
    </div>
  )
}
