import { and, asc, eq, isNull } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import { caricatureCategories } from "../../db/schema/caricature-categories"
import type { Env } from "../../appTypes"
import {
  buildCaricatureOriginalStorageKey,
  CARICATURE_ORIGINALS_BUCKET_NAME,
  extensionFromCaricatureFileNameAndMime,
} from "../caricature-original-storage-key"
import { AppError } from "../errors"
import {
  getAdminCaricatureAssetById,
  type AdminCaricatureAssetDetail,
} from "./admin-caricature-assets"
import { isCaricatureSearchPlaceholder } from "../search/typesense-caricature-text"
import {
  hasCaricatureOriginalsS3Config,
  headCaricatureOriginalObject,
  listMissingCaricatureOriginalsS3ConfigKeys,
  resolveCaricatureOriginalsBucketName,
  verifyCaricatureOriginalObjectExists,
} from "../r2-caricature-originals"
import { createCaricatureOriginalPresignedPutUrl } from "../r2-presigned-put"

export interface CaricatureUploadShellInput {
  credit: string
  fileName?: string
}

export interface CaricatureOriginalPresignInput {
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface CaricatureOriginalPresignResult {
  assetId: string
  storageKey: string
  uploadMethod: "SIGNED_PUT"
  uploadUrl: string
  expiresAt: string
  headers: { "content-type": string }
}

export interface CaricatureOriginalCompleteInput {
  width?: number | null
  height?: number | null
  checksum?: string | null
}

export interface CaricatureOriginalCompleteResult {
  ok: true
  assetId: string
  hasOriginalFile: true
  idempotent?: true
}

export async function createCaricatureUploadShell(
  db: DrizzleClient,
  input: CaricatureUploadShellInput,
  actorStaffId: string | null,
): Promise<AdminCaricatureAssetDetail> {
  const credit = input.credit.trim()
  if (!credit || isCaricatureSearchPlaceholder(credit)) {
    throw new AppError(400, "CARICATURE_CREDIT_REQUIRED", "Credit is required to start an upload.")
  }

  const categoryId = await resolveDefaultCaricatureCategoryId(db)
  const headline = headlineFromUploadFileName(input.fileName)
  const now = new Date()

  const [created] = await db
    .insert(caricatureAssets)
    .values({
      headline,
      description: "",
      credit,
      categoryId,
      language: "NO_VISIBLE_TEXT",
      languageOther: null,
      visibleText: null,
      visibleTextTranslationEn: null,
      hasVisibleText: false,
      keywords: [],
      depictedSubjects: [],
      publishedAt: now,
      status: "DRAFT",
      visibility: "PRIVATE",
      createdByStaffId: actorStaffId,
      updatedByStaffId: actorStaffId,
    })
    .returning({ id: caricatureAssets.id })

  const detail = await getAdminCaricatureAssetById(db, created.id)
  if (!detail) {
    throw new AppError(500, "CARICATURE_CREATE_FAILED", "Failed to load created caricature.")
  }
  return detail
}

export async function presignCaricatureOriginalUpload(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  input: CaricatureOriginalPresignInput,
): Promise<CaricatureOriginalPresignResult> {
  assertCaricatureOriginalsStorageConfigured(env)

  const row = await requireCaricatureAssetRow(db, assetId)
  const ext = extensionFromCaricatureFileNameAndMime(input.fileName, input.mimeType)
  if (!ext) {
    throw new AppError(400, "INVALID_UPLOAD_FILE", "Unsupported caricature file type. Use JPG, PNG, or WebP.")
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > 50 * 1024 * 1024) {
    throw new AppError(400, "INVALID_UPLOAD_FILE", "Caricature file size must be between 1 byte and 50 MB.")
  }

  let storageKey: string
  try {
    storageKey = buildCaricatureOriginalStorageKey({ assetId, extension: ext })
  } catch {
    throw new AppError(400, "INVALID_UPLOAD_FILE", "Invalid caricature file extension.")
  }

  let signed: { uploadUrl: string; expiresAt: string }
  try {
    signed = await createCaricatureOriginalPresignedPutUrl(env, storageKey, input.mimeType)
  } catch (cause: unknown) {
    console.error("[caricature-upload] Presign failed", { assetId, storageKey, cause })
    throw new AppError(
      502,
      "UPLOAD_SIGN_FAILED",
      "Could not create a signed upload URL. Check API R2 credentials and restart the server.",
    )
  }

  await db
    .update(caricatureAssets)
    .set({
      originalFilename: input.fileName.trim(),
      mimeType: input.mimeType.trim(),
      fileSizeBytes: input.sizeBytes,
      updatedAt: new Date(),
    })
    .where(eq(caricatureAssets.id, assetId))

  return {
    assetId,
    storageKey,
    uploadMethod: "SIGNED_PUT",
    uploadUrl: signed.uploadUrl,
    expiresAt: signed.expiresAt,
    headers: { "content-type": input.mimeType.trim() },
  }
}

export async function completeCaricatureOriginalUpload(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  input: CaricatureOriginalCompleteInput = {},
): Promise<CaricatureOriginalCompleteResult> {
  assertCaricatureOriginalsStorageConfigured(env)

  const row = await requireCaricatureAssetRow(db, assetId)

  if (row.originalObjectKey?.trim()) {
    const stillExists = await verifyCaricatureOriginalObjectExists(env, row.originalObjectKey.trim())
    if (stillExists) {
      return { ok: true, assetId, hasOriginalFile: true, idempotent: true }
    }
  }

  const fileName = row.originalFilename?.trim()
  const mimeType = row.mimeType?.trim()
  if (!fileName || !mimeType) {
    throw new AppError(
      400,
      "CARICATURE_UPLOAD_NOT_PREPARED",
      "Upload was not prepared. Request a signed URL before completing.",
    )
  }

  const ext = extensionFromCaricatureFileNameAndMime(fileName, mimeType)
  if (!ext) {
    throw new AppError(400, "INVALID_UPLOAD_FILE", "Unsupported caricature file type.")
  }

  const storageKey = buildCaricatureOriginalStorageKey({ assetId, extension: ext })
  const objectExists = await verifyCaricatureOriginalObjectExists(env, storageKey)
  if (!objectExists) {
    throw new AppError(
      400,
      "UPLOAD_OBJECT_MISSING",
      "The file was not found in storage. Upload the bytes first, then retry.",
    )
  }

  const head = await headCaricatureOriginalObject(env, storageKey)
  const bucketName = resolveCaricatureOriginalsBucketName(env) || CARICATURE_ORIGINALS_BUCKET_NAME
  const width = normalizeOptionalDimension(input.width)
  const height = normalizeOptionalDimension(input.height)
  const checksum = normalizeOptionalChecksum(input.checksum)

  await db
    .update(caricatureAssets)
    .set({
      originalBucket: bucketName,
      originalObjectKey: storageKey,
      fileSizeBytes: head?.contentLength ?? row.fileSizeBytes,
      mimeType: head?.contentType ?? mimeType,
      width,
      height,
      checksum,
      updatedAt: new Date(),
    })
    .where(eq(caricatureAssets.id, assetId))

  return { ok: true, assetId, hasOriginalFile: true }
}

async function requireCaricatureAssetRow(db: DrizzleClient, assetId: string) {
  const rows = await db
    .select()
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }
  return row
}

