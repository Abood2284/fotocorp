/**
 * Polling worker that owns one iteration of the publish-job lifecycle.
 *
 * Modes:
 *   - dry-run: read-only count, never claims, never mutates.
 *   - once / worker: gated by `IMAGE_PUBLISH_PROCESSING_ENABLED`.
 *       * disabled (default): logs the queued count and exits without claiming.
 *       * enabled: claims one job via `FOR UPDATE SKIP LOCKED`, marks all of its
 *                  items `FAILED` with `PROCESSING_NOT_IMPLEMENTED`, then marks the
 *                  job `FAILED`. Never touches `image_assets`, never publishes
 *                  anything to the customer-facing catalog.
 *
 * Real Sharp/R2 image processing is intentionally deferred to a follow-up PR; this
 * worker only proves the polling, claiming, and lifecycle plumbing is wired safely.
 */
import type { ImagePublishJobService } from "../services/imagePublishJobService"

export const PROCESSING_NOT_IMPLEMENTED_FAILURE_CODE = "PROCESSING_NOT_IMPLEMENTED"
const PROCESSING_NOT_IMPLEMENTED_MESSAGE =
  "PR-16F polling foundation: image processing (Sharp + R2 promotion) is not implemented in apps/jobs yet."

export interface RunOnceOptions {
  /** When true, do not connect to the DB; behave as a read-only stub. */
  skipDbAccess: boolean
  /** When true, dry-run mode: read-only counts, never claim, never mutate. */
  dryRun: boolean
  /** Gated by `IMAGE_PUBLISH_PROCESSING_ENABLED`. */
  processingEnabled: boolean
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

    console.log(
      "[fotocorp-jobs] processing not implemented; marking job FAILED safely (PROCESSING_NOT_IMPLEMENTED)"
    )

    const markedItems = await this.jobService.markRemainingItemsFailedForJob(job.id, {
      failureCode: PROCESSING_NOT_IMPLEMENTED_FAILURE_CODE,
      failureMessage: PROCESSING_NOT_IMPLEMENTED_MESSAGE
    })
    console.log(`[fotocorp-jobs] items marked FAILED=${markedItems}`)

    await this.jobService.markJobFailed(job.id, {
      failureCode: PROCESSING_NOT_IMPLEMENTED_FAILURE_CODE,
      failureMessage: PROCESSING_NOT_IMPLEMENTED_MESSAGE
    })
  }
}
