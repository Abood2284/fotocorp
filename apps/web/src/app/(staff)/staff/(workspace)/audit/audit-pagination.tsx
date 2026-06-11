import Link from "next/link"

interface AuditPaginationProps {
  nextCursor: string | null
  searchParams: Record<string, string | undefined>
}

export function AuditPagination({ nextCursor, searchParams }: AuditPaginationProps) {
  if (!nextCursor) return null

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value)
  }
  params.set("cursor", nextCursor)

  return (
    <div className="flex justify-end">
      <Link
        href={`/staff/audit?${params.toString()}`}
        className="rounded-none border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
      >
        Older entries
      </Link>
    </div>
  )
}
