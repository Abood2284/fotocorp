"use client"

import { FileDown, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { AdminCatalogUserItem } from "@/features/assets/admin-catalog-types"
import { fetchAdminUserDownloadsForExportAction } from "@/app/(staff)/staff/(workspace)/users/actions"
import {
  fetchAllAdminUserDownloadsForExport,
  generateStaffUserDownloadReportPdf,
} from "@/lib/staff-user-download-pdf"

interface StaffUserDownloadPdfButtonProps {
  authUserId: string
  user: AdminCatalogUserItem
  from?: string
  to?: string
  totalDownloads: number
}

export function StaffUserDownloadPdfButton({
  authUserId,
  user,
  from,
  to,
  totalDownloads,
}: StaffUserDownloadPdfButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading">("idle")

  async function handleClick() {
    setStatus("loading")
    try {
      const downloads = await fetchAllAdminUserDownloadsForExport(
        (params) => fetchAdminUserDownloadsForExportAction(authUserId, params),
        from,
        to,
      )

      const doc = generateStaffUserDownloadReportPdf(downloads, {
        userLabel: user.displayName || user.username || user.email,
        userEmail: user.email,
        generatedAt: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
        dateFrom: from,
        dateTo: to,
        totalDownloads,
      })

      const slug = (user.username || user.email.split("@")[0] || "user").replace(/[^a-z0-9-]+/gi, "-")
      doc.save(`fotocorp-user-downloads-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch {
      // User can retry
    } finally {
      setStatus("idle")
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={status === "loading"} onClick={handleClick}>
      {status === "loading" ? (
        <>
          <Loader2 className="mr-1.5 animate-spin" size={16} />
          Generating…
        </>
      ) : (
        <>
          <FileDown className="mr-1.5" size={16} />
          Download report (PDF)
        </>
      )}
    </Button>
  )
}
