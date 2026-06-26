import type { JobsEnvConfig } from "../config/env"
import { ImagePreviewRegenerationProcessor } from "../services/imagePreviewRegenerationProcessor"
import type { ImagePreviewRegenerationJobService } from "../services/imagePreviewRegenerationJobService"

export interface RunImagePreviewRegenOnceOptions {
  skipDbAccess: boolean
  dryRun: boolean
  processingEnabled: boolean
  jobsEnv?: JobsEnvConfig
}

export interface RunImagePreviewRegenOnceResult {
  pendingCount: number | null
  claimedJob: boolean
}

export class ImagePreviewRegenerationWorker {
  constructor(private readonly jobService: ImagePreviewRegenerationJobService | undefined) {}

  async runOnce(options: RunImagePreviewRegenOnceOptions): Promise<RunImagePreviewRegenOnceResult> {
    if (options.skipDbAccess || !this.jobService) {
      console.log("[fotocorp-jobs] db access skipped (no DATABASE_URL); pending catalog preview regen jobs=unknown")
      return { pendingCount: null, claimedJob: false }
    }

    const pendingCount = await this.jobService.countPendingJobs()
    console.log(`[fotocorp-jobs] pending catalog preview regen jobs=${pendingCount}`)

    if (options.dryRun) return { pendingCount, claimedJob: false }

    if (!options.processingEnabled) {
      console.log(
        "[fotocorp-jobs] processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no catalog preview regen jobs claimed",
      )
      return { pendingCount, claimedJob: false }
    }

    if (pendingCount === 0) {
      return { pendingCount, claimedJob: false }
    }

    const claimed = await this.jobService.claimNextPendingJob()
    if (!claimed) {
      console.log("[fotocorp-jobs] no pending catalog preview regen jobs claimable this iteration")
      return { pendingCount, claimedJob: false }
    }

    console.log(
      `[fotocorp-jobs] claimed catalog preview regen job id=${claimed.id} assetId=${claimed.imageAssetId}`,
    )

    if (!options.jobsEnv) {
      await this.jobService.markJobFailed(claimed.id, {
        failureCode: "CONFIG_ERROR",
        failureMessage: "Worker invoked processing without typed jobs env (internal error).",
      })
      return { pendingCount, claimedJob: false }
    }

    try {
      const processor = new ImagePreviewRegenerationProcessor(this.jobService, options.jobsEnv)
      await processor.processClaimedJob(claimed)
      return { pendingCount, claimedJob: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[fotocorp-jobs] catalog preview regen iteration error: ${message}`)
      console.error(error)
      return { pendingCount, claimedJob: true }
    }
  }
}
