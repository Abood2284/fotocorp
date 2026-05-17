import { and, eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { imageAssets, imageDerivatives } from "../../db/schema"
import type { Env } from "../../appTypes"
import {
  expectedPublicPreviewProfile,
  publicPreviewIsWatermarked,
  toDerivativeVariant,
} from "../../lib/assets/public-catalog-sql"
import {
  createTimingTracker,
  formatServerTiming,
  FOTOCORP_REQUEST_ID_HEADER,
  logLatencyTrace,
} from "../../lib/latency-trace"
import { getR2Object } from "../../lib/r2"
import {
  MEDIA_PREVIEW_VARIANTS,
  parseMediaPreviewVariant,
  type MediaPreviewVariant,
} from "../../lib/media/preview-token"

interface StablePreviewRouteParams {
  request: Request
  env: Env
  db: DrizzleClient
  assetId: string
  variantParam: string
  requestId: string
  route: string
}

interface DerivativeRow {
  id: string
  mimeType: string
  r2Key: string
  isWatermarked: boolean
  watermarkProfile: string | null
  generationStatus: string
}

export const PUBLIC_STABLE_PREVIEW_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"

export async function stablePreviewMediaRoute(params: StablePreviewRouteParams): Promise<Response> {
  const tracker = createTimingTracker()

  if (!isUuid(params.assetId)) {
    return finishPreviewTrace(params, previewErrorResponse(400, "INVALID_ASSET_ID", "Asset id is invalid."), tracker, {
      cacheControl: "no-store",
    })
  }

  let variant: MediaPreviewVariant
  try {
    variant = parseMediaPreviewVariant(params.variantParam)
  } catch {
    return finishPreviewTrace(params, previewErrorResponse(400, "INVALID_VARIANT", "Unsupported preview variant."), tracker, {
      cacheControl: "no-store",
    })
  }

  const asset = await findPublicAsset(params.db, params.assetId)
  const derivative = asset ? await findPublicDerivative(params.db, params.assetId, variant) : null
  tracker.mark("db_lookup")

  if (!asset) {
    return finishPreviewTrace(params, previewErrorResponse(404, "ASSET_NOT_FOUND", "Asset was not found."), tracker, {
      cacheControl: "no-store",
    })
  }

  if (!asset.r2Exists || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") {
    return finishPreviewTrace(
      params,
      previewErrorResponse(403, "ASSET_NOT_PUBLIC", "Preview is not available for this asset."),
      tracker,
      { cacheControl: "no-store" },
    )
  }

  const expectedProfile = expectedPublicPreviewProfile(variant)
  const expectedWatermarked = publicPreviewIsWatermarked(variant)

  if (
    !derivative ||
    derivative.isWatermarked !== expectedWatermarked ||
    derivative.generationStatus !== "READY" ||
    derivative.watermarkProfile !== expectedProfile
  ) {
    return finishPreviewTrace(
      params,
      previewErrorResponse(404, "DERIVATIVE_NOT_READY", "Preview is not available yet."),
      tracker,
      { cacheControl: "no-store" },
    )
  }

  try {
    const object = await getR2Object(params.env.MEDIA_PREVIEWS_BUCKET, derivative.r2Key)
    tracker.mark("r2_read")
    if (!object?.body) {
      return finishPreviewTrace(
        params,
        previewErrorResponse(404, "DERIVATIVE_OBJECT_NOT_FOUND", "Preview file is not available yet."),
        tracker,
        { cacheControl: "no-store" },
      )
    }

    const headers = new Headers()
    headers.set("Content-Type", derivative.mimeType)
    headers.set("Content-Disposition", "inline")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Cache-Control", PUBLIC_STABLE_PREVIEW_CACHE_CONTROL)

    if (object.etag) headers.set("ETag", object.etag)
    if (object.contentLength !== null && object.contentLength !== undefined) {
      headers.set("Content-Length", String(object.contentLength))
    }
    if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString())

    tracker.mark("response_build")
    return finishPreviewTrace(params, new Response(object.body, { status: 200, headers }), tracker, {
      cacheControl: PUBLIC_STABLE_PREVIEW_CACHE_CONTROL,
    })
  } catch (error) {
    tracker.mark("r2_read")
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    return finishPreviewTrace(
      params,
      previewErrorResponse(502, "R2_ERROR", "Preview storage is temporarily unavailable."),
      tracker,
      { cacheControl: "no-store", error: serialized },
    )
  }
}

export function isStablePreviewVariant(value: string): value is MediaPreviewVariant {
  return MEDIA_PREVIEW_VARIANTS.includes(value as MediaPreviewVariant)
}

function finishPreviewTrace(
  params: StablePreviewRouteParams,
  response: Response,
  tracker: ReturnType<typeof createTimingTracker>,
  options: {
    cacheControl: string
    error?: { name: string; message: string }
  },
): Response {
  const durationMs = tracker.total()
  const timings = {
    db_lookup: tracker.elapsed("db_lookup"),
    r2_read: tracker.elapsed("r2_read"),
    response_build: tracker.elapsed("response_build"),
    total: durationMs,
  }

  logLatencyTrace({
    event: "latency_trace",
    requestId: params.requestId,
    layer: "api",
    route: params.route,
    status: response.ok ? "ok" : "error",
    statusCode: response.status,
    durationMs,
    timings,
    cache: {
      mode: "stable-preview",
      hit: false,
      cacheControl: options.cacheControl,
    },
    ...(options.error ? { error: options.error } : {}),
  })

  const headers = new Headers(response.headers)
  headers.set(FOTOCORP_REQUEST_ID_HEADER, params.requestId)
  headers.set("Server-Timing", formatServerTiming(timings, durationMs))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function previewErrorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

async function findPublicAsset(db: DrizzleClient, assetId: string) {
  const rows = await db
    .select({
      id: imageAssets.id,
      r2Exists: imageAssets.originalExistsInStorage,
      status: imageAssets.status,
      visibility: imageAssets.visibility,
    })
    .from(imageAssets)
    .where(eq(imageAssets.id, assetId))
    .limit(1)

  return rows[0] ?? null
}

async function findPublicDerivative(
  db: DrizzleClient,
  assetId: string,
  variant: MediaPreviewVariant,
): Promise<DerivativeRow | null> {
  const rows = await db
    .select({
      id: imageDerivatives.id,
      mimeType: imageDerivatives.mimeType,
      r2Key: imageDerivatives.storageKey,
      isWatermarked: imageDerivatives.isWatermarked,
      watermarkProfile: imageDerivatives.watermarkProfile,
      generationStatus: imageDerivatives.generationStatus,
    })
    .from(imageDerivatives)
    .where(
      and(
        eq(imageDerivatives.imageAssetId, assetId),
        eq(imageDerivatives.variant, toDerivativeVariant(variant)),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
