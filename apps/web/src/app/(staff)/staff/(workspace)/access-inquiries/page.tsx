import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { getStaffAccessInquiries, StaffApiError } from "@/lib/api/staff-api"
import { formatAssetInterestType, formatInquiryStatus } from "@/lib/staff/access-inquiry-labels"
import { getStaffCookieHeader } from "@/lib/staff-session"
import { EmptyState } from "@/components/shared/empty-state"

export const metadata = {
  title: "Access inquiries — Fotocorp",
}

export default async function StaffAccessInquiriesPage() {
  let items: Awaited<ReturnType<typeof getStaffAccessInquiries>>["items"] = []
  try {
    const res = await getStaffAccessInquiries({ cookieHeader: await getStaffCookieHeader() })
    items = res.items
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load inquiries"
        description="The staff access inquiry service is unavailable or you may not have access."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Customer access inquiries</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review signup interest and generate entitlement drafts.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Interests</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No inquiries yet.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.inquiryId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/staff/access-inquiries/${row.inquiryId}`} className="font-medium text-primary hover:underline">
                      {row.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.firstName} {row.lastName}
                    <div className="text-xs">{row.companyEmail}</div>
                  </td>
              <td className="px-4 py-3 text-muted-foreground">
                {(row.interestedAssetTypes ?? []).map((t) => formatAssetInterestType(t)).join(", ")}
              </td>
              <td className="px-4 py-3">{formatInquiryStatus(row.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
