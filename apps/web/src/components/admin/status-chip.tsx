import { Badge } from "@/components/ui/badge"
import type { AdminAssetStatus, IngestionRunStatus } from "@/lib/fixtures/admin"

interface AssetStatusChipProps {
  status: AdminAssetStatus
}

interface RunStatusChipProps {
  status: IngestionRunStatus
}

const ASSET_STATUS_MAP: Record<
  AdminAssetStatus,
  { label: string; variant: "secondary" | "success" | "warning" | "destructive" }
> = {
  mapped: { label: "Mapped", variant: "success" },
  "preview-ready": { label: "Preview ready", variant: "secondary" },
  "missing-metadata": { label: "Missing metadata", variant: "warning" },
  "ingestion-error": { label: "Ingestion error", variant: "destructive" },
}

const RUN_STATUS_MAP: Record<
  IngestionRunStatus,
  { label: string; variant: "secondary" | "success" | "warning" | "destructive" }
> = {
  running: { label: "Running", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
}

export function AssetStatusChip({ status }: AssetStatusChipProps) {
  const item = ASSET_STATUS_MAP[status]
  return <Badge variant={item.variant}>{item.label}</Badge>
}

export function RunStatusChip({ status }: RunStatusChipProps) {
  const item = RUN_STATUS_MAP[status]
  return <Badge variant={item.variant}>{item.label}</Badge>
}
