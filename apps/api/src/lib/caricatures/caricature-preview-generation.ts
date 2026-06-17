import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import {
  CARICATURE_DERIVATIVE_TYPES,
  caricatureDerivatives,
} from "../../db/schema/caricature-derivatives"
import {
  buildCaricaturePreviewStorageKey,
  caricatureDerivativeTypeFromPreviewVariant,
  CARICATURE_PREVIEWS_BUCKET_NAME,
  type CaricaturePreviewVariant,
} from "../caricature-preview-storage-key"
import { AppError } from "../errors"

const PREVIEW_VARIANTS: CaricaturePreviewVariant[] = ["card", "detail"]

export interface QueueCaricaturePreviewGenerationResult {
  ok: true
  assetId: string
  queuedTypes: string[]
}

export type CaricaturePreviewGenerationStatus =
  | "NONE"
  | "QUEUED"
  | "GENERATING"
  | "READY"
  | "FAILED"

export async function getCaricaturePreviewGenerationStatus(
  db: DrizzleClient,
  assetId: string,
): Promise<CaricaturePreviewGenerationStatus> {
  const rows = await db
    .select({
      derivativeType: caricatureDerivatives.derivativeType,
      status: caricatureDerivatives.status,
    })
    .from(caricatureDerivatives)
    .where(
      and(
        eq(caricatureDerivatives.caricatureId, assetId),
        inArray(caricatureDerivatives.derivativeType, [...CARICATURE_DERIVATIVE_TYPES]),
      ),
    )

  if (rows.length === 0) return "NONE"

  const readyTypes = new Set(
    rows.filter((row) => row.status === "READY").map((row) => row.derivativeType),
  )
  if (readyTypes.has("BLURRED_CARD") && readyTypes.has("BLURRED_DETAIL")) {
    return "READY"
  }

  if (rows.some((row) => row.status === "FAILED")) return "FAILED"
  if (rows.some((row) => row.status === "GENERATING")) return "GENERATING"
  return "QUEUED"
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

export async function requireCaricatureAssetWithOriginal(db: DrizzleClient, assetId: string) {
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
