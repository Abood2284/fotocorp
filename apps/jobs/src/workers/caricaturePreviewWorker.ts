import type { JobsEnvConfig } from "../config/env"
import { CaricaturePreviewProcessor } from "../services/caricaturePreviewProcessor"
import type { CaricaturePreviewJobService } from "../services/caricaturePreviewJobService"

export interface RunCaricatureOnceOptions {
  skipDbAccess: boolean
  dryRun: boolean
  processingEnabled: boolean
  jobsEnv?: JobsEnvConfig
}

export interface RunCaricatureOnceResult {
  pendingCount: number | null
  claimedJob: boolean
}

export class CaricaturePreviewWorker {
  constructor(private readonly jobService: CaricaturePreviewJobService | undefined) {}

  async runOnce(options: RunCaricatureOnceOptions): Promise<RunCaricatureOnceResult> {
    if (options.skipDbAccess || !this.jobService) {
      console.log("[fotocorp-jobs] db access skipped (no DATABASE_URL); pending caricature jobs=unknown")
      return { pendingCount: null, claimedJob: false }
    }

    const pendingCount = await this.jobService.countPendingJobs()
    console.log(`[fotocorp-jobs] pending caricature preview jobs=${pendingCount}`)

    if (options.dryRun) return { pendingCount, claimedJob: false }

    if (!options.processingEnabled) {
      console.log(
        "[fotocorp-jobs] processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no caricature jobs claimed",
      )
      return { pendingCount, claimedJob: false }
    }

    if (pendingCount === 0) {
      return { pendingCount, claimedJob: false }
    }

    const claimed = await this.jobService.claimNextPendingJob()
    if (!claimed) {
      console.log("[fotocorp-jobs] no pending caricature preview jobs claimable this iteration")
      return { pendingCount, claimedJob: false }
    }

    console.log(
      `[fotocorp-jobs] claimed caricature preview job id=${claimed.id} assetId=${claimed.caricatureAssetId} publishOnSuccess=${claimed.publishOnSuccess}`,
    )

    if (!options.jobsEnv) {
      await this.jobService.markJobFailed(claimed.id, {
        failureCode: "CONFIG_ERROR",
        failureMessage: "Worker invoked processing without typed jobs env (internal error).",
      })
      return { pendingCount, claimedJob: false }
    }

    try {
      const processor = new CaricaturePreviewProcessor(this.jobService, options.jobsEnv)
      await processor.processClaimedJob(claimed)
      return { pendingCount, claimedJob: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[fotocorp-jobs] caricature preview iteration error: ${message}`)
      console.error(error)
      return { pendingCount, claimedJob: true }
    }
  }
}
