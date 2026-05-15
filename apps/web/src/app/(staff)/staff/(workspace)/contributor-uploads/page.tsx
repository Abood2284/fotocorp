import { AlertTriangle } from "lucide-react"
import { listStaffContributorUploads } from "@/lib/api/staff-contributor-uploads-api"
import { getAdminAssetFilters } from "@/lib/api/admin-assets-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffContributorUploadsClient } from "@/components/staff/contributor-uploads/staff-contributor-uploads-client"

interface StaffContributorUploadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Contributor Uploads — Fotocorp",
}

const STATUS_DEFAULT = "SUBMITTED"
const LIMIT_DEFAULT = 24

export default async function StaffContributorUploadsPage({ searchParams }: StaffContributorUploadsPageProps) {
  const sp = await searchParams
  const status = parseStatus(takeOne(sp.status))
  const eventId = takeOne(sp.eventId)
  const contributorId = takeOne(sp.contributorId)
  const batchId = takeOne(sp.batchId)
  const q = takeOne(sp.q)
  const from = takeOne(sp.from)
  const to = takeOne(sp.to)
  const assetType = parseAssetType(takeOne(sp.assetType))
  const sort = parseSortKey(takeOne(sp.sort))
  const order = parseOrderKey(takeOne(sp.order))
  const limit = parsePositiveInt(takeOne(sp.limit), LIMIT_DEFAULT, 100)
  const offset = parsePositiveInt(takeOne(sp.offset), 0, 100000)

  const [uploads, filters] = await Promise.all([
    listStaffContributorUploads({
      status,
      eventId,
      contributorId,
      batchId,
      q,
      from,
      to,
      assetType,
      sort,
      order,
      limit,
      offset,
    }).catch(() => null),
    getAdminAssetFilters().catch(() => null),
  ])

  if (!uploads) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load contributor uploads"
        description="Internal staff contributor uploads service is unavailable."
      />
    )
  }

  return (
    <StaffContributorUploadsClient
      initialResponse={uploads}
      filters={filters}
      currentParams={{ status, eventId, contributorId, batchId, q, from, to, assetType, sort, order, limit, offset }}
    />
  )
}

function parseStatus(
  value: string | undefined,
): "SUBMITTED" | "APPROVED" | "ACTIVE" | "all" {
  if (value === "APPROVED" || value === "ACTIVE" || value === "all") return value
  if (value === "SUBMITTED") return "SUBMITTED"
  return STATUS_DEFAULT
}

function parseAssetType(
  value: string | undefined,
): "IMAGE" | "VIDEO" | "CARICATURE" | "all" {
  if (value === "IMAGE" || value === "VIDEO" || value === "CARICATURE" || value === "all") return value
  return "all"
}

function parseSortKey(value: string | undefined): "submitted" | "contributor" | "event" | undefined {
  if (value === "submitted" || value === "contributor" || value === "event") return value
  return undefined
}

function parseOrderKey(value: string | undefined): "asc" | "desc" | undefined {
  if (value === "asc" || value === "desc") return value
  return undefined
}

function takeOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined
  if (typeof value === "string") return value.trim() || undefined
  return undefined
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) return fallback
  return parsed
}
