import { AlertTriangle } from "lucide-react"
import { Suspense } from "react"

import { getStaffAccessInquiries, StaffApiError } from "@/lib/api/staff-api"
import { AccessInquiryTableRow } from "@/components/staff/access-inquiry-table-row"
import { StaffAccessInquiriesGuide } from "@/components/staff/staff-access-inquiries-guide"
import { type InquiryStatusFilter } from "@/lib/staff/access-inquiry-guidance"
import { getStaffCookieHeader } from "@/lib/staff-session"
import { EmptyState } from "@/components/shared/empty-state"
import { AccessInquiriesTabs } from "./access-inquiries-tabs"
import { AccessInquiriesFilters } from "./access-inquiries-filters"
import { ContextualHelpPanel } from "@/components/staff/help/contextual-help-panel"

export const metadata = {
  title: "Access inquiries — Fotocorp",
}

interface PageProps {
  searchParams: Promise<{ type?: string; status?: string }>
}

function parseStatusFilter(raw: string | undefined, isContributor: boolean): InquiryStatusFilter {
  const s = (raw ?? "").trim().toUpperCase()
  if (!s) return "ALL"
  if (isContributor) {
    if (s === "PENDING" || s === "CONTRIBUTOR_APPROVED" || s === "CLOSED") return s
    return "ALL"
  }
  if (s === "PENDING" || s === "IN_REVIEW" || s === "ACCESS_GRANTED" || s === "CLOSED") return s
  return "ALL"
}

export default async function StaffAccessInquiriesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const inquiryType =
    params.type === "CONTRIBUTOR_APPLICATION" ? "CONTRIBUTOR_APPLICATION" : ("USER_ACCESS" as const)
  const isContributor = inquiryType === "CONTRIBUTOR_APPLICATION"
  const statusFilter = parseStatusFilter(params.status, isContributor)
  const apiStatus = statusFilter === "ALL" ? undefined : statusFilter

  let items: Awaited<ReturnType<typeof getStaffAccessInquiries>>["items"] = []
  try {
    const res = await getStaffAccessInquiries({
      cookieHeader: await getStaffCookieHeader(),
      inquiryType,
      status: apiStatus,
    })
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
        <h2 className="font-serif text-2xl font-semibold text-foreground">Access inquiries</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isContributor
            ? "Review contributor applications and issue portal credentials."
            : "Review signup interest and generate entitlement drafts."}
        </p>
      </div>
      <ContextualHelpPanel
        contextKey={isContributor ? "staff.contributors.applications" : "staff.customer-access.inquiries"}
        cookieHeader={await getStaffCookieHeader()}
        compact
      />
      <Suspense fallback={null}>
        <AccessInquiriesTabs />
      </Suspense>
      <Suspense fallback={null}>
        <AccessInquiriesFilters />
      </Suspense>
      <StaffAccessInquiriesGuide isContributor={isContributor} statusFilter={statusFilter} items={items} />
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">{isContributor ? "Applicant" : "Company"}</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">{isContributor ? "Username" : "Interests"}</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No inquiries match this filter.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <AccessInquiryTableRow
                  key={row.inquiryId}
                  inquiryId={row.inquiryId}
                  detailHref={`/staff/access-inquiries/${row.inquiryId}`}
                  rowLabel={`${row.companyName ?? "Inquiry"} inquiry`}
                  companyName={row.companyName}
                  firstName={row.firstName}
                  lastName={row.lastName}
                  companyEmail={row.companyEmail}
                  status={row.status}
                  createdAt={row.createdAt}
                  isContributor={isContributor}
                  proposedUsername={row.proposedUsername}
                  interestedAssetTypes={row.interestedAssetTypes ?? []}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
