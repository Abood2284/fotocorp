"use client"

import { useRouter } from "next/navigation"
import { AccessInquiryCloseButton } from "@/components/staff/access-inquiry-close-button"
import { InquiryStatusBadge } from "@/components/staff/inquiry-status-badge"
import { formatAssetInterestType } from "@/lib/staff/access-inquiry-labels"
import { canCloseInquiry } from "@/lib/staff/access-inquiry-guidance"

export interface AccessInquiryTableRowProps {
  inquiryId: string
  detailHref: string
  rowLabel: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
  companyEmail: string | null
  status: string
  createdAt: string
  isContributor: boolean
  proposedUsername: string | null
  interestedAssetTypes: string[]
}

export function AccessInquiryTableRow({
  inquiryId,
  detailHref,
  rowLabel,
  companyName,
  firstName,
  lastName,
  companyEmail,
  status,
  createdAt,
  isContributor,
  proposedUsername,
  interestedAssetTypes,
}: AccessInquiryTableRowProps) {
  const router = useRouter()
  const closable = canCloseInquiry(status)

  function openDetail() {
    router.push(detailHref)
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openDetail()
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={`Open ${rowLabel}`}
      className="group cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
      onClick={openDetail}
      onKeyDown={handleRowKeyDown}
    >
      <td className="px-4 py-3 font-medium text-foreground group-hover:text-primary">{companyName}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {firstName} {lastName}
        <div className="text-xs">{companyEmail}</div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {isContributor
          ? proposedUsername ?? "—"
          : (interestedAssetTypes ?? []).map((t) => formatAssetInterestType(t)).join(", ")}
      </td>
      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <InquiryStatusBadge status={status} isContributor={isContributor} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{new Date(createdAt).toLocaleString()}</td>
      <td
        className="px-4 py-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {closable ? (
          <AccessInquiryCloseButton inquiryId={inquiryId} label="Close" variant="ghost" size="sm" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
