/** Browser-safe fetch helpers for staff upload wizard BFF (`/api/staff/upload-wizard/*`). */

export class StaffWizardApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = "StaffWizardApiError"
  }
}

async function staffWizardJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")

  const res = await fetch(`/api/staff/upload-wizard${path}`, {
    ...init,
    credentials: "include",
    headers,
  })
  const body = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; detail?: unknown }; ok?: boolean }
    | null
  if (!res.ok) {
    const message = body?.error?.message ?? `Request failed (${res.status})`
    throw new StaffWizardApiError(res.status, body?.error?.code, message, body?.error?.detail)
  }
  return body as T
}

export interface StaffWizardContributorDto {
  id: string
  displayName: string
  email: string | null
}

export async function staffWizardListContributors(params: { q?: string; limit?: number } = {}) {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  const q = search.toString()
  return staffWizardJson<{ ok: true; contributors: StaffWizardContributorDto[] }>(
    `/contributors${q ? `?${q}` : ""}`,
    { method: "GET" },
  )
}

export interface StaffWizardCategoryDto {
  id: string
  name: string
}

export async function staffWizardListAssetCategories() {
  return staffWizardJson<{ ok: true; categories: StaffWizardCategoryDto[] }>("/asset-categories", { method: "GET" })
}

export async function staffWizardCreateEvent(body: {
  name: string
  categoryId: string
  eventDate: string
  targetContributorId: string
}) {
  return staffWizardJson<{
    ok: true
    event: {
      id: string
      name: string
      eventDate: string | null
      category: { id: string; name: string } | null
      createdAt: string
      updatedAt: string
    }
  }>("/events", { method: "POST", body: JSON.stringify(body) })
}

export async function staffWizardCreateUploadBatch(body: {
  eventId: string
  targetContributorId: string
  assetType?: "IMAGE" | "VIDEO" | "CARICATURE"
}) {
  return staffWizardJson<{ ok: true; batch: { id: string; eventId: string; status: string; assetType: string } }>(
    "/upload-batches",
    { method: "POST", body: JSON.stringify(body) },
  )
}

export interface StaffWizardPrepareFileMeta {
  fileName: string
  mimeType: "image/jpeg"
  sizeBytes: number
}

export interface StaffWizardPrepareItemInstruction {
  itemId: string
  uploadMethod: "SIGNED_PUT" | "NOT_CONFIGURED"
  uploadUrl: string | null
  expiresAt?: string | null
  headers: Record<string, string>
}

export async function staffWizardPrepareFiles(batchId: string, files: StaffWizardPrepareFileMeta[]) {
  return staffWizardJson<{ ok: true; items: StaffWizardPrepareItemInstruction[] }>(
    `/upload-batches/${encodeURIComponent(batchId)}/files`,
    { method: "POST", body: JSON.stringify({ files }) },
  )
}

export async function staffWizardCompleteFile(batchId: string, itemId: string) {
  return staffWizardJson<{
    ok: true
    itemId: string
    imageAssetId: string | null
    uploadStatus: string
    idempotent?: boolean
  }>(`/upload-batches/${encodeURIComponent(batchId)}/files/${encodeURIComponent(itemId)}/complete`, { method: "POST" })
}

export async function staffWizardSubmitBatch(batchId: string) {
  return staffWizardJson<{ ok: true; batch: { id: string; status: string } }>(
    `/upload-batches/${encodeURIComponent(batchId)}/submit`,
    { method: "POST" },
  )
}

export async function staffWizardPatchAssetMetadata(
  batchId: string,
  imageAssetId: string,
  payload: {
    expectedUpdatedAt?: string
    whoIsInPicture?: string | null
    caption?: string | null
    keywords?: string | string[] | null
  },
) {
  return staffWizardJson<{
    ok: true
    whoIsInPicture: string | null
    caption: string | null
    keywords: string | null
    updatedAt: string
  }>(`/upload-batches/${encodeURIComponent(batchId)}/assets/${encodeURIComponent(imageAssetId)}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}
