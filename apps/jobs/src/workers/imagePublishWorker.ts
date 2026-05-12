import type { ImagePublishJobService } from "../services/imagePublishJobService"

export class ImagePublishWorker {
  constructor(private readonly jobService: ImagePublishJobService) {}

  /**
   * One pass over pending publish work.
   * Dry-run: list only, no mutations.
   * Non-dry-run with pending jobs: throws until processing is implemented.
   */
  async runOnce(options: { dryRun: boolean }): Promise<void> {
    const pending = await this.jobService.listPendingJobs()
    console.log(`[fotocorp-jobs] pending publish jobs=${pending.length}`)

    if (options.dryRun) return

    if (pending.length > 0) {
      throw new Error(
        "Not implemented: image publish processing for pending jobs is not implemented yet"
      )
    }

    console.log("[fotocorp-jobs] no pending jobs; nothing to process")
  }
}
