import { loadJobsEnv } from "./config/env"
import { closeJobsPool } from "./db/client"
import {
  readPublishDrainMaxJobs,
  readPublishDrainMaxRuntimeMs,
  runPublishDrain,
  type PublishDrainSummary,
} from "./publishDrain"
import { CaricaturePreviewJobService } from "./services/caricaturePreviewJobService"
import { ImagePreviewRegenerationJobService } from "./services/imagePreviewRegenerationJobService"
import { ImagePublishJobService } from "./services/imagePublishJobService"
import { CaricaturePreviewWorker } from "./workers/caricaturePreviewWorker"
import { ImagePreviewRegenerationWorker } from "./workers/imagePreviewRegenerationWorker"
import { ImagePublishWorker } from "./workers/imagePublishWorker"

/** Runs one full publish drain pass (used by CLI and the wake HTTP server). */
export async function executePublishDrain(): Promise<PublishDrainSummary> {
  const env = loadJobsEnv(false)
  const imageJobService = new ImagePublishJobService(env.databaseUrl!)
  const caricatureJobService = new CaricaturePreviewJobService(env.databaseUrl!)
  const catalogPreviewRegenJobService = new ImagePreviewRegenerationJobService(env.databaseUrl!)
  const imageWorker = new ImagePublishWorker(imageJobService)
  const caricatureWorker = new CaricaturePreviewWorker(caricatureJobService)
  const catalogPreviewRegenWorker = new ImagePreviewRegenerationWorker(catalogPreviewRegenJobService)

  try {
    return await runPublishDrain({
      imageWorker,
      caricatureWorker,
      catalogPreviewRegenWorker,
      imageJobService,
      caricatureJobService,
      catalogPreviewRegenJobService,
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
