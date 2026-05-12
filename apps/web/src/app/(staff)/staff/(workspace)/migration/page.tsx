import Link from "next/link"
import { AlertTriangle, CheckCircle2, Database, Files, RefreshCw, SearchX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPgPool } from "@/lib/db"

export const metadata = {
  title: "Migration",
}

interface MigrationPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminMigrationPage({ searchParams }: MigrationPageProps) {
  const params = await searchParams
  const filters = parseFilters(params ?? {})
  const data = await getMigrationDashboardData(filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Legacy migration</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Read-only reconciliation view for legacy Fotocorp records and Cloudflare R2 object matching.
          </p>
        </div>
        <Link
          href="/staff/migration"
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          Clear filters
        </Link>
      </div>

      {!data.ready ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Migration tables are not available yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply the legacy foundation migration before using this dashboard. No placeholder data is shown.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <FilterPanel filters={filters} issueTypes={data.issueTypes} severities={data.severities} assetStatuses={data.assetStatuses} />
          <SummaryCards summary={data.summary} />
          <BatchesTable batches={data.batches} />
          <IssuesTable issues={data.issues} />
        </>
      )}
    </div>
  )
}

function FilterPanel({ filters, issueTypes, severities, assetStatuses }: FilterPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-5">
          <SelectFilter label="Issue type" name="issue_type" value={filters.issueType} options={issueTypes} />
          <SelectFilter label="Severity" name="severity" value={filters.severity} options={severities} />
          <SelectFilter label="R2 exists" name="r2_exists" value={filters.r2Exists} options={["true", "false"]} />
          <SelectFilter label="Asset status" name="status" value={filters.status} options={assetStatuses} />
          <div className="flex items-end">
            <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">
              Apply
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SelectFilter({ label, name, value, options }: SelectFilterProps) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryCards({ summary }: { summary: MigrationSummary }) {
  const cards = [
    { label: "Total assets imported", value: summary.totalAssetsImported, icon: Files },
    { label: "R2 matched", value: summary.r2Matched, icon: CheckCircle2 },
    { label: "R2 missing", value: summary.r2Missing, icon: SearchX },
    { label: "Public approved assets", value: summary.publicApprovedAssets, icon: Database },
    { label: "Duplicate imagecode issues", value: summary.duplicateImagecodeIssues, icon: AlertTriangle },
    { label: "Missing event issues", value: summary.missingEventIssues, icon: AlertTriangle },
    { label: "Missing photographer issues", value: summary.missingPhotographerIssues, icon: AlertTriangle },
    { label: "Latest import batch status", value: summary.latestBatchStatus ?? "No batches", icon: RefreshCw },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{typeof value === "number" ? formatNumber(value) : value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BatchesTable({ batches }: { batches: ImportBatchRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Latest import batches</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["source_name", "source_table", "started_at", "finished_at", "total_rows", "inserted_rows", "updated_rows", "r2_matched_rows", "r2_missing_rows", "duplicate_imagecode_rows", "failed_rows", "status"].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3">{batch.sourceName}</td>
                    <td className="px-4 py-3">{batch.sourceTable}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(batch.startedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(batch.finishedAt)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.totalRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.insertedRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.updatedRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.r2MatchedRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.r2MissingRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.duplicateImagecodeRows)}</td>
                    <td className="px-4 py-3">{formatNumber(batch.failedRows)}</td>
                    <td className="px-4 py-3"><Badge>{batch.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No import batches have been recorded yet.</EmptyState>
        )}
      </CardContent>
    </Card>
  )
}

function IssuesTable({ issues }: { issues: ImportIssueRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import issues</CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["issue_type", "severity", "legacy_srno", "legacy_imagecode", "message", "created_at"].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td className="px-4 py-3"><Badge>{issue.issueType}</Badge></td>
                    <td className="px-4 py-3">{issue.severity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{issue.legacySrno ?? "-"}</td>
                    <td className="px-4 py-3 font-medium">{issue.legacyImagecode ?? "-"}</td>
                    <td className="px-4 py-3">{issue.message}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(issue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No import issues match the current filters.</EmptyState>
        )}
      </CardContent>
    </Card>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-border px-2 py-1 text-xs font-medium">{children}</span>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">{children}</div>
}

async function getMigrationDashboardData(filters: MigrationFilters): Promise<MigrationDashboardData> {
  const pool = getPgPool()

  try {
    const [summaryResult, batchesResult, issuesResult, filterOptionsResult] = await Promise.all([
      pool.query<SummaryQueryRow>(buildSummaryQuery(filters)),
      pool.query<BatchQueryRow>(`
        select
          id,
          source_name,
          source_table,
          started_at,
          finished_at,
          total_rows,
          inserted_rows,
          updated_rows,
          r2_matched_rows,
          r2_missing_rows,
          duplicate_imagecode_rows,
          failed_rows,
          status
        from asset_import_batches
        order by started_at desc
        limit 10
      `),
      pool.query<IssueQueryRow>(buildIssuesQuery(filters)),
      pool.query<FilterOptionsQueryRow>(`
        select
          coalesce(array_agg(distinct issue_type) filter (where issue_type is not null), '{}') as issue_types,
          coalesce(array_agg(distinct severity) filter (where severity is not null), '{}') as severities,
          coalesce((select array_agg(distinct status) from assets), '{}') as asset_statuses
        from asset_import_issues
      `),
    ])

    const filterOptions = filterOptionsResult.rows[0]

    return {
      ready: true,
      summary: mapSummary(summaryResult.rows[0]),
      batches: batchesResult.rows.map(mapBatch),
      issues: issuesResult.rows.map(mapIssue),
      issueTypes: filterOptions?.issue_types ?? [],
      severities: filterOptions?.severities ?? [],
      assetStatuses: filterOptions?.asset_statuses ?? [],
    }
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        ready: false,
        summary: emptySummary(),
        batches: [],
        issues: [],
        issueTypes: [],
        severities: [],
        assetStatuses: [],
      }
    }

    throw error
  }
}

function buildSummaryQuery(filters: MigrationFilters) {
  const assetWhere = buildAssetWhere(filters)

  return `
    select
      (select count(*) from assets ${assetWhere})::bigint as total_assets_imported,
      (select count(*) from assets ${appendWhere(assetWhere, "r2_exists = true")})::bigint as r2_matched,
      (select count(*) from assets ${appendWhere(assetWhere, "r2_exists = false")})::bigint as r2_missing,
      (select count(*) from assets ${appendWhere(assetWhere, "status = 'APPROVED' and visibility = 'PUBLIC'")})::bigint as public_approved_assets,
      (select count(*) from asset_import_issues where issue_type = 'DUPLICATE_IMAGECODE')::bigint as duplicate_imagecode_issues,
      (select count(*) from asset_import_issues where issue_type = 'MISSING_EVENT')::bigint as missing_event_issues,
      (select count(*) from asset_import_issues where issue_type = 'MISSING_PHOTOGRAPHER')::bigint as missing_photographer_issues,
      (select status from asset_import_batches order by started_at desc limit 1) as latest_batch_status
  `
}

function buildIssuesQuery(filters: MigrationFilters) {
  const where: string[] = []
  if (filters.issueType) where.push(`issue_type = '${escapeSqlLiteral(filters.issueType)}'`)
  if (filters.severity) where.push(`severity = '${escapeSqlLiteral(filters.severity)}'`)

  return `
    select
      id,
      issue_type,
      severity,
      legacy_srno,
      legacy_imagecode,
      message,
      created_at
    from asset_import_issues
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by created_at desc
    limit 100
  `
}

function buildAssetWhere(filters: MigrationFilters) {
  const where: string[] = []
  if (filters.r2Exists === "true") where.push("r2_exists = true")
  if (filters.r2Exists === "false") where.push("r2_exists = false")
  if (filters.status) where.push(`status = '${escapeSqlLiteral(filters.status)}'`)

  return where.length ? `where ${where.join(" and ")}` : ""
}

function appendWhere(existingWhere: string, condition: string) {
  return existingWhere ? `${existingWhere} and ${condition}` : `where ${condition}`
}

function parseFilters(params: Record<string, string | string[] | undefined>): MigrationFilters {
  return {
    issueType: firstParam(params.issue_type),
    severity: firstParam(params.severity),
    r2Exists: parseR2Exists(firstParam(params.r2_exists)),
    status: firstParam(params.status),
  }
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ""
  return value || ""
}

function parseR2Exists(value: string) {
  if (value === "true" || value === "false") return value
  return ""
}

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''")
}

