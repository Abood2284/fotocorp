"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getContributorDownloads } from "@/lib/api/contributor-api"
import {
  generateDownloadReportPdf,
  fetchAllDownloadsForExport,
} from "@/lib/contributor-download-pdf"

interface DownloadPdfButtonProps {
  sort: "top" | "recent"
  from?: string
  to?: string
  summary: {
    downloadsToday: number
    downloadsThisMonth: number
    downloadsAllTime: number
  } | null
}

export function DownloadPdfButton({
  sort,
  from,
  to,
  summary,
}: DownloadPdfButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading">("idle")

  async function handleClick() {
    setStatus("loading")
    try {
      const downloads = await fetchAllDownloadsForExport(
        (params) =>
          getContributorDownloads(params).then((res) => ({
            ok: true as const,
            downloads: res.downloads,
            pagination: res.pagination,
          })),
        sort,
        from,
        to,
      )

      const doc = generateDownloadReportPdf(downloads, {
        contributorName: "Contributor",
        generatedAt: new Date().toLocaleDateString("en-IN", {
          dateStyle: "medium",
        }),
        dateFrom: from,
        dateTo: to,
        summary: summary ?? {
          downloadsToday: 0,
          downloadsThisMonth: 0,
          downloadsAllTime: 0,
        },
      })

      const filename = `fotocorp-download-report-${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(filename)
    } catch {
      // Silently fail — user can try again
    } finally {
      setStatus("idle")
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={status === "loading"}
      onClick={handleClick}
    >
      {status === "loading" ? (
        <>
          <Loader2 className="mr-1.5 animate-spin" size={16} />
          Generating…
        </>
      ) : (
        <>
          <FileDown className="mr-1.5" size={16} />
          Download PDF Report
        </>
      )}
    </Button>
  )
}
