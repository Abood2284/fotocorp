/**
 * PR-16G — Real IMAGE publish processing for contributor-approved assets.
 *
 * After staff approval the API copies staging → canonical originals and queues
 * `image_publish_job_items`. This processor loads bytes (originals first, staging
 * fallback), ensures the canonical object exists, generates THUMB/CARD/DETAIL
 * watermarked WebPs (same profiles as `apps/api/scripts/media/process-image-publish-jobs.ts`),
 * writes previews to R2, upserts `image_derivatives`, and only then sets
 * `image_assets` to ACTIVE+PUBLIC.
 */
import type { JobsEnvConfig } from "../config/env"
import {
  buildR2ClientConfig,
  r2GetObject,
  r2HeadObject,
  r2PutCanonicalOriginal,
  r2PutPreviewObject,
  type R2ClientConfig
} from "../lib/r2Client"
import {
  buildDerivativeStorageKey,
  generatePublishDerivative,
  PREVIEW_MIME_TYPE,
  REQUIRED_PUBLISH_VARIANTS,
  type GeneratedPublishPreview,
  type PublishVariant
} from "../media/publishImageDerivatives"
import type { ClaimedPublishJob, PublishJobItemRow } from "./imagePublishJobService"
import { ImagePublishJobService } from "./imagePublishJobService"

function guessOriginalContentType(canonicalKey: string): string {
  const lower = canonicalKey.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

function publishErrorCode(error: unknown): string {
  if (!error) return "UNKNOWN"
  if (typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  if (typeof error === "object" && "name" in error && typeof (error as { name: unknown }).name === "string") {
    return (error as { name: string }).name.toUpperCase()
  }
  return "PUBLISH_JOB_ERROR"
}

function truncateMessage(message: string, max: number): string {
  if (message.length <= max) return message
  return `${message.slice(0, max - 1)}…`
}

export class ImagePublishProcessor {
  constructor(
    private readonly jobService: ImagePublishJobService,
    private readonly jobsEnv: JobsEnvConfig
  ) {}

  private buildR2(): R2ClientConfig {
    const accountId = this.jobsEnv.r2AccountId!
    return buildR2ClientConfig({
      accountId,
      originalsBucket: this.jobsEnv.r2OriginalsBucket!,
      previewsBucket: this.jobsEnv.r2PreviewsBucket!,
      stagingBucket: this.jobsEnv.r2ContributorStagingBucket!,
      accessKeyId: this.jobsEnv.r2AccessKeyId!,
      secretAccessKey: this.jobsEnv.r2SecretAccessKey!,
      endpoint: process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT,
      region: process.env.R2_REGION || process.env.CLOUDFLARE_R2_REGION
    })
  }

  /**
   * Processes every QUEUED item on an already-claimed job. Updates job aggregate when done.
   * Never throws to the worker loop — per-item failures mark FAILED and leave assets private.
   */
  async processClaimedJob(claimed: ClaimedPublishJob): Promise<void> {
    const r2 = this.buildR2()
    const stagingBucketEnv = r2.stagingBucket

    for (const item of claimed.items) {
      if (item.status !== "QUEUED") continue

      const started = await this.jobService.markItemRunning(item.id)
      if (!started) continue

      try {
        await this.processOneItem(r2, stagingBucketEnv, item)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const code = publishErrorCode(error)
        await this.jobService.markItemFailed(item.id, {
          failureCode: code,
          failureMessage: truncateMessage(message, 500)
        })
        console.error("[fotocorp-jobs.publish-item-failed]", {
          itemId: item.id,
          imageAssetId: item.imageAssetId,
          fotokey: item.fotokey,
          code,
          message: truncateMessage(message, 200)
        })
      }
    }

    await this.jobService.reconcilePublishJobAggregate(claimed.job.id)
  }

  private async processOneItem(
    r2: R2ClientConfig,
    stagingBucketEnv: string,
    item: PublishJobItemRow
  ): Promise<void> {
    const gate = await this.jobService.fetchAssetPublishGate(item.imageAssetId)
    if (!gate) {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "ASSET_NOT_FOUND",
        failureMessage: "image_assets row not found for publish item."
      })
      return
    }

    if (gate.mediaType !== "IMAGE") {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "UNSUPPORTED_MEDIA_TYPE",
        failureMessage: `Publish worker only supports IMAGE assets (got ${gate.mediaType}).`
      })
      return
    }

    if (!gate.hasContributorUploadItem || gate.source !== "FOTOCORP") {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "NOT_CONTRIBUTOR_IMAGE",
        failureMessage: "Asset is not a contributor-uploaded FOTOCORP image."
      })
      return
    }

    if (gate.status !== "APPROVED" || gate.visibility !== "PRIVATE" || !gate.fotokey) {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "INVALID_ASSET_STATE",
        failureMessage: "Expected APPROVED+PRIVATE with fotokey before publish processing."
      })
      return
    }

    if (gate.fotokey !== item.fotokey) {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "FOTOKEY_MISMATCH",
        failureMessage: "Job item fotokey does not match image_assets.fotokey."
      })
      return
    }

    if (!gate.originalStorageKey || item.canonicalOriginalKey !== gate.originalStorageKey) {
      await this.jobService.markItemFailed(item.id, {
        failureCode: "CANONICAL_KEY_MISMATCH",
        failureMessage: "Job item canonical_original_key does not match image_assets.original_storage_key."
      })
      return
    }

    const readBucketOriginals = r2.originalsBucket
    const canonicalKey = item.canonicalOriginalKey

    let original: Buffer
    const hasCanonical = await r2HeadObject(r2, readBucketOriginals, canonicalKey)
    if (hasCanonical) {
      original = await r2GetObject(r2, readBucketOriginals, canonicalKey)
    } else {
      const stagingBucket = stagingBucketEnv
      if (item.sourceBucket && item.sourceBucket !== stagingBucketEnv) {
        console.warn(
          `[fotocorp-jobs] item source_bucket differs from R2_CONTRIBUTOR_STAGING_BUCKET; using env staging bucket for reads (imageAssetId=${item.imageAssetId})`
        )
      }
      original = await r2GetObject(r2, stagingBucket, item.sourceStorageKey)
      await r2PutCanonicalOriginal(r2, canonicalKey, original, guessOriginalContentType(canonicalKey))
    }

    const generated: Record<PublishVariant, GeneratedPublishPreview> = {
      THUMB: await generatePublishDerivative(original, "THUMB", item.fotokey),
      CARD: await generatePublishDerivative(original, "CARD", item.fotokey),
      DETAIL: await generatePublishDerivative(original, "DETAIL", item.fotokey)
    }

    for (const variant of REQUIRED_PUBLISH_VARIANTS) {
      const built = generated[variant]
      const previewKey = buildDerivativeStorageKey(variant, item.fotokey)
      await r2PutPreviewObject(r2, previewKey, built.buffer, PREVIEW_MIME_TYPE)
    }

    const derivatives = REQUIRED_PUBLISH_VARIANTS.map((variant) => {
      const g = generated[variant]
      return {
        variant,
        storageKey: buildDerivativeStorageKey(variant, item.fotokey),
        width: g.width,
        height: g.height,
        byteSize: g.byteSize,
        checksum: g.checksum
      }
    })

    await this.jobService.completeSuccessfulPublishItem({
      itemId: item.id,
      imageAssetId: item.imageAssetId,
      derivatives
    })

    console.log("[fotocorp-jobs.publish-item-complete]", {
      itemId: item.id,
      imageAssetId: item.imageAssetId,
      fotokey: item.fotokey
    })
  }
}
