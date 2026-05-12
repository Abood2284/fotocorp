import { AlertTriangle, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { getStaffContributorUploadBatch } from "@/lib/api/staff-contributor-uploads-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffContributorBatchClient } from "@/components/staff/contributor-uploads/staff-contributor-batch-client"

export const metadata = {
  title: "Contributor Batch Details — Fotocorp",
}

interface AdminContributorBatchPageProps {
  params: Promise<{ batchId: string }>
}

export default async function AdminContributorBatchPage({ params }: AdminContributorBatchPageProps) {
  const resolvedParams = await params
  const batchId = resolvedParams.batchId

  const response = await getStaffContributorUploadBatch(batchId).catch(() => null)

  if (!response) {
    return (
      <div className="space-y-4">
        <div>
          <Link
            href="/staff/contributor-uploads"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to queue
          </Link>
        </div>
        <EmptyState
          icon={AlertTriangle}
          title="Batch not found"
          description="The batch you are looking for may not exist or is unavailable."
        />
      </div>
    )
  }

  return <StaffContributorBatchClient response={response} />
}
