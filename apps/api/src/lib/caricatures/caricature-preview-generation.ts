import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import {
  CARICATURE_DERIVATIVE_TYPES,
  caricatureDerivatives,
} from "../../db/schema/caricature-derivatives"
import type { Env } from "../../appTypes"
import {
  buildCaricaturePreviewStorageKey,
  caricatureDerivativeTypeFromPreviewVariant,
  CARICATURE_PREVIEWS_BUCKET_NAME,
  type CaricaturePreviewVariant,
} from "../caricature-preview-storage-key"
import { AppError } from "../errors"
import { generateCaricatureBlurredPreview } from "./caricature-blurred-preview"
import { buildCaricaturePreviewPublicUrl } from "./caricature-preview-public-url"
import { getCaricatureOriginalObjectBytes } from "../r2-caricature-originals"
import {
  hasCaricaturePreviewsS3Config,
  listMissingCaricaturePreviewsS3ConfigKeys,
  putCaricaturePreviewObject,
  resolveCaricaturePreviewsBucketName,
} from "../r2-caricature-previews"

const PREVIEW_VARIANTS: CaricaturePreviewVariant[] = ["card", "detail"]
const PREVIEW_MIME_TYPE = "image/webp"

export interface QueueCaricaturePreviewGenerationResult {
  ok: true
  assetId: string
  queuedTypes: string[]
}

export interface ProcessCaricaturePreviewGenerationResult {
  ok: true
  assetId: string
  processedTypes: string[]
  readyTypes: string[]
}

export async function hasReadyCaricaturePreviewDerivatives(
  db: DrizzleClient,
  assetId: string,
): Promise<boolean> {
  const rows = await db
    .select({ derivativeType: caricatureDerivatives.derivativeType })
    .from(caricatureDerivatives)
    .where(
      and(
        eq(caricatureDerivatives.caricatureId, assetId),
        eq(caricatureDerivatives.status, "READY"),
        inArray(caricatureDerivatives.derivativeType, [...CARICATURE_DERIVATIVE_TYPES]),
      ),
    )

  const ready = new Set(rows.map((row) => row.derivativeType))
  return ready.has("BLURRED_CARD") && ready.has("BLURRED_DETAIL")
}

export async function queueCaricaturePreviewGeneration(
  db: DrizzleClient,
  assetId: string,
): Promise<QueueCaricaturePreviewGenerationResult> {
  const asset = await requireCaricatureAssetWithOriginal(db, assetId)
  const bucketName = CARICATURE_PREVIEWS_BUCKET_NAME
  const now = new Date()
  const queuedTypes: string[] = []

  for (const variant of PREVIEW_VARIANTS) {
    const derivativeType = caricatureDerivativeTypeFromPreviewVariant(variant)
    const objectKey = buildCaricaturePreviewStorageKey({ assetId, variant })

    await db
      .insert(caricatureDerivatives)
      .values({
        caricatureId: assetId,
        derivativeType,
        bucket: bucketName,
        objectKey,
        format: "webp",
        width: 1,
        height: 1,
        status: "QUEUED",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [caricatureDerivatives.caricatureId, caricatureDerivatives.derivativeType],
        set: {
          bucket: bucketName,
          objectKey,
          format: "webp",
          status: "QUEUED",
          errorMessage: null,
          publicUrl: null,
          generatedAt: null,
          updatedAt: now,
        },
      })

    queuedTypes.push(derivativeType)
  }

  void asset
  return { ok: true, assetId, queuedTypes }
}

