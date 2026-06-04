import type { JobsEnvConfig } from "./config/env"
import type { ImagePublishJobService } from "./services/imagePublishJobService"
import type { ImagePublishWorker } from "./workers/imagePublishWorker"

export interface PublishDrainLimits {
  maxJobs: number
  maxRuntimeMs: number
}

export interface PublishDrainSummary {
  pendingAtStart: number
  pendingAtEnd: number
  processed: number
  durationMs: number
  stopReason: "empty" | "max_jobs" | "max_runtime" | "processing_disabled" | "no_progress"
}

function logStructured(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

export function readPublishDrainMaxJobs(): number {
  const raw = process.env.PUBLISH_DRAIN_MAX_JOBS
  if (raw === undefined || raw === "") return 25
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.log(
      `[fotocorp-jobs] warn: invalid PUBLISH_DRAIN_MAX_JOBS=${JSON.stringify(raw)}; using 25`
    )
    return 25
  }
  return parsed
}

export function readPublishDrainMaxRuntimeMs(): number {
  const raw = process.env.PUBLISH_DRAIN_MAX_RUNTIME_SECONDS
  if (raw === undefined || raw === "") return 300_000
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.log(
      `[fotocorp-jobs] warn: invalid PUBLISH_DRAIN_MAX_RUNTIME_SECONDS=${JSON.stringify(raw)}; using 300`
    )
    return 300_000
  }
  return parsed * 1000
}

export async function runPublishDrain(params: {
  worker: ImagePublishWorker
  jobService: ImagePublishJobService | undefined
  skipDbAccess: boolean
  processingEnabled: boolean
  jobsEnv: JobsEnvConfig
  limits: PublishDrainLimits
}): Promise<PublishDrainSummary> {
  const startedAt = Date.now()
  logStructured({ event: "publish_drain_started" })

  if (params.skipDbAccess || !params.jobService) {
    const error = "DATABASE_URL is required for publish:drain"
    logStructured({ event: "publish_drain_failed", error })
    throw new Error(error)
  }

  const pendingAtStart = await params.jobService.countPendingJobs()

  if (pendingAtStart === 0) {
    logStructured({
      event: "publish_drain_noop",
      pending: 0,
      durationMs: Date.now() - startedAt,
    })
    return {
      pendingAtStart: 0,
      pendingAtEnd: 0,
      processed: 0,
      durationMs: Date.now() - startedAt,
      stopReason: "empty",
    }
  }

  if (!params.processingEnabled) {
    logStructured({
      event: "publish_drain_failed",
      error: "IMAGE_PUBLISH_PROCESSING_ENABLED=false but queued publish jobs exist",
      pending: pendingAtStart,
    })
    return {
      pendingAtStart,
      pendingAtEnd: pendingAtStart,
      processed: 0,
      durationMs: Date.now() - startedAt,
      stopReason: "processing_disabled",
    }
  }

  let processed = 0
  let stopReason: PublishDrainSummary["stopReason"] = "empty"

  for (;;) {
    const elapsedMs = Date.now() - startedAt
    if (elapsedMs >= params.limits.maxRuntimeMs) {
      stopReason = "max_runtime"
      break
    }
    if (processed >= params.limits.maxJobs) {
      stopReason = "max_jobs"
      break
    }

    const pendingNow = await params.jobService.countPendingJobs()
    if (pendingNow === 0) {
      stopReason = "empty"
      break
    }

    const iteration = await params.worker.runOnce({
      skipDbAccess: false,
      dryRun: false,
      processingEnabled: true,
      jobsEnv: params.jobsEnv,
    })

    if (iteration.claimedJob) {
      processed += 1
      continue
    }

    if ((iteration.pendingCount ?? 0) > 0) {
      stopReason = "no_progress"
      break
    }

    stopReason = "empty"
    break
  }

  const pendingAtEnd = await params.jobService.countPendingJobs()
  const durationMs = Date.now() - startedAt

  logStructured({
    event: "publish_drain_complete",
    pendingAtStart,
    pendingAtEnd,
    processed,
    durationMs,
    stopReason,
  })

  return {
    pendingAtStart,
    pendingAtEnd,
    processed,
    durationMs,
    stopReason,
  }
}
