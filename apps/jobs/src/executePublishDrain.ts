import { loadJobsEnv } from "./config/env"
import { closeJobsPool } from "./db/client"
import {
  readPublishDrainMaxJobs,
  readPublishDrainMaxRuntimeMs,
  runPublishDrain,
  type PublishDrainSummary,
} from "./publishDrain"
import { CaricaturePreviewJobService } from "./services/caricaturePreviewJobService"
import { ImagePublishJobService } from "./services/imagePublishJobService"
import { CaricaturePreviewWorker } from "./workers/caricaturePreviewWorker"
import { ImagePublishWorker } from "./workers/imagePublishWorker"

/** Runs one full publish drain pass (used by CLI and the wake HTTP server). */
export async function executePublishDrain(): Promise<PublishDrainSummary> {
  const env = loadJobsEnv(false)
  const imageJobService = new ImagePublishJobService(env.databaseUrl!)
  const caricatureJobService = new CaricaturePreviewJobService(env.databaseUrl!)
  const imageWorker = new ImagePublishWorker(imageJobService)
  const caricatureWorker = new CaricaturePreviewWorker(caricatureJobService)

  try {
    return await runPublishDrain({
      imageWorker,
      caricatureWorker,
      imageJobService,
      caricatureJobService,
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
