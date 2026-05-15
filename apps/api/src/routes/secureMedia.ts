import { and, eq } from "drizzle-orm";
import type { DrizzleClient } from "../db";
import { imageAccessLogs, imageAssets, imageDerivatives } from "../db/schema";
import { AppError } from "../lib/errors";
import { getR2Object } from "../lib/r2";
import {
  parseMediaPreviewVariant,
  verifyPreviewToken,
  type MediaPreviewVariant,
} from "../lib/media/preview-token";
import {
  CARD_CLEAN_PROFILE,
  CURRENT_WATERMARK_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../lib/media/watermark";
import type { Env } from "../appTypes";

type MediaAccessOutcome =
  | "SERVED"
  | "NOT_FOUND"
  | "PREVIEW_NOT_READY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_TOKEN"
  | "R2_ERROR";

type CleanMediaPreviewVariant = "THUMB" | "CARD" | "DETAIL";

interface PreviewRouteParams {
  request: Request;
  env: Env;
  db: DrizzleClient;
  assetId: string;
}

interface AssetRow {
  id: string;
  r2Exists: boolean;
  status: string;
  visibility: string;
}

interface DerivativeRow {
  id: string;
  assetId: string;
  variant: string;
  r2Key: string;
  mimeType: string;
  isWatermarked: boolean;
  watermarkProfile: string | null;
  generationStatus: string;
}

export async function securePreviewMediaRoute(params: PreviewRouteParams): Promise<Response> {
  const url = new URL(params.request.url);
  const variant = parseMediaPreviewVariant(url.searchParams.get("variant"));
  const token = url.searchParams.get("token");

  if (!isUuid(params.assetId)) {
    return mediaErrorResponse(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  if (!token) {
    logPreviewFailure({ assetId: params.assetId, variant, reason: "UNAUTHORIZED" });
    await writeAccessLog(params.db, {
      assetId: params.assetId,
      variant,
      statusCode: 401,
      outcome: "UNAUTHORIZED",
      request: params.request,
    });
    return mediaErrorResponse(401, "UNAUTHORIZED", "Preview token is required.");
  }

  try {
    await verifyPreviewToken(token, { assetId: params.assetId, variant }, params.env.MEDIA_PREVIEW_TOKEN_SECRET);
  } catch (error) {
    logPreviewFailure({
      assetId: params.assetId,
      variant,
      reason: error instanceof AppError ? error.code : "INVALID_PREVIEW_TOKEN",
    });
    await writeAccessLog(params.db, {
      assetId: params.assetId,
      variant,
      statusCode: error instanceof AppError ? error.status : 401,
      outcome: "INVALID_TOKEN",
      request: params.request,
    });
    return mediaErrorFromUnknown(error);
  }

  const asset = await findAsset(params.db, params.assetId);
  if (!asset) {
    logPreviewFailure({ assetId: params.assetId, variant, reason: "ASSET_NOT_FOUND" });
    await writeAccessLog(params.db, {
      assetId: params.assetId,
      variant,
      statusCode: 404,
      outcome: "NOT_FOUND",
      request: params.request,
    });
    return mediaErrorResponse(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }

  if (!asset.r2Exists || asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC") {
    logPreviewFailure({ assetId: asset.id, variant, reason: "ASSET_NOT_PUBLIC" });
    await writeAccessLog(params.db, {
      assetId: asset.id,
      variant,
      statusCode: 403,
      outcome: "FORBIDDEN",
      request: params.request,
    });
    return mediaErrorResponse(403, "ASSET_NOT_PUBLIC", "Preview is not available for this asset.");
  }

  const derivative = await findDerivative(params.db, asset.id, variant);
  const watermarkOk =
    variant === "detail" ? derivative?.isWatermarked === true : derivative?.isWatermarked === false;
  const expectedProfile = expectedSecurePreviewProfile(variant);
  if (
    !derivative ||
    !watermarkOk ||
    derivative.generationStatus !== "READY" ||
    derivative.watermarkProfile !== expectedProfile
  ) {
    logPreviewFailure({
      assetId: asset.id,
      variant,
      reason: "DERIVATIVE_NOT_READY",
      derivativeStatus: derivative?.generationStatus ?? "missing",
    });
    await writeAccessLog(params.db, {
      assetId: asset.id,
      derivativeId: derivative ? derivative.id : undefined,
      variant,
      statusCode: 404,
      outcome: "PREVIEW_NOT_READY",
      request: params.request,
    });
    return derivativeNotReadyResponse();
  }

  try {
    const object = await getR2Object(params.env.MEDIA_PREVIEWS_BUCKET, derivative.r2Key);
    if (!object?.body) {
      logPreviewFailure({
        assetId: asset.id,
        variant,
        reason: "DERIVATIVE_OBJECT_NOT_FOUND",
        derivativeStatus: derivative.generationStatus,
      });
      await writeAccessLog(params.db, {
        assetId: asset.id,
        derivativeId: derivative.id,
        variant,
        statusCode: 404,
        outcome: "PREVIEW_NOT_READY",
        request: params.request,
      });
      return mediaErrorResponse(404, "DERIVATIVE_OBJECT_NOT_FOUND", "Preview file is not available yet.");
    }

    await writeAccessLog(params.db, {
      assetId: asset.id,
      derivativeId: derivative.id,
      variant,
      statusCode: 200,
      outcome: "SERVED",
      request: params.request,
    });

    return new Response(object.body, {
      status: 200,
      headers: previewHeaders(derivative, object),
    });
  } catch {
    logPreviewFailure({
      assetId: asset.id,
      variant,
      reason: "R2_ERROR",
      derivativeStatus: derivative.generationStatus,
    });
    await writeAccessLog(params.db, {
      assetId: asset.id,
      derivativeId: derivative.id,
      variant,
      statusCode: 502,
      outcome: "R2_ERROR",
      request: params.request,
    });
    return mediaErrorResponse(502, "R2_ERROR", "Preview storage is temporarily unavailable.");
  }
}

function previewHeaders(derivative: DerivativeRow, object: Awaited<ReturnType<typeof getR2Object>>): Headers {
  const headers = new Headers();
  headers.set("Content-Type", derivative.mimeType);
  headers.set("Content-Disposition", "inline");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");

  if (object?.etag) {
    headers.set("ETag", object.etag);
  }

  if (object?.contentLength !== null && object?.contentLength !== undefined) {
    headers.set("Content-Length", String(object.contentLength));
  }

  if (object?.uploaded) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  return headers;
}

function mediaErrorFromUnknown(error: unknown): Response {
  if (error instanceof AppError) {
    return mediaErrorResponse(error.status, error.code, error.message);
  }

  return mediaErrorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

function derivativeNotReadyResponse(): Response {
  return mediaErrorResponse(404, "DERIVATIVE_NOT_READY", "Preview is not available yet.");
}

function mediaErrorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function logPreviewFailure(values: {
  assetId: string;
  variant: MediaPreviewVariant;
  reason: string;
  derivativeStatus?: string;
}): void {
  console.warn("preview_failure", {
    assetId: values.assetId,
    variant: values.variant,
    reason: values.reason,
    derivativeStatus: values.derivativeStatus,
  });
}

async function findAsset(db: DrizzleClient, assetId: string): Promise<AssetRow | null> {
  const rows = await db
    .select({
      id: imageAssets.id,
      r2Exists: imageAssets.originalExistsInStorage,
      status: imageAssets.status,
      visibility: imageAssets.visibility,
    })
    .from(imageAssets)
    .where(eq(imageAssets.id, assetId))
    .limit(1);

  return rows[0] ?? null;
}

async function findDerivative(
  db: DrizzleClient,
  assetId: string,
  variant: MediaPreviewVariant,
): Promise<DerivativeRow | null> {
  const rows = await db
    .select({
      id: imageDerivatives.id,
      assetId: imageDerivatives.imageAssetId,
      variant: imageDerivatives.variant,
      r2Key: imageDerivatives.storageKey,
      mimeType: imageDerivatives.mimeType,
      isWatermarked: imageDerivatives.isWatermarked,
      watermarkProfile: imageDerivatives.watermarkProfile,
      generationStatus: imageDerivatives.generationStatus,
    })
    .from(imageDerivatives)
    .where(and(eq(imageDerivatives.imageAssetId, assetId), eq(imageDerivatives.variant, toCleanVariant(variant))))
    .limit(1);

  return rows[0] ?? null;
}

async function writeAccessLog(
  db: DrizzleClient,
  values: {
    assetId?: string;
    derivativeId?: string;
    variant: MediaPreviewVariant;
    statusCode: number;
    outcome: MediaAccessOutcome;
    request: Request;
  },
): Promise<void> {
  try {
    await db.insert(imageAccessLogs).values({
      imageAssetId: values.assetId,
      imageDerivativeId: values.derivativeId,
      variant: toCleanVariant(values.variant),
      ipHash: await hashIp(getClientIp(values.request)),
      userAgent: values.request.headers.get("User-Agent"),
      statusCode: values.statusCode,
      outcome: values.outcome,
      source: "APPLICATION",
    });
  } catch {
    // Access logging must not make media serving less reliable.
  }
}

function expectedSecurePreviewProfile(variant: MediaPreviewVariant): string {
  if (variant === "thumb") return THUMB_CLEAN_PROFILE;
  if (variant === "card") return CARD_CLEAN_PROFILE;
  return CURRENT_WATERMARK_PROFILE;
}

function toCleanVariant(variant: MediaPreviewVariant): CleanMediaPreviewVariant {
  return variant.toUpperCase() as CleanMediaPreviewVariant;
}

function getClientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? null;
}

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
