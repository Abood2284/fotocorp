import Link from "next/link"
import { revalidatePath } from "next/cache"
import { notFound } from "next/navigation"
import { AlertTriangle, ChevronLeft } from "lucide-react"
import {
  getAdminAsset,
  getAdminAssetFilters,
  updateAdminAssetEditorial,
  updateAdminAssetState,
} from "@/lib/api/admin-assets-api"
import { PreviewImage } from "@/components/assets/preview-image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

interface AdminAssetDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ previewVariant?: string }>
}

export const metadata = {
  title: "Admin Asset Detail — Fotocorp",
}

export default async function AdminAssetDetailPage({ params, searchParams }: AdminAssetDetailPageProps) {
  const { id } = await params
  const sp = await searchParams
  const [response, filters] = await Promise.all([
    getAdminAsset(id).catch(() => undefined),
    getAdminAssetFilters().catch(() => null),
  ])

  if (response === undefined) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load asset detail"
        description="Internal admin assets service is unavailable."
      />
    )
  }

  if (response === null || !response.asset) notFound()
  if (!filters) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load filters"
        description="Internal admin assets service is unavailable."
      />
    )
  }

  const asset = response.asset
  const availablePreviewVariants = (asset.readyPreviewVariants ?? []).filter((variant) => variant === "thumb" || variant === "card" || variant === "detail")
  const defaultPreviewVariant =
    availablePreviewVariants.includes("card")
      ? "card"
      : availablePreviewVariants.includes("detail")
        ? "detail"
        : availablePreviewVariants.includes("thumb")
          ? "thumb"
          : null
  const selectedPreviewVariant = (sp.previewVariant === "thumb" || sp.previewVariant === "card" || sp.previewVariant === "detail")
    && availablePreviewVariants.includes(sp.previewVariant)
    ? sp.previewVariant
    : defaultPreviewVariant
  const publishEligible = asset.r2Exists
    && asset.derivatives.thumb.state === "READY"
    && asset.derivatives.card.state === "READY"
    && asset.derivatives.detail.state === "READY"

  async function saveEditorial(formData: FormData) {
    "use server"
    await updateAdminAssetEditorial(id, {
      headline: normalizeNullableText(formData.get("headline")),
      caption: normalizeNullableText(formData.get("caption")),
      description: normalizeNullableText(formData.get("description")),
      keywords: normalizeKeywords(formData.get("keywords")),
      categoryId: normalizeNullableText(formData.get("categoryId")),
      eventId: normalizeNullableText(formData.get("eventId")),
      contributorId: normalizeNullableText(formData.get("contributorId")),
    })
    revalidatePath(`/staff/assets/${id}`)
  }

  async function savePublish(formData: FormData) {
    "use server"
    const next = intentToPublishState(String(formData.get("intent") ?? ""))
    if (!next) return
    await updateAdminAssetState(id, next)
    revalidatePath(`/staff/assets/${id}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/staff/assets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to assets
        </Link>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Asset: {asset.legacyImageCode ?? asset.id}</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Watermarked previews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["thumb", "card", "detail"] as const).map((variant) => {
                  const ready = availablePreviewVariants.includes(variant)
                  const active = selectedPreviewVariant === variant
                  const href = `/staff/assets/${asset.id}?previewVariant=${variant}`
                  return (
                    <Link
                      key={variant}
                      href={href}
                      className={`rounded border px-2 py-1 text-xs ${active ? "border-primary text-primary" : "border-border text-muted-foreground"} ${ready ? "" : "opacity-60"}`}
                    >
                      {variant.toUpperCase()} {ready ? "READY" : "MISSING"}
                    </Link>
                  )
                })}
              </div>
              {selectedPreviewVariant ? (
                <div className="overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={`/staff/assets/${asset.id}/preview-image?variant=${selectedPreviewVariant}`}
                    alt={`${selectedPreviewVariant} preview ${asset.legacyImageCode ?? asset.id}`}
                    className="max-h-[72vh] w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">Preview unavailable.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Original availability</span>
                <span className="font-medium">{asset.r2Exists ? "Available" : "Not available"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Asset code</span>
                <span className="font-mono text-xs">{asset.legacyImageCode ?? asset.id}</span>
              </div>
              {asset.r2Exists ? (
                <div className="overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={`/staff/assets/${asset.id}/original-image`}
                    alt={`Original ${asset.legacyImageCode ?? asset.id}`}
                    className="max-h-[72vh] w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                  Original not available
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                If this image fails to load, check R2 availability or admin permissions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Asset id" value={asset.id} mono />
              <Field label="Fotokey" value={asset.legacyImageCode ?? "—"} mono />
              <Field label="Status" value={asset.status} />
              <Field label="Visibility" value={asset.visibility} />
              <Field label="Category" value={asset.category?.name ?? "—"} />
              <Field label="Event" value={asset.event?.name ?? "—"} />
              <Field label="Photographer" value={asset.contributor?.displayName ?? "—"} />
              <Field label="Updated" value={toDate(asset.updatedAt ?? asset.createdAt)} />
              <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Headline</p><p className="mt-1 text-sm font-medium">{asset.headline ?? "—"}</p></div>
              <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Caption</p><p className="mt-1 text-sm font-medium">{asset.caption ?? "—"}</p></div>
              <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1 text-sm font-medium">{asset.description ?? "—"}</p></div>
              <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Keywords</p><p className="mt-1 text-sm font-medium">{asset.keywords ?? "—"}</p></div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Publishing</CardTitle></CardHeader>
            <CardContent>
              <form action={savePublish} className="space-y-3">
                <input type="hidden" name="intent" value="noop" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="submit" name="intent" value="set-private" className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Set Private</button>
                  <button type="submit" name="intent" value="pending-review" className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Mark Pending Review</button>
                  <button type="submit" name="intent" value="reject" className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Reject</button>
                  <button type="submit" name="intent" value="publish-public" disabled={!publishEligible} className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">Publish Public</button>
                </div>
                {!publishEligible ? <p className="text-xs text-amber-700">Publish Public is disabled until thumb/card/detail derivatives are READY.</p> : null}
              </form>
              <div className="mt-3 rounded border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>`APPROVED` is editorial approval status.</p>
                <p>`PUBLIC` visibility + thumb/card/detail READY means eligible for public catalog.</p>
                <p>`PRIVATE` visibility keeps the asset out of public catalog even when approved.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Editorial details</CardTitle></CardHeader>
            <CardContent>
              <form action={saveEditorial} className="space-y-3">
                <TextField name="headline" label="Headline" defaultValue={asset.headline ?? ""} />
                <TextAreaField name="caption" label="Caption" defaultValue={asset.caption ?? ""} rows={5} />
                <TextAreaField name="description" label="Description" defaultValue={asset.description ?? ""} rows={4} />
                <TextAreaField name="keywords" label="Keywords (comma separated)" defaultValue={asset.keywords ?? ""} rows={3} />
                <SelectOptionsField label="Category" name="categoryId" defaultValue={asset.category?.id ?? ""} options={filters.categories.map((item) => ({ value: item.id, label: item.name }))} />
                <SelectOptionsField label="Event" name="eventId" defaultValue={asset.event?.id ?? ""} options={filters.events.map((item) => ({ value: item.id, label: item.name ?? "Untitled event" }))} />
                <SelectOptionsField label="Photographer" name="contributorId" defaultValue={asset.contributor?.id ?? ""} options={filters.contributors.map((item) => ({ value: item.id, label: item.displayName }))} />
                <button type="submit" className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Save editorial metadata</button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Derivative status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <VariantState name="thumb" state={asset.derivatives.thumb.state} />
              <VariantState name="card" state={asset.derivatives.card.state} />
              <VariantState name="detail" state={asset.derivatives.detail.state} />
              <div className="pt-2 text-xs text-muted-foreground">
                {asset.r2Exists ? "R2: verified" : "R2: missing"}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p></div>
}

function VariantState({ name, state }: { name: string; state: "READY" | "FAILED" | "PROCESSING" | "MISSING" }) {
  const badge = state === "READY"
    ? <Badge variant="success">{state}</Badge>
    : state === "FAILED"
      ? <Badge variant="destructive">{state}</Badge>
      : state === "PROCESSING"
        ? <Badge variant="warning">{state}</Badge>
        : <Badge variant="muted">{state}</Badge>
  return <div className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5"><span className="text-xs font-medium uppercase tracking-wide">{name}</span>{badge}</div>
}

function TextField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return <label className="block space-y-1.5"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><input name={name} defaultValue={defaultValue} className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm" /></label>
}

function TextAreaField({ name, label, defaultValue, rows }: { name: string; label: string; defaultValue: string; rows: number }) {
  return <label className="block space-y-1.5"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><textarea name={name} defaultValue={defaultValue} rows={rows} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm" /></label>
}

function SelectOptionsField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string
  name: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <select name={name} defaultValue={defaultValue} className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm">
        <option value="">— none —</option>
        {options.map((option) => <option key={`${name}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function toDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN")
}

function normalizeNullableText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeKeywords(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  const dedup = new Map<string, string>()
  for (const part of value.split(",")) {
    const normalized = part.trim()
    if (!normalized) continue
    const token = normalized.toLowerCase()
    if (!dedup.has(token)) {
      dedup.set(token, normalized)
      if (dedup.size >= 50) break
    }
  }
  return dedup.size > 0 ? [...dedup.values()] : null
}

function intentToPublishState(intent: string):
  | { status: "APPROVED" | "REVIEW" | "REJECTED"; visibility: "PRIVATE" | "PUBLIC" }
  | null {
  if (intent === "set-private") return { status: "REVIEW", visibility: "PRIVATE" }
  if (intent === "pending-review") return { status: "REVIEW", visibility: "PRIVATE" }
  if (intent === "reject") return { status: "REJECTED", visibility: "PRIVATE" }
  if (intent === "publish-public") return { status: "APPROVED", visibility: "PUBLIC" }
  return null
}
