import type { JobsEnvConfig } from "../config/env"
import {
  buildR2ClientConfig,
  r2GetObject,
  r2PutPreviewObject,
  type R2ClientConfig,
} from "../lib/r2Client"
import {
  buildCatalogPreviewStorageKey,
  CATALOG_PREVIEW_MIME_TYPE,
  generateCatalogPreviewDerivative,
  listCatalogVariantsToRegenerate,
  resolveCatalogPreviewObjectId,
} from "../media/regenerateCatalogPreviewDerivatives"
import type { ImagePreviewRegenerationJobRow } from "./imagePreviewRegenerationJobService"
import { ImagePreviewRegenerationJobService } from "./imagePreviewRegenerationJobService"

export class ImagePreviewRegenerationProcessor {
  constructor(
    private readonly jobService: ImagePreviewRegenerationJobService,
    private readonly jobsEnv: JobsEnvConfig,
  ) {}

  async processClaimedJob(job: ImagePreviewRegenerationJobRow): Promise<void> {
    try {
      await this.jobService.withTransaction(async (client) => {
        const asset = await this.jobService.loadAssetForJob(client, job.imageAssetId)
        if (!asset) {
          throw new Error("Asset is not eligible for preview regeneration.")
        }

        const derivativeRows = await this.jobService.loadDerivativesForAsset(client, asset.id)
        const existingByVariant = new Map(
          derivativeRows.map((row) => [row.variant, row]),
        )
        const variantsToGenerate = listCatalogVariantsToRegenerate(existingByVariant)

        if (variantsToGenerate.length === 0) return

        const previewObjectId = resolveCatalogPreviewObjectId({
          assetId: asset.id,
          legacyImageCode: asset.legacyImageCode,
          originalStorageKey: asset.originalStorageKey,
        })

        const r2 = this.buildR2()
        const original = await r2GetObject(r2, r2.originalsBucket, asset.originalStorageKey)
        const label = previewObjectId

        for (const variant of variantsToGenerate) {
          try {
            const generated = await generateCatalogPreviewDerivative(original, variant, label, previewObjectId)
            await r2PutPreviewObject(r2, generated.storageKey, generated.buffer, CATALOG_PREVIEW_MIME_TYPE)
            await this.jobService.upsertDerivativeReady(client, asset.id, generated)
          } catch (error: unknown) {
            const storageKey = buildCatalogPreviewStorageKey(variant, previewObjectId)
            await this.jobService.markDerivativeFailed(client, asset.id, variant, storageKey)
            throw error
          }
        }
      })

      await this.jobService.markJobCompleted(job.id)

      console.log("[fotocorp-jobs.catalog-preview-regen-complete]", {
        jobId: job.id,
        assetId: job.imageAssetId,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await this.jobService.markJobFailed(job.id, {
        failureCode: "PREVIEW_REGEN_FAILED",
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
