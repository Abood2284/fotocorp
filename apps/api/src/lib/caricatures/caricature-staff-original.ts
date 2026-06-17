import { GetObjectCommand } from "@aws-sdk/client-s3"
import { and, eq, isNull } from "drizzle-orm"

import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import { AppError } from "../errors"
import { getR2Object } from "../r2"
import {
  getCaricatureOriginalsS3Context,
  headCaricatureOriginalObject,
} from "../r2-caricature-originals"

export async function getAdminCaricatureOriginalResponse(
  db: DrizzleClient,
  env: Env,
  assetId: string,
): Promise<Response> {
  const rows = await db
    .select({
      originalObjectKey: caricatureAssets.originalObjectKey,
      originalFilename: caricatureAssets.originalFilename,
      mimeType: caricatureAssets.mimeType,
    })
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }

  const storageKey = row.originalObjectKey?.trim()
  if (!storageKey) {
    throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original caricature is not available.")
  }

  const binding = env.MEDIA_CARICATURE_ORIGINALS_BUCKET
  if (binding) {
    let object: Awaited<ReturnType<typeof getR2Object>> | null = null
    try {
      object = await getR2Object(binding, storageKey)
    } catch {
      throw new AppError(502, "R2_ERROR", "Original caricature service is unavailable.")
    }

    if (!object?.body) {
      throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original caricature is not available.")
    }

    return buildOriginalResponse({
      body: object.body,
      contentType: row.mimeType ?? object.contentType,
      filename: row.originalFilename,
      etag: object.etag,
      contentLength: object.contentLength,
      lastModified: object.uploaded,
    })
  }

  const ctx = getCaricatureOriginalsS3Context(env)
  if (!ctx) {
    throw new AppError(500, "CARICATURE_ORIGINALS_NOT_CONFIGURED", "Original caricature service is unavailable.")
  }

  const head = await headCaricatureOriginalObject(env, storageKey)
  if (!head) {
    throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original caricature is not available.")
  }

  try {
    const result = await ctx.client.send(new GetObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
    const body = result.Body
    if (!body) {
      throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original caricature is not available.")
    }

    return buildOriginalResponse({
      body: body.transformToWebStream(),
      contentType: row.mimeType ?? head.contentType ?? result.ContentType,
      filename: row.originalFilename,
      etag: result.ETag ?? null,
      contentLength: head.contentLength ?? result.ContentLength ?? null,
      lastModified: result.LastModified ?? null,
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(502, "R2_ERROR", "Original caricature service is unavailable.")
  }
}

function buildOriginalResponse(input: {
  body: ReadableStream
  contentType: string | null | undefined
  filename: string | null | undefined
  etag: string | null
  contentLength: number | null
  lastModified: Date | null
}): Response {
  const headers = new Headers()
  headers.set("Content-Type", input.contentType?.trim() || "application/octet-stream")
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  headers.set("Content-Disposition", `inline; filename="${safeFilename(input.filename)}"`)
  if (input.etag) headers.set("ETag", input.etag)
  if (input.lastModified) headers.set("Last-Modified", input.lastModified.toUTCString())
  if (input.contentLength != null) headers.set("Content-Length", String(input.contentLength))

  return new Response(input.body, { status: 200, headers })
}

function safeFilename(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return "caricature-original"
  return trimmed.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180) || "caricature-original"
}
