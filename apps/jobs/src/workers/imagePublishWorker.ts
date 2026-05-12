/**
 * Polling worker that owns one iteration of the publish-job lifecycle.
 *
 * Modes:
 *   - dry-run: read-only count, never claims, never mutates.
 *   - once / worker: gated by `IMAGE_PUBLISH_PROCESSING_ENABLED`.
 *       * disabled (default): logs the queued count and exits without claiming.
 *       * enabled: claims one job via `FOR UPDATE SKIP LOCKED`, runs real Sharp + R2
 *                  processing for contributor IMAGE items (PR-16G), reconciles job
 *                  status from item outcomes. Assets stay private until derivatives
 *                  and DB updates succeed.
 */
import type { JobsEnvConfig } from "../config/env"
import { ImagePublishProcessor } from "../services/imagePublishProcessor"
import type { ImagePublishJobService } from "../services/imagePublishJobService"

export interface RunOnceOptions {
  /** When true, do not connect to the DB; behave as a read-only stub. */
  skipDbAccess: boolean
  /** When true, dry-run mode: read-only counts, never claim, never mutate. */
  dryRun: boolean
  /** Gated by `IMAGE_PUBLISH_PROCESSING_ENABLED`. */
  processingEnabled: boolean
  /** Required when `processingEnabled` and not `dryRun` (R2 + Sharp publish path). */
  jobsEnv?: JobsEnvConfig
}

export class ImagePublishWorker {
  constructor(private readonly jobService: ImagePublishJobService | undefined) {}

  async runOnce(options: RunOnceOptions): Promise<void> {
    if (options.skipDbAccess || !this.jobService) {
      console.log("[fotocorp-jobs] db access skipped (no DATABASE_URL); pending publish jobs=unknown")
      return
    }

    const pendingCount = await this.jobService.countPendingJobs()
    console.log(`[fotocorp-jobs] pending publish jobs=${pendingCount}`)

    if (options.dryRun) return

    if (!options.processingEnabled) {
      console.log(
        "[fotocorp-jobs] processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no jobs claimed"
      )
      return
    }

    if (pendingCount === 0) {
      console.log("[fotocorp-jobs] no pending publish jobs; nothing to claim")
      return
    }

    const claimed = await this.jobService.claimNextPendingJob()
    if (!claimed) {
      console.log("[fotocorp-jobs] no pending publish jobs claimable this iteration")
      return
    }

    const { job, items } = claimed
    console.log(`[fotocorp-jobs] claimed publish job id=${job.id} jobType=${job.jobType} status=${job.status}`)
    console.log(`[fotocorp-jobs] job items=${items.length}`)

    if (!options.jobsEnv) {
      console.error("[fotocorp-jobs] missing jobsEnv configuration; cannot run publish processor")
      await this.jobService.markRemainingItemsFailedForJob(job.id, {
        failureCode: "CONFIG_ERROR",
        failureMessage: "Worker invoked processing without typed jobs env (internal error)."
      })
      await this.jobService.reconcilePublishJobAggregate(job.id)
      return
    }

    try {
      const processor = new ImagePublishProcessor(this.jobService, options.jobsEnv)
      await processor.processClaimedJob(claimed)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[fotocorp-jobs] fatal publish iteration error: ${message}`)
      console.error(error)
      await this.jobService.markRemainingItemsFailedForJob(job.id, {
        failureCode: "WORKER_FATAL",
        failureMessage: message.slice(0, 500)
      })
      await this.jobService.reconcilePublishJobAggregate(job.id)
      throw error
    }
  }
}
