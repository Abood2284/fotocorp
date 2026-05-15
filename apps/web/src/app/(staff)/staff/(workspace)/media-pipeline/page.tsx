import { AlertTriangle } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { getAdminMediaPipelineStatus } from "@/lib/api/admin-catalog-api"

export const metadata = {
  title: "Media Pipeline — Fotocorp",
}

export default async function StaffMediaPipelinePage() {
  const status = await getAdminMediaPipelineStatus().catch(() => null)

  if (!status) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load media pipeline status"
        description="Internal admin media pipeline status request failed."
      />
    )
  }

  const variantRows = Object.entries(status.derivativeByVariant)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Media pipeline status</h2>
        <p className="text-sm text-muted-foreground">
          Temporary operational view for production derivative migration tracking.
        </p>
        <p className="text-xs text-muted-foreground">
          Preview derivatives: thumb and card are clean (no tiled watermark); detail remains watermarked (
          {status.watermarkProfile}).
        </p>
        <p className="text-xs text-muted-foreground">
          Expected profiles — thumb: {status.derivativeProfiles.thumbProfile}, card:{" "}
          {status.derivativeProfiles.cardProfile}, detail: {status.derivativeProfiles.detailProfile}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total image assets" value={status.totalImageAssets} />
        <StatCard label="Assets with original key" value={status.assetsWithOriginalStorageKey} />
        <StatCard label="Assets with r2_exists=true" value={status.assetsWithR2ExistsTrue} />
        <StatCard label="Assets with r2_exists=false" value={status.assetsWithR2ExistsFalse} />
        <StatCard label="Assets with r2_exists=null" value={status.assetsWithR2ExistsNull} />
        <StatCard label="Missing original/R2 mapping" value={status.assetsMissingOriginalOrR2Mapping} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
        <StatCard label="Ready for public listing (strict gate)" value={status.assetsReadyForPublicListing} />
        <StatCard
          label="Currently visible in public API"
          value={status.assetsCurrentlyVisibleInPublicApi}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Import / Mapping status</h3>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>Total rows imported in clean table: <strong>{status.totalImageAssets.toLocaleString()}</strong></li>
          <li>Rows with `original_storage_key`: <strong>{status.assetsWithOriginalStorageKey.toLocaleString()}</strong></li>
          <li>Rows missing mapping: <strong>{status.assetsMissingOriginalOrR2Mapping.toLocaleString()}</strong></li>
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">R2 verification status</h3>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>`r2_exists=true`: <strong>{status.assetsWithR2ExistsTrue.toLocaleString()}</strong></li>
          <li>`r2_exists=false`: <strong>{status.assetsWithR2ExistsFalse.toLocaleString()}</strong></li>
          <li>`r2_exists=null`: <strong>{status.assetsWithR2ExistsNull.toLocaleString()}</strong></li>
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Derivative status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Variant</th>
                <th className="px-4 py-2 text-left">Ready</th>
                <th className="px-4 py-2 text-left">Failed</th>
                <th className="px-4 py-2 text-left">Missing</th>
              </tr>
            </thead>
            <tbody>
              {variantRows.map(([variant, counts]) => (
                <tr key={variant} className="border-t border-border">
                  <td className="px-4 py-2 font-medium uppercase">{variant}</td>
                  <td className="px-4 py-2">{counts.ready.toLocaleString()}</td>
                  <td className="px-4 py-2">{counts.failed.toLocaleString()}</td>
                  <td className="px-4 py-2">{counts.missing.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Latest failed derivative rows</h3>
        </div>
        {status.latestFailedDerivatives.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No failed derivative rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Asset</th>
                  <th className="px-4 py-2 text-left">Variant</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Profile</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                  <th className="px-4 py-2 text-left">Storage key</th>
                </tr>
              </thead>
              <tbody>
                {status.latestFailedDerivatives.map((row) => (
                  <tr key={`${row.assetId}:${row.variant}:${row.updatedAt ?? "none"}`} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{row.legacyImageCode ?? row.assetId}</td>
                    <td className="px-4 py-2 uppercase">{row.variant}</td>
                    <td className="px-4 py-2">{row.generationStatus}</td>
                    <td className="px-4 py-2">{row.watermarkProfile ?? "-"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{row.updatedAt ?? "-"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.storageKeyMasked ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Safe next commands</h3>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li><code>pnpm --dir apps/api media:pipeline-status</code></li>
          <li><code>pnpm --dir apps/api legacy:import -- --only assets --skip-r2-check --limit 10000 --batch-size 1000</code></li>
          <li><code>pnpm --dir apps/api media:verify-r2-originals -- --limit 10000 --batch-size 500 --concurrency 20</code></li>
          <li><code>pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --dry-run --limit 200</code></li>
          <li><code>pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --limit 200 --batch-size 50 --concurrency 4</code></li>
        </ul>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  )
}
