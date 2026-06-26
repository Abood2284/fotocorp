import { and, asc, eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { helpArticleMedia, helpArticles } from "../../db/schema/help-center"
import type { Env } from "../../appTypes"
import { AppError } from "../errors"
import { createHelpCenterPresignedPutUrl } from "../r2-presigned-put"
import {
  deleteHelpCenterObject,
  getHelpCenterObjectStream,
  headHelpCenterObject,
  HelpCenterObjectNotFoundError,
  listMissingHelpCenterS3ConfigKeys,
  verifyHelpCenterObjectExists,
} from "../r2-help-center"
import {
  canManageHelpContent,
  HELP_IMAGE_MAX_BYTES,
  HELP_VIDEO_MAX_BYTES,
  HELP_VIDEO_MAX_DURATION_SECONDS,
  isArticleVisibleToStaffRole,
  type HelpMediaUploadStatus,
} from "./constants"
import {
  buildHelpMediaStorageKey,
  extensionFromHelpMediaFileNameAndMime,
  humanizeHelpMediaFilenameTitle,
  resolveHelpMediaType,
} from "./help-media-storage-key"

export const HELP_MEDIA_DELIVERY_PATH_PREFIX = "/api/v1/staff/help/media"

export interface HelpMediaUploadIntentInput {
  filename: string
  mimeType: string
  fileSizeBytes: number
  mediaType: "IMAGE" | "VIDEO"
  title?: string | null
  description?: string | null
  sortOrder?: number
}

export interface HelpMediaUploadIntentResult {
  mediaId: string
  uploadUrl: string
  requiredHeaders: { "Content-Type": string }
  expiresAt: string
}

export interface HelpMediaConfirmInput {
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
}

export interface HelpMediaManageItem {
  id: string
  mediaType: string
  title: string | null
  description: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  sortOrder: number
  uploadStatus: HelpMediaUploadStatus
  uploadedAt: string | null
  displayUrl: string | null
}

export interface HelpMediaReadItem {
  id: string
  mediaType: string
  title: string | null
  description: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  sortOrder: number
  displayUrl: string
}

function assertHelpCenterStorageConfigured(env: Env) {
  if (env.MEDIA_HELP_CENTER_BUCKET) return
  const missing = listMissingHelpCenterS3ConfigKeys(env)
  if (!missing.length) return
  throw new AppError(
    500,
    "HELP_MEDIA_STORAGE_NOT_CONFIGURED",
    "Help media storage is not configured.",
  )
}

function buildMediaDeliveryPath(mediaId: string) {
  return `${HELP_MEDIA_DELIVERY_PATH_PREFIX}/${mediaId}`
}

function mapManageMediaRow(row: typeof helpArticleMedia.$inferSelect): HelpMediaManageItem {
  return {
    id: row.id,
    mediaType: row.mediaType,
    title: row.title,
    description: row.description,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    sortOrder: row.sortOrder,
    uploadStatus: row.uploadStatus as HelpMediaUploadStatus,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    displayUrl: row.uploadStatus === "READY" ? buildMediaDeliveryPath(row.id) : null,
  }
}

function mapReadMediaRow(row: typeof helpArticleMedia.$inferSelect): HelpMediaReadItem {
  return {
    id: row.id,
    mediaType: row.mediaType,
    title: row.title,
    description: row.description,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    sortOrder: row.sortOrder,
    displayUrl: buildMediaDeliveryPath(row.id),
  }
}

export function validateHelpMediaUploadIntent(input: HelpMediaUploadIntentInput) {
  const mimeType = input.mimeType.trim().toLowerCase()
  const resolvedType = resolveHelpMediaType(mimeType)
  if (!resolvedType || resolvedType !== input.mediaType) {
    throw new AppError(
      400,
      "INVALID_HELP_MEDIA_TYPE",
      "Only PNG, JPG, WEBP, MP4, and WEBM files are supported.",
    )
  }

  const ext = extensionFromHelpMediaFileNameAndMime(input.filename, mimeType)
  if (!ext) {
    throw new AppError(
      400,
      "INVALID_HELP_MEDIA_FILE",
      "File extension does not match the selected media type.",
    )
  }

  if (input.fileSizeBytes <= 0) {
    throw new AppError(400, "INVALID_HELP_MEDIA_FILE", "File size must be greater than zero.")
  }

  if (input.mediaType === "IMAGE" && input.fileSizeBytes > HELP_IMAGE_MAX_BYTES) {
    throw new AppError(400, "INVALID_HELP_MEDIA_FILE", "Image files must be under 10 MB.")
  }

  if (input.mediaType === "VIDEO" && input.fileSizeBytes > HELP_VIDEO_MAX_BYTES) {
    throw new AppError(400, "INVALID_HELP_MEDIA_FILE", "Video files must be under 100 MB.")
  }
}

async function requireHelpArticleForManage(db: DrizzleClient, articleId: string) {
  const rows = await db
    .select({ id: helpArticles.id })
    .from(helpArticles)
    .where(eq(helpArticles.id, articleId))
    .limit(1)

  const row = rows[0]
  if (!row) throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  return row
}

async function requireHelpMediaForArticle(db: DrizzleClient, articleId: string, mediaId: string) {
  const rows = await db
    .select()
    .from(helpArticleMedia)
    .where(and(eq(helpArticleMedia.id, mediaId), eq(helpArticleMedia.articleId, articleId)))
    .limit(1)

  const row = rows[0]
  if (!row) throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")
  return row
}

async function nextHelpMediaSortOrder(db: DrizzleClient, articleId: string) {
  const rows = await db
    .select({ sortOrder: helpArticleMedia.sortOrder })
    .from(helpArticleMedia)
    .where(eq(helpArticleMedia.articleId, articleId))
    .orderBy(asc(helpArticleMedia.sortOrder))

  const max = rows.reduce((current, row) => Math.max(current, row.sortOrder), 0)
  return max + 10
}

export async function loadHelpArticleMediaForManage(
  db: DrizzleClient,
  articleId: string,
): Promise<HelpMediaManageItem[]> {
  const rows = await db
    .select()
    .from(helpArticleMedia)
    .where(eq(helpArticleMedia.articleId, articleId))
    .orderBy(asc(helpArticleMedia.sortOrder), asc(helpArticleMedia.createdAt))

  return rows.map(mapManageMediaRow)
}

export async function loadHelpArticleMediaForRead(
  db: DrizzleClient,
  articleId: string,
): Promise<HelpMediaReadItem[]> {
  const rows = await db
    .select()
    .from(helpArticleMedia)
    .where(and(eq(helpArticleMedia.articleId, articleId), eq(helpArticleMedia.uploadStatus, "READY")))
    .orderBy(asc(helpArticleMedia.sortOrder), asc(helpArticleMedia.createdAt))

  return rows.filter((row) => Boolean(row.storageKey?.trim())).map(mapReadMediaRow)
}

export async function createHelpMediaUploadIntent(
  db: DrizzleClient,
  env: Env,
  articleId: string,
  input: HelpMediaUploadIntentInput,
  staffId: string,
): Promise<HelpMediaUploadIntentResult> {
  assertHelpCenterStorageConfigured(env)
  await requireHelpArticleForManage(db, articleId)
  validateHelpMediaUploadIntent(input)

  const mimeType = input.mimeType.trim().toLowerCase()
  const sortOrder = input.sortOrder ?? (await nextHelpMediaSortOrder(db, articleId))
  const title = input.title?.trim() || humanizeHelpMediaFilenameTitle(input.filename)

  const [created] = await db
    .insert(helpArticleMedia)
    .values({
      articleId,
      mediaType: input.mediaType,
      title,
      description: input.description?.trim() || null,
      mimeType,
      fileSizeBytes: input.fileSizeBytes,
      sortOrder,
      uploadStatus: "PENDING",
      createdByStaffId: staffId,
      updatedByStaffId: staffId,
    })
    .returning({ id: helpArticleMedia.id })

  const mediaId = created!.id
  const storageKey = buildHelpMediaStorageKey(articleId, mediaId, input.filename, mimeType)

  await db
    .update(helpArticleMedia)
    .set({ storageKey, updatedAt: new Date(), updatedByStaffId: staffId })
    .where(eq(helpArticleMedia.id, mediaId))

  const { uploadUrl, expiresAt } = await createHelpCenterPresignedPutUrl(env, storageKey, mimeType)

  return {
    mediaId,
    uploadUrl,
    requiredHeaders: { "Content-Type": mimeType },
    expiresAt,
  }
}

export async function confirmHelpMediaUpload(
  db: DrizzleClient,
  env: Env,
  articleId: string,
  mediaId: string,
  input: HelpMediaConfirmInput,
  staffId: string,
): Promise<HelpMediaManageItem> {
  assertHelpCenterStorageConfigured(env)
  const row = await requireHelpMediaForArticle(db, articleId, mediaId)
  const storageKey = row.storageKey?.trim()
  if (!storageKey) {
    throw new AppError(400, "HELP_MEDIA_INCOMPLETE", "Help media upload is missing a storage key.")
  }

  const exists = await verifyHelpCenterObjectExists(env, storageKey)
  if (!exists) {
    await db
      .update(helpArticleMedia)
      .set({ uploadStatus: "FAILED", updatedAt: new Date(), updatedByStaffId: staffId })
      .where(eq(helpArticleMedia.id, mediaId))
    throw new AppError(400, "HELP_MEDIA_UPLOAD_MISSING", "Uploaded file was not found in storage.")
  }

  if (
    input.durationSeconds != null &&
    (input.durationSeconds < 1 || input.durationSeconds > HELP_VIDEO_MAX_DURATION_SECONDS)
  ) {
    throw new AppError(400, "INVALID_HELP_MEDIA_FILE", "Videos should be 5 minutes or shorter.")
  }

  const head = await headHelpCenterObject(env, storageKey)
  const now = new Date()

  const [updated] = await db
    .update(helpArticleMedia)
    .set({
      uploadStatus: "READY",
      uploadedAt: now,
      width: input.width ?? row.width,
      height: input.height ?? row.height,
      durationSeconds: input.durationSeconds ?? row.durationSeconds,
      fileSizeBytes: head?.contentLength ?? row.fileSizeBytes,
      mimeType: head?.contentType ?? row.mimeType,
      updatedAt: now,
      updatedByStaffId: staffId,
    })
    .where(eq(helpArticleMedia.id, mediaId))
    .returning()

  return mapManageMediaRow(updated!)
}

export async function updateHelpMediaMetadata(
  db: DrizzleClient,
  articleId: string,
  mediaId: string,
  input: { title?: string; description?: string | null; sortOrder?: number },
  staffId: string,
): Promise<HelpMediaManageItem> {
  await requireHelpMediaForArticle(db, articleId, mediaId)

  const patch: Partial<typeof helpArticleMedia.$inferInsert> = {
    updatedAt: new Date(),
    updatedByStaffId: staffId,
  }
  if (input.title !== undefined) patch.title = input.title.trim() || null
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder

  const [updated] = await db
    .update(helpArticleMedia)
    .set(patch)
    .where(and(eq(helpArticleMedia.id, mediaId), eq(helpArticleMedia.articleId, articleId)))
    .returning()

  return mapManageMediaRow(updated!)
}

export async function deleteHelpMedia(
  db: DrizzleClient,
  env: Env,
  articleId: string,
  mediaId: string,
): Promise<{ ok: true }> {
  const row = await requireHelpMediaForArticle(db, articleId, mediaId)
  const storageKey = row.storageKey?.trim()
  if (storageKey) {
    try {
      await deleteHelpCenterObject(env, storageKey)
    } catch {
      throw new AppError(502, "HELP_MEDIA_DELETE_FAILED", "Could not delete help media from storage.")
    }
  }

  await db
    .delete(helpArticleMedia)
    .where(and(eq(helpArticleMedia.id, mediaId), eq(helpArticleMedia.articleId, articleId)))

  return { ok: true }
}

export async function reorderHelpMedia(
  db: DrizzleClient,
  articleId: string,
  items: Array<{ mediaId: string; sortOrder: number }>,
  staffId: string,
): Promise<HelpMediaManageItem[]> {
  if (!items.length) return loadHelpArticleMediaForManage(db, articleId)

  const existing = await db
    .select({ id: helpArticleMedia.id })
    .from(helpArticleMedia)
    .where(eq(helpArticleMedia.articleId, articleId))

  const existingIds = new Set(existing.map((row) => row.id))
  for (const item of items) {
    if (!existingIds.has(item.mediaId)) {
      throw new AppError(400, "HELP_MEDIA_NOT_FOUND", "One or more media items do not belong to this article.")
    }
  }

  const now = new Date()
  await Promise.all(
    items.map((item) =>
      db
        .update(helpArticleMedia)
        .set({ sortOrder: item.sortOrder, updatedAt: now, updatedByStaffId: staffId })
        .where(and(eq(helpArticleMedia.id, item.mediaId), eq(helpArticleMedia.articleId, articleId))),
    ),
  )

  return loadHelpArticleMediaForManage(db, articleId)
}

async function assertStaffCanAccessHelpMedia(
  db: DrizzleClient,
  mediaRow: typeof helpArticleMedia.$inferSelect,
  staff: { id: string; role: string },
) {
  const articleRows = await db
    .select({
      status: helpArticles.status,
      audienceRoles: helpArticles.audienceRoles,
    })
    .from(helpArticles)
    .where(eq(helpArticles.id, mediaRow.articleId))
    .limit(1)

  const article = articleRows[0]
  if (!article) throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")

  if (!canManageHelpContent(staff.role) && article.status !== "PUBLISHED") {
    throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")
  }

  if (!isArticleVisibleToStaffRole(article.audienceRoles, staff.role)) {
    throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")
  }

  if (mediaRow.uploadStatus !== "READY") {
    throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")
  }
}

export async function getHelpMediaDeliveryResponse(
  db: DrizzleClient,
  env: Env,
  mediaId: string,
  staff: { id: string; role: string },
  rangeHeader: string | null,
): Promise<Response> {
  const rows = await db.select().from(helpArticleMedia).where(eq(helpArticleMedia.id, mediaId)).limit(1)
  const row = rows[0]
  if (!row) throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")

  await assertStaffCanAccessHelpMedia(db, row, staff)

  const storageKey = row.storageKey?.trim()
  if (!storageKey) throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")

  try {
    const object = await getHelpCenterObjectStream(env, storageKey, rangeHeader)
    const headers = new Headers()
    headers.set("Content-Type", row.mimeType ?? object.contentType ?? "application/octet-stream")
    headers.set("Cache-Control", "private, max-age=300")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    headers.set("Accept-Ranges", "bytes")
    headers.set("Content-Disposition", "inline")
    if (object.etag) headers.set("ETag", object.etag)
    if (object.contentLength != null) headers.set("Content-Length", String(object.contentLength))
    if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString())
    if (object.contentRange) headers.set("Content-Range", object.contentRange)

    return new Response(object.body, { status: object.status, headers })
  } catch (error) {
    if (error instanceof HelpCenterObjectNotFoundError) {
      throw new AppError(404, "HELP_MEDIA_NOT_FOUND", "Help media was not found.")
    }
    throw new AppError(502, "HELP_MEDIA_UNAVAILABLE", "Help media is temporarily unavailable.")
  }
}