export async function processCaricaturePreviewGeneration(
  db: DrizzleClient,
  env: Env,
  assetId: string,
): Promise<ProcessCaricaturePreviewGenerationResult> {
  assertCaricaturePreviewStorageConfigured(env)

  const asset = await requireCaricatureAssetWithOriginal(db, assetId)
  const originalKey = asset.originalObjectKey!.trim()
  const originalBytes = await getCaricatureOriginalObjectBytes(env, originalKey)
  if (!originalBytes) {
    throw new AppError(
      400,
      "CARICATURE_ORIGINAL_MISSING",
      "Original caricature file was not found in storage.",
    )
  }

  const rows = await db
    .select()
    .from(caricatureDerivatives)
    .where(
      and(
        eq(caricatureDerivatives.caricatureId, assetId),
        inArray(caricatureDerivatives.status, ["QUEUED", "FAILED", "GENERATING"]),
      ),
    )

  if (!rows.length) {
    const ready = await hasReadyCaricaturePreviewDerivatives(db, assetId)
    if (ready) {
      return { ok: true, assetId, processedTypes: [], readyTypes: [...CARICATURE_DERIVATIVE_TYPES] }
    }
    await queueCaricaturePreviewGeneration(db, assetId)
  }

  const bucketName = resolveCaricaturePreviewsBucketName(env) || CARICATURE_PREVIEWS_BUCKET_NAME
  const label = asset.headline.trim() || asset.credit.trim() || "Fotocorp"
  const processedTypes: string[] = []
  const readyTypes: string[] = []

  for (const variant of PREVIEW_VARIANTS) {
    const derivativeType = caricatureDerivativeTypeFromPreviewVariant(variant)
    const objectKey = buildCaricaturePreviewStorageKey({ assetId, variant })
    const now = new Date()

    await db
      .update(caricatureDerivatives)
      .set({ status: "GENERATING", errorMessage: null, updatedAt: now })
      .where(
        and(
          eq(caricatureDerivatives.caricatureId, assetId),
          eq(caricatureDerivatives.derivativeType, derivativeType),
        ),
      )

    try {
      const generated = await generateCaricatureBlurredPreview({
        source: originalBytes,
        variant,
        label,
      })

      await putCaricaturePreviewObject(env, objectKey, generated.buffer, PREVIEW_MIME_TYPE)
      const publicUrl = buildCaricaturePreviewPublicUrl(env, objectKey)

      await db
        .update(caricatureDerivatives)
        .set({
          bucket: bucketName,
          objectKey,
          publicUrl,
          format: "webp",
          width: generated.width,
          height: generated.height,
          fileSizeBytes: generated.byteSize,
          blurVersion: generated.blurVersion,
          watermarkVersion: generated.watermarkVersion,
          status: "READY",
          errorMessage: null,
          generatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(caricatureDerivatives.caricatureId, assetId),
            eq(caricatureDerivatives.derivativeType, derivativeType),
          ),
        )

      processedTypes.push(derivativeType)
      readyTypes.push(derivativeType)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Preview generation failed."
      await db
        .update(caricatureDerivatives)
        .set({
          status: "FAILED",
          errorMessage: message.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(caricatureDerivatives.caricatureId, assetId),
            eq(caricatureDerivatives.derivativeType, derivativeType),
          ),
        )
      throw new AppError(502, "CARICATURE_PREVIEW_GENERATION_FAILED", message)
    }
  }

  return { ok: true, assetId, processedTypes, readyTypes }
}

export async function listQueuedCaricaturePreviewAssetIds(
  db: DrizzleClient,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ assetId: caricatureDerivatives.caricatureId })
    .from(caricatureDerivatives)
    .innerJoin(caricatureAssets, eq(caricatureAssets.id, caricatureDerivatives.caricatureId))
    .where(
      and(
        inArray(caricatureDerivatives.status, ["QUEUED", "FAILED"]),
        isNull(caricatureAssets.deletedAt),
        sql`${caricatureAssets.originalObjectKey} is not null`,
      ),
    )
    .limit(limit)

  return rows.map((row) => row.assetId)
}

async function requireCaricatureAssetWithOriginal(db: DrizzleClient, assetId: string) {
  const rows = await db
    .select()
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const asset = rows[0]
  if (!asset) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }
  if (!asset.originalObjectKey?.trim()) {
    throw new AppError(
      400,
      "CARICATURE_ORIGINAL_REQUIRED",
      "Upload the original caricature image before generating previews.",
    )
  }
  return asset
}

function assertCaricaturePreviewStorageConfigured(env: Env) {
  const canWriteWithBinding = Boolean(env.MEDIA_CARICATURE_PREVIEWS_BUCKET)
  const canWriteWithS3Api = hasCaricaturePreviewsS3Config(env)
  if (canWriteWithBinding || canWriteWithS3Api) return

  const missing = listMissingCaricaturePreviewsS3ConfigKeys(env)
  throw new AppError(
    503,
    "CARICATURE_PREVIEW_STORAGE_NOT_CONFIGURED",
    `Caricature preview storage is not configured. Add: ${missing.join(", ")}.`,
  )
}
