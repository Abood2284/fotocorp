import { and, eq, inArray } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { CARICATURE_DERIVATIVE_TYPES, caricatureDerivatives } from "../../db/schema/caricature-derivatives"
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
import {
  hasReadyCaricaturePreviewDerivatives,
  queueCaricaturePreviewGeneration,
  requireCaricatureAssetWithOriginal,
} from "./caricature-preview-generation"
import { getCaricatureOriginalObjectBytes } from "../r2-caricature-originals"
import {
  hasCaricaturePreviewsS3Config,
  listMissingCaricaturePreviewsS3ConfigKeys,
  putCaricaturePreviewObject,
  resolveCaricaturePreviewsBucketName,
} from "../r2-caricature-previews"

const PREVIEW_VARIANTS: CaricaturePreviewVariant[] = ["card", "detail"]
const PREVIEW_MIME_TYPE = "image/webp"

export interface ProcessCaricaturePreviewGenerationResult {
  ok: true
  assetId: string
  processedTypes: string[]
  readyTypes: string[]
}

/** Node-only: runs Sharp blur pipeline. Not imported by the Cloudflare Worker bundle. */
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

function assertCaricaturePreviewStorageConfigured(env: Env) {
  const canWriteWithBinding = Boolean(env.MEDIA_PREVIEWS_BUCKET)
  const canWriteWithS3Api = hasCaricaturePreviewsS3Config(env)
  if (canWriteWithBinding || canWriteWithS3Api) return

  const missing = listMissingCaricaturePreviewsS3ConfigKeys(env)
  throw new AppError(
    503,
    "CARICATURE_PREVIEW_STORAGE_NOT_CONFIGURED",
    `Caricature preview storage is not configured. Add: ${missing.join(", ")}.`,
  )
}