async function resolveDefaultCaricatureCategoryId(db: DrizzleClient): Promise<string> {
  const rows = await db
    .select({ id: caricatureCategories.id })
    .from(caricatureCategories)
    .where(eq(caricatureCategories.isActive, true))
    .orderBy(asc(caricatureCategories.sortOrder), asc(caricatureCategories.name))
    .limit(1)

  const categoryId = rows[0]?.id
  if (!categoryId) {
    throw new AppError(
      503,
      "CARICATURE_CATEGORY_UNAVAILABLE",
      "No active caricature categories are configured. Run the category seed script first.",
    )
  }
  return categoryId
}

function headlineFromUploadFileName(fileName: string | undefined): string {
  if (!fileName?.trim()) return ""
  const base = fileName.trim().split(/[/\\]/).pop() ?? ""
  const withoutExt = base.replace(/\.[^.]+$/, "").trim()
  if (!withoutExt || isCaricatureSearchPlaceholder(withoutExt)) return ""
  return withoutExt.slice(0, 500)
}

function assertCaricatureOriginalsStorageConfigured(env: Env) {
  const canVerifyWithBinding = Boolean(env.MEDIA_CARICATURE_ORIGINALS_BUCKET)
  const canVerifyWithS3Api = hasCaricatureOriginalsS3Config(env)
  if (canVerifyWithBinding || canVerifyWithS3Api) return

  const missing = listMissingCaricatureOriginalsS3ConfigKeys(env)
  console.warn("[caricature-upload] Storage blocked — missing config:", missing.join(", "))
  throw new AppError(
    503,
    "UPLOAD_STORAGE_NOT_CONFIGURED",
    `Caricature upload storage is not configured on the API. Add to apps/api/.dev.vars (server-side only): ${missing.join(
      ", ",
    )}. Then restart the API dev server.`,
  )
}

function normalizeOptionalDimension(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function normalizeOptionalChecksum(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.length > 128) return null
  return trimmed
}
