export interface ContributorAccountSummary {
  id: string
  username: string
  status: "ACTIVE" | "DISABLED" | "LOCKED" | string
  mustChangePassword: boolean
}

export interface ContributorSummary {
  id: string
  legacyPhotographerId: number | null
  displayName: string
  email: string | null
  status: string
}

export interface ContributorAuthResponse {
  ok: true
  account: ContributorAccountSummary
  contributor: ContributorSummary
}

export interface ContributorImageItem {
  id: string
  contributorId: string
  legacyImageCode: string | null
  title: string | null
  headline: string | null
  caption: string | null
  status: string
  visibility: string
  createdAt: string
  event: {
    name: string | null
    date: string | null
    location: string | null
  }
  derivatives: {
    thumb: boolean
    card: boolean
    detail: boolean
  }
}

export interface ContributorImagesResponse {
  ok: true
  items: ContributorImageItem[]
  nextCursor: string | null
}

export interface ContributorAnalyticsSummary {
  totalUploads: number
  uploadsThisWeek: number
  uploadsThisMonth: number
  submissionsThisWeek: number
  submissionsThisMonth: number
  submittedImages: number
  approvedImages: number
  downloadsToday: number
  downloadsThisMonth: number
  downloadsAllTime: number
}

export interface ContributorTopDownloadedImage {
  imageAssetId: string
  legacyImageCode: string | null
  title: string | null
  headline: string | null
  eventName: string | null
  downloadCount: number
  cardPreviewAvailable: boolean
}

export interface ContributorRecentUpload {
  imageAssetId: string
  legacyImageCode: string | null
  title: string | null
  headline: string | null
  eventName: string | null
  status: string
  visibility: string
  createdAt: string
}

export interface ContributorAnalyticsSummaryResponse {
  ok: true
  summary: ContributorAnalyticsSummary
  topDownloadedImages: ContributorTopDownloadedImage[]
  recentUploads: ContributorRecentUpload[]
}

export interface ContributorEventDto {
  id: string
  name: string
  eventDate: string | null
  eventTime: string | null
  country: string | null
  stateRegion: string | null
  city: string | null
  location: string | null
  keywords: string | null
  description: string | null
  status: string
  createdBySource: string
  canEdit: boolean
  createdAt: string
  updatedAt: string
}

export interface ContributorEventsListResponse {
  ok: true
  events: ContributorEventDto[]
  pagination: { limit: number; offset: number; total: number }
}

export interface ContributorEventDetailResponse {
  ok: true
  event: ContributorEventDto
}

export interface ContributorEventCreatePayload {
  name: string
  eventDate?: string
  eventTime?: string
  country?: string
  stateRegion?: string
  city?: string
  location?: string
  keywords?: string | string[]
  description?: string
}

export type ContributorEventPatchPayload = Partial<ContributorEventCreatePayload>

export interface ContributorUploadBatchDto {
  id: string
  eventId: string
  status: string
  assetType: string
  commonTitle: string | null
  commonCaption: string | null
  commonKeywords: string | null
  totalFiles: number
  uploadedFiles: number
  failedFiles: number
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ContributorUploadBatchesListResponse {
  ok: true
  batches: ContributorUploadBatchDto[]
  pagination: { limit: number; offset: number; total: number }
}

export interface ContributorUploadBatchDetailResponse {
  ok: true
  batch: ContributorUploadBatchDto
  event: {
    id: string
    name: string
    status: string
    eventDate: string | null
    city: string | null
    location: string | null
  }
  items: ContributorUploadBatchItemDto[]
}

export interface ContributorUploadBatchItemDto {
  id: string
  fileName: string
  uploadStatus: string
  mimeType: string | null
  sizeBytes: number | null
  imageAssetId: string | null
  imageAssetStatus: string | null
  imageAssetVisibility: string | null
  failureCode: string | null
  failureMessage: string | null
  uploadedAt: string | null
  finalizedAt: string | null
  createdAt: string
}

export interface ContributorUploadBatchCreatePayload {
  eventId: string
  assetType: "IMAGE" | "VIDEO" | "CARICATURE"
  commonTitle?: string
  commonCaption?: string
  commonKeywords?: string
}

export interface ContributorPrepareUploadFileMeta {
  fileName: string
  mimeType: "image/jpeg" | "image/png" | "image/webp"
  sizeBytes: number
}

export interface ContributorPrepareUploadItemInstruction {
  itemId: string
  fileName: string
  uploadMethod: "SIGNED_PUT" | "NOT_CONFIGURED"
  uploadUrl: string | null
  headers: { "content-type": string }
}

export interface ContributorPrepareUploadFilesResponse {
  ok: true
  items: ContributorPrepareUploadItemInstruction[]
}

export interface ContributorCompleteUploadResponse {
  ok: true
  itemId: string
  imageAssetId?: string
  uploadStatus: string
  idempotent?: boolean
}

export interface ContributorSubmitUploadBatchResponse {
  ok: true
  batch: ContributorUploadBatchDto
  idempotent?: boolean
}

export interface ContributorRequestOptions {
  cookieHeader?: string
}

export class ContributorApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ContributorApiError"
  }
}

export async function loginContributor(username: string, password: string) {
  return contributorJson<ContributorAuthResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  })
}

