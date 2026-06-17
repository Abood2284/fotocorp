import type { JobsEnvConfig } from "../config/env"
import {
  buildCaricaturePreviewPublicUrl,
  buildCaricaturePreviewStorageKey,
  caricatureDerivativeTypeFromPreviewVariant,
  CARICATURE_ORIGINALS_BUCKET_NAME,
  CARICATURE_PREVIEWS_BUCKET_NAME,
  type CaricaturePreviewVariant,
} from "../lib/caricatureStorageKeys"
import { buildR2ClientConfig, r2GetObject, r2PutObject, type R2ClientConfig } from "../lib/r2Client"
import { notifyTypesenseSyncCaricature } from "../lib/typesense-sync-client"
import { generateCaricatureBlurredPreview } from "../media/caricatureBlurredPreview"
import type { CaricaturePreviewJobRow } from "./caricaturePreviewJobService"
import { CaricaturePreviewJobService } from "./caricaturePreviewJobService"

const PREVIEW_VARIANTS: CaricaturePreviewVariant[] = ["card", "detail"]
const PREVIEW_MIME_TYPE = "image/webp"

export class CaricaturePreviewProcessor {
  constructor(
    private readonly jobService: CaricaturePreviewJobService,
    private readonly jobsEnv: JobsEnvConfig,
  ) {}

  async processClaimedJob(job: CaricaturePreviewJobRow): Promise<void> {
    try {
      await this.jobService.withTransaction(async (client) => {
        const asset = await this.jobService.loadAssetForJob(client, job.caricatureAssetId)
        if (!asset) {
          throw new Error("Caricature asset not found.")
        }
        if (!asset.originalObjectKey?.trim()) {
          throw new Error("Caricature original file is missing.")
        }

        const r2 = this.buildR2()
        const originalsBucket = this.jobsEnv.r2CaricatureOriginalsBucket ?? CARICATURE_ORIGINALS_BUCKET_NAME
        const previewsBucket = this.jobsEnv.r2PreviewsBucket ?? CARICATURE_PREVIEWS_BUCKET_NAME
        const originalBytes = await r2GetObject(r2, originalsBucket, asset.originalObjectKey.trim())
        const label = asset.headline.trim() || asset.credit.trim() || "Fotocorp"

        for (const variant of PREVIEW_VARIANTS) {
          const derivativeType = caricatureDerivativeTypeFromPreviewVariant(variant)
          const objectKey = buildCaricaturePreviewStorageKey({ assetId: asset.id, variant })

          await this.jobService.markDerivativeGenerating(client, asset.id, derivativeType)

          try {
            const generated = await generateCaricatureBlurredPreview({
              source: originalBytes,
              variant,
              label,
            })
            await r2PutObject(r2, previewsBucket, objectKey, generated.buffer, PREVIEW_MIME_TYPE)
            const publicUrl = buildCaricaturePreviewPublicUrl(
              this.jobsEnv.publicPreviewCdnBaseUrl,
              objectKey,
            )

            await this.jobService.upsertDerivativeReady(client, {
              assetId: asset.id,
              derivativeType,
              bucket: previewsBucket,
              objectKey,
              publicUrl,
              width: generated.width,
              height: generated.height,
              byteSize: generated.byteSize,
              blurVersion: generated.blurVersion,
              watermarkVersion: generated.watermarkVersion,
            })
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Preview generation failed."
            await this.jobService.markDerivativeFailed(client, asset.id, derivativeType, message)
            throw error
          }
        }

        if (job.publishOnSuccess) {
          await this.jobService.publishCaricatureAsset(
            client,
            asset.id,
            job.requestedByStaffId ?? asset.publishedByStaffId,
          )
        }
      })

      await this.jobService.markJobCompleted(job.id)

      if (job.publishOnSuccess) {
        await notifyTypesenseSyncCaricature({
          apiBaseUrl: this.jobsEnv.fotocorpApiBaseUrl,
          internalSecret: this.jobsEnv.internalApiSecret,
          assetId: job.caricatureAssetId,
          critical: true,
        })
      }

      console.log("[fotocorp-jobs.caricature-preview-complete]", {
        jobId: job.id,
        assetId: job.caricatureAssetId,
        publishOnSuccess: job.publishOnSuccess,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await this.jobService.markJobFailed(job.id, {
        failureCode: "CARICATURE_PREVIEW_FAILED",
        failureMessage: message,
      })
      throw error
    }
  }

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
      region: process.env.R2_REGION || process.env.CLOUDFLARE_R2_REGION,
    })
  }
}