function mapSummary(row?: SummaryQueryRow): MigrationSummary {
  if (!row) return emptySummary()

  return {
    totalAssetsImported: Number(row.total_assets_imported ?? 0),
    r2Matched: Number(row.r2_matched ?? 0),
    r2Missing: Number(row.r2_missing ?? 0),
    publicApprovedAssets: Number(row.public_approved_assets ?? 0),
    duplicateImagecodeIssues: Number(row.duplicate_imagecode_issues ?? 0),
    missingEventIssues: Number(row.missing_event_issues ?? 0),
    missingPhotographerIssues: Number(row.missing_photographer_issues ?? 0),
    latestBatchStatus: row.latest_batch_status,
  }
}

function emptySummary(): MigrationSummary {
  return {
    totalAssetsImported: 0,
    r2Matched: 0,
    r2Missing: 0,
    publicApprovedAssets: 0,
    duplicateImagecodeIssues: 0,
    missingEventIssues: 0,
    missingPhotographerIssues: 0,
    latestBatchStatus: null,
  }
}

function mapBatch(row: BatchQueryRow): ImportBatchRow {
  return {
    id: row.id,
    sourceName: row.source_name,
    sourceTable: row.source_table,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    totalRows: Number(row.total_rows),
    insertedRows: Number(row.inserted_rows),
    updatedRows: Number(row.updated_rows),
    r2MatchedRows: Number(row.r2_matched_rows),
    r2MissingRows: Number(row.r2_missing_rows),
    duplicateImagecodeRows: Number(row.duplicate_imagecode_rows),
    failedRows: Number(row.failed_rows),
    status: row.status,
  }
}

