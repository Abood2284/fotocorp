import { StaffPipelineClient } from "@/components/staff/pipeline/staff-pipeline-client"

export const metadata = {
  title: "Pipeline — Fotocorp",
}

interface PipelinePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffPipelinePage({ searchParams }: PipelinePageProps) {
  const params = await searchParams
  const assetId = readSingleParam(params?.assetId)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Pipeline</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Read-only view of derivative generation jobs across catalog preview regen, image publish, and caricature preview queues.
        </p>
      </div>
      <StaffPipelineClient initialAssetIdFilter={assetId} />
    </div>
  )
}

function readSingleParam(value: string | string[] | undefined): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.trim() || null
  return value.trim() || null
}
