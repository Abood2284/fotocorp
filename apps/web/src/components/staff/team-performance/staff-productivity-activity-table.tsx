import Link from "next/link"

import type { StaffProductivityActivityItem } from "@/lib/api/staff-api"

interface StaffProductivityActivityTableProps {
  items: StaffProductivityActivityItem[]
  nextCursor: string | null
  olderHref: string | null
}

export function StaffProductivityActivityTable({
  items,
  nextCursor,
  olderHref,
}: StaffProductivityActivityTableProps) {
  return (
    <section className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Fields</th>
              <th className="px-4 py-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No activity in this range.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.source}-${item.id}`} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                      {item.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.entityHref ? (
                      <Link href={item.entityHref} className="font-medium text-foreground hover:underline">
                        {item.assetLabel || shortId(item.assetId)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{item.assetLabel || "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.changedFields.length > 0 ? item.changedFields.map(humanizeField).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">{item.summary}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {nextCursor && olderHref ? (
        <div className="flex justify-end">
          <Link
            href={olderHref}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Older activity
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shortId(value: string | null) {
  if (!value) return "—"
  return value.length <= 12 ? value : value.slice(0, 8)
}

function humanizeField(field: string) {
  switch (field) {
    case "who_is_in_picture":
      return "who in picture"
    case "category_id":
      return "category"
    case "event_id":
      return "event"
    case "contributor_id":
      return "contributor"
    default:
      return field.replaceAll("_", " ")
  }
}