function mapIssue(row: IssueQueryRow): ImportIssueRow {
  return {
    id: row.id,
    issueType: row.issue_type,
    severity: row.severity,
    legacySrno: row.legacy_srno === null ? null : Number(row.legacy_srno),
    legacyImagecode: row.legacy_imagecode,
    message: row.message,
    createdAt: row.created_at,
  }
}

function isUndefinedTableError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value)
}

function formatDate(value: Date | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

interface MigrationFilters {
  issueType: string
  severity: string
  r2Exists: "" | "true" | "false"
  status: string
}

interface FilterPanelProps {
  filters: MigrationFilters
  issueTypes: string[]
  severities: string[]
  assetStatuses: string[]
}

interface SelectFilterProps {
  label: string
  name: string
  value: string
  options: string[]
}

type MigrationDashboardData =
  | {
      ready: true
      summary: MigrationSummary
      batches: ImportBatchRow[]
      issues: ImportIssueRow[]
      issueTypes: string[]
      severities: string[]
      assetStatuses: string[]
    }
  | {
      ready: false
      summary: MigrationSummary
      batches: []
      issues: []
      issueTypes: []
      severities: []
      assetStatuses: []
    }

interface MigrationSummary {
  totalAssetsImported: number
  r2Matched: number
  r2Missing: number
  publicApprovedAssets: number
  duplicateImagecodeIssues: number
  missingEventIssues: number
  missingPhotographerIssues: number
  latestBatchStatus: string | null
}

interface ImportBatchRow {
  id: string
  sourceName: string
  sourceTable: string
  startedAt: Date
  finishedAt: Date | null
  totalRows: number
  insertedRows: number
  updatedRows: number
  r2MatchedRows: number
  r2MissingRows: number
  duplicateImagecodeRows: number
  failedRows: number
  status: string
}

interface ImportIssueRow {
  id: string
  issueType: string
  severity: string
  legacySrno: number | null
  legacyImagecode: string | null
  message: string
  createdAt: Date
}

interface SummaryQueryRow {
  total_assets_imported: string
  r2_matched: string
  r2_missing: string
  public_approved_assets: string
  duplicate_imagecode_issues: string
  missing_event_issues: string
  missing_photographer_issues: string
  latest_batch_status: string | null
}

interface BatchQueryRow {
  id: string
  source_name: string
  source_table: string
  started_at: Date
  finished_at: Date | null
  total_rows: string
  inserted_rows: string
  updated_rows: string
  r2_matched_rows: string
  r2_missing_rows: string
  duplicate_imagecode_rows: string
  failed_rows: string
  status: string
}

interface IssueQueryRow {
  id: string
  issue_type: string
  severity: string
  legacy_srno: string | null
  legacy_imagecode: string | null
  message: string
  created_at: Date
}

interface FilterOptionsQueryRow {
  issue_types: string[]
  severities: string[]
  asset_statuses: string[]
}
