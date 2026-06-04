import { loadJobsEnv } from "./config/env"
import { closeJobsPool } from "./db/client"
import {
  readPublishDrainMaxJobs,
  readPublishDrainMaxRuntimeMs,
  runPublishDrain,
  type PublishDrainSummary,
} from "./publishDrain"
import { ImagePublishJobService } from "./services/imagePublishJobService"
import { ImagePublishWorker } from "./workers/imagePublishWorker"

/** Runs one full publish drain pass (used by CLI and the wake HTTP server). */
export async function executePublishDrain(): Promise<PublishDrainSummary> {
  const env = loadJobsEnv(false)
  const jobService = new ImagePublishJobService(env.databaseUrl!)
  const worker = new ImagePublishWorker(jobService)

  try {
    return await runPublishDrain({
      worker,
      jobService,
      skipDbAccess: false,
      processingEnabled: env.imagePublishProcessingEnabled,
      jobsEnv: env,
      limits: {
        maxJobs: readPublishDrainMaxJobs(),
        maxRuntimeMs: readPublishDrainMaxRuntimeMs(),
      },
    })
  } finally {
    await closeJobsPool()
  }
}
