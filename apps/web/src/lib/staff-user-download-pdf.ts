import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { AdminUserDownloadItem } from "@/features/assets/admin-catalog-types"

export interface StaffUserDownloadReportMeta {
  userLabel: string
  userEmail: string
  generatedAt: string
  dateFrom?: string
  dateTo?: string
  totalDownloads: number
}

export function generateStaffUserDownloadReportPdf(
  downloads: AdminUserDownloadItem[],
  meta: StaffUserDownloadReportMeta,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text("fotocorp", margin, 18)
  doc.setFontSize(10)
  doc.setTextColor(140, 140, 140)
  doc.text("User Download Report", margin, 25)

  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  const metaLines = [
    `User: ${meta.userLabel}`,
    `Email: ${meta.userEmail}`,
    `Generated: ${meta.generatedAt}`,
    meta.dateFrom || meta.dateTo
      ? `Period: ${meta.dateFrom ?? "…"} — ${meta.dateTo ?? "…"}`
      : null,
    `Downloads in period: ${meta.totalDownloads.toLocaleString()}`,
  ].filter(Boolean) as string[]

  let y = 36
  for (const line of metaLines) {
    doc.text(line, margin, y)
    y += 5
  }

  y += 4

  const rows = downloads.map((item) => [
    item.whoIsInPicture || item.headline || item.caption || "Untitled",
    item.fotokey ?? "—",
    item.downloadSize ?? "—",
    item.downloadedAt
      ? new Date(item.downloadedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Image", "Fotokey", "Size", "Downloaded at"]],
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
      0: { cellWidth: 72 },
      1: { cellWidth: 34 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 38, halign: "right" },
    },
    didDrawPage: (data) => {
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

export async function fetchAllAdminUserDownloadsForExport(
  fetcher: (params: { limit: number; cursor?: string; from?: string; to?: string }) => Promise<{
    ok: true
    items: AdminUserDownloadItem[]
    nextCursor: string | null
  }>,
  from?: string,
  to?: string,
): Promise<AdminUserDownloadItem[]> {
  const MAX = 500
  const collected: AdminUserDownloadItem[] = []
  let cursor: string | undefined

  while (collected.length < MAX) {
    const page = await fetcher({
      limit: Math.min(100, MAX - collected.length),
      cursor,
      from,
      to,
    })
    collected.push(...page.items)
    if (!page.nextCursor || page.items.length === 0) break
    cursor = page.nextCursor
  }

  return collected
}
