import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { ContributorDownloadRow } from "@/lib/api/contributor-api"

export interface DownloadReportMeta {
  contributorName: string
  generatedAt: string
  dateFrom?: string
  dateTo?: string
  summary: {
    downloadsToday: number
    downloadsThisMonth: number
    downloadsAllTime: number
  }
}

export function generateDownloadReportPdf(
  downloads: ContributorDownloadRow[],
  meta: DownloadReportMeta,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── Header ──────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text("fotocorp", margin, 18)
  doc.setFontSize(10)
  doc.setTextColor(140, 140, 140)
  doc.text("Download Report", margin, 25)

  // ── Meta block ──────────────────────────────────────────
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  const metaLines = [
    `Contributor: ${meta.contributorName}`,
    `Generated: ${meta.generatedAt}`,
    meta.dateFrom || meta.dateTo
      ? `Period: ${meta.dateFrom ?? "…"} — ${meta.dateTo ?? "…"}`
      : null,
  ].filter(Boolean) as string[]

  let y = 36
  for (const line of metaLines) {
    doc.text(line, margin, y)
    y += 5
  }

  // ── Summary boxes ───────────────────────────────────────
  y += 3
  const summaryItems = [
    { label: "Today", value: meta.summary.downloadsToday },
    { label: "This Month", value: meta.summary.downloadsThisMonth },
    { label: "All Time", value: meta.summary.downloadsAllTime },
  ]
  const boxWidth = (pageWidth - margin * 2 - 12) / 3

  summaryItems.forEach((item, i) => {
    const x = margin + i * (boxWidth + 6)
    doc.setFillColor(248, 248, 248)
    doc.setDrawColor(220, 220, 220)
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, "FD")
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(item.label, x + 3, y + 7)
    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text(String(item.value), x + 3, y + 15)
  })

  y += 26

  // ── Table ───────────────────────────────────────────────
  const rows = downloads.map((d) => [
    d.whoIsInPicture || d.headline || d.legacyImageCode || "Untitled",
    d.legacyImageCode ?? "—",
    d.eventName ?? "—",
    String(d.downloadCount),
    d.lastDownloadedAt
      ? new Date(d.lastDownloadedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Image", "Fotokey", "Event", "Downloads", "Last Downloaded"]],
    body: rows,
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 30, fontStyle: "normal" },
      2: { cellWidth: 30 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
    },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" },
      )
    },
  })

  return doc
}

/**
 * Fetch all downloads for PDF export (up to 500 rows).
 * Returns the flat list for handoff to PDF generation.
 */
export async function fetchAllDownloadsForExport(
  fetcher: (params: {
    limit: number
    offset: number
    sort?: "top" | "recent"
    from?: string
    to?: string
  }) => Promise<{
    ok: true
    downloads: ContributorDownloadRow[]
    pagination: { total: number }
  }>,
  sort: "top" | "recent",
  from?: string,
  to?: string,
): Promise<ContributorDownloadRow[]> {
  const MAX = 500
  const first = await fetcher({ limit: MAX, offset: 0, sort, from, to })
  return first.downloads
}
