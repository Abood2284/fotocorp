import { loadJobsEnv } from "./config/env"
import { ImagePublishJobService } from "./services/imagePublishJobService"
import { ImagePublishWorker } from "./workers/imagePublishWorker"

type JobsCliMode = "dry-run" | "once" | "worker"

function parseMode(argv: string[]): JobsCliMode {
  if (argv.includes("--worker")) return "worker"
  if (argv.includes("--once")) return "once"
  return "dry-run"
}

function readWorkerPollIntervalMs(): number {
  const raw = process.env.IMAGE_PUBLISH_POLL_INTERVAL_MS
  if (raw === undefined || raw === "") return 15_000
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1000) {
    console.log(
      `[fotocorp-jobs] warn: invalid IMAGE_PUBLISH_POLL_INTERVAL_MS=${JSON.stringify(raw)}; using 15000`
    )
    return 15_000
  }
  return parsed
}

function readWorkerConcurrency(): number {
  const raw = process.env.IMAGE_PUBLISH_WORKER_CONCURRENCY
  if (raw === undefined || raw === "") return 1
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.log(
      `[fotocorp-jobs] warn: invalid IMAGE_PUBLISH_WORKER_CONCURRENCY=${JSON.stringify(raw)}; using 1`
    )
    return 1
  }
  return parsed
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const mode = parseMode(argv)

  console.log("[fotocorp-jobs] starting node worker")
  console.log(`[fotocorp-jobs] mode=${mode}`)

  const dryRun = mode === "dry-run"
  loadJobsEnv(dryRun)

  const jobService = new ImagePublishJobService()
  const worker = new ImagePublishWorker(jobService)

  if (mode === "worker") {
    const pollIntervalMs = readWorkerPollIntervalMs()
    const concurrency = readWorkerConcurrency()
    console.log(
      `[fotocorp-jobs] worker loop pollIntervalMs=${pollIntervalMs} concurrency=${concurrency} (concurrency reserved for future parallel item processing)`
    )

    for (;;) {
      try {
        await worker.runOnce({ dryRun: false })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[fotocorp-jobs] worker iteration failed: ${message}`)
        console.error(error)
        process.exitCode = 1
        throw error
      }

      console.log(`[fotocorp-jobs] worker sleeping ${pollIntervalMs}ms`)
      await sleep(pollIntervalMs)
    }
  }

  await worker.runOnce({ dryRun })

  console.log("[fotocorp-jobs] done")
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