export async function logoutContributor() {
  return contributorJson<{ ok: true }>("/auth/logout", { method: "POST" })
}

export async function getContributorMe(options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorAuthResponse>("/auth/me", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function changeContributorPassword(currentPassword: string, newPassword: string) {
  return contributorJson<ContributorAuthResponse>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  })
}

export async function getContributorImages(
  params: { limit?: number; cursor?: string } = {},
  options: ContributorRequestOptions = {},
) {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.cursor) search.set("cursor", params.cursor)
  const query = search.toString()
  return contributorJson<ContributorImagesResponse>(`/images${query ? `?${query}` : ""}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getContributorAnalyticsSummary(options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorAnalyticsSummaryResponse>("/analytics/summary", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getContributorEvents(
  params: { scope?: "mine" | "available"; q?: string; limit?: number; offset?: number } = {},
  options: ContributorRequestOptions = {},
) {
  const search = new URLSearchParams()
  if (params.scope) search.set("scope", params.scope)
  if (params.q) search.set("q", params.q)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  const query = search.toString()
  return contributorJson<ContributorEventsListResponse>(`/events${query ? `?${query}` : ""}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getContributorEvent(eventId: string, options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorEventDetailResponse>(`/events/${encodeURIComponent(eventId)}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function createContributorEvent(payload: ContributorEventCreatePayload, options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorEventDetailResponse>("/events", {
    method: "POST",
    body: payload,
    cookieHeader: options.cookieHeader,
  })
}

export async function updateContributorEvent(
  eventId: string,
  payload: ContributorEventPatchPayload,
  options: ContributorRequestOptions = {},
) {
  return contributorJson<ContributorEventDetailResponse>(`/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: payload,
    cookieHeader: options.cookieHeader,
  })
}

export async function getContributorUploadBatches(
  params: {
    status?: "OPEN" | "SUBMITTED" | "COMPLETED" | "FAILED" | "CANCELLED"
    eventId?: string
    limit?: number
    offset?: number
  } = {},
  options: ContributorRequestOptions = {},
) {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (params.eventId) search.set("eventId", params.eventId)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  const query = search.toString()
  return contributorJson<ContributorUploadBatchesListResponse>(`/upload-batches${query ? `?${query}` : ""}`, {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getContributorUploadBatch(batchId: string, options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorUploadBatchDetailResponse>(
    `/upload-batches/${encodeURIComponent(batchId)}`,
    {
      method: "GET",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function createContributorUploadBatch(
  payload: ContributorUploadBatchCreatePayload,
  options: ContributorRequestOptions = {},
) {
  return contributorJson<{ ok: true; batch: ContributorUploadBatchDto }>("/upload-batches", {
    method: "POST",
    body: payload,
    cookieHeader: options.cookieHeader,
  })
}

export async function prepareContributorUploadFiles(
  batchId: string,
  files: ContributorPrepareUploadFileMeta[],
  options: ContributorRequestOptions = {},
) {
  return contributorJson<ContributorPrepareUploadFilesResponse>(
    `/upload-batches/${encodeURIComponent(batchId)}/files`,
    {
      method: "POST",
      body: { files },
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function completeContributorUploadFile(
  batchId: string,
  itemId: string,
  options: ContributorRequestOptions = {},
) {
  return contributorJson<ContributorCompleteUploadResponse>(
    `/upload-batches/${encodeURIComponent(batchId)}/files/${encodeURIComponent(itemId)}/complete`,
    {
      method: "POST",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function submitContributorUploadBatch(batchId: string, options: ContributorRequestOptions = {}) {
  return contributorJson<ContributorSubmitUploadBatchResponse>(
    `/upload-batches/${encodeURIComponent(batchId)}/submit`,
    {
      method: "POST",
      cookieHeader: options.cookieHeader,
    },
  )
}

/** Direct browser PUT to R2 — not proxied; uses short-lived signed URL from prepare only. */
export async function putContributorFileToSignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType: string,
): Promise<Response> {
  return fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  })
}

async function contributorJson<T>(
  path: string,
  input: {
    method: "GET" | "POST" | "PATCH"
    body?: unknown
    cookieHeader?: string
  },
): Promise<T> {
  const response = await fetch(resolveContributorUrl(path), {
    method: input.method,
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(input.body ? { "Content-Type": "application/json" } : {}),
      ...(input.cookieHeader ? { Cookie: input.cookieHeader } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  })

  if (!response.ok) {
    const error = await readContributorApiError(response)
    throw new ContributorApiError(response.status, error.code, error.message)
  }

  return response.json() as Promise<T>
}

function resolveContributorUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (typeof window !== "undefined") return `/api/contributor${normalized}`

  const base = process.env.INTERNAL_API_BASE_URL?.trim().replace(/\/+$/, "")
  if (!base) throw new ContributorApiError(500, "CONTRIBUTOR_API_NOT_CONFIGURED", "Contributor API is not configured.")
  return `${base}/api/v1/contributor${normalized}`
}

async function readContributorApiError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string }
      meta?: unknown
    }
    return {
      code: body.error?.code ?? "CONTRIBUTOR_API_ERROR",
      message: body.error?.message ?? "Contributor request failed.",
    }
  } catch {
    return {
      code: "CONTRIBUTOR_API_ERROR",
      message: "Contributor request failed.",
    }
  }
}
