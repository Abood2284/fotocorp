import type { Env } from "../../appTypes"

/** Must match `JOBS_WAKE_SECRET_HEADER` in `apps/jobs/src/publishWakeServer.ts`. */
export const JOBS_DRAIN_WEBHOOK_SECRET_HEADER = "x-jobs-wake-secret"

const FIRE_AND_FORGET_TIMEOUT_MS = 5_000
const STAFF_WAKE_TIMEOUT_MS = 120_000

export interface NotifyPublishDrainWebhookParams {
  publishJobId: string
  approvedCount: number
}

export type PublishDrainWakeStatus =
  | "accepted"
  | "already_running"
  | "not_configured"
  | "unreachable"
  | "failed"
  | "processing_disabled"

export interface PublishDrainSummaryHint {
  pendingAtStart: number
  pendingAtEnd: number
  processed: number
  stopReason: string
  durationMs: number
}

export interface PublishDrainWakeResult {
  ok: boolean
  status: PublishDrainWakeStatus
  message: string
  httpStatus?: number
  drainSummary?: PublishDrainSummaryHint
}

interface WakeResponseBody {
  ok?: boolean
  summary?: Partial<PublishDrainSummaryHint>
  waited?: boolean
  error?: string
  message?: string
}

/**
 * Fire-and-forget wake of the VPS jobs drain HTTP server after staff approval enqueues work.
 * Approval must succeed even when the webhook is missing, times out, or returns an error.
 */
export function schedulePublishDrainWebhook(
  env: Env,
  params: NotifyPublishDrainWebhookParams,
  executionCtx?: ExecutionContext,
): void {
  const task = postPublishDrainWebhook(env, params, { waitForCompletion: false })
  if (executionCtx) {
    executionCtx.waitUntil(task)
    return
  }
  void task
}

/** Staff-triggered wake — waits for drain completion and returns actionable diagnostics. */
export async function requestPublishDrainWake(env: Env): Promise<PublishDrainWakeResult> {
  return await postPublishDrainWebhook(
    env,
    { publishJobId: "staff-pipeline-wake", approvedCount: 0 },
    { waitForCompletion: true },
  )
}

export function buildJobsDrainWebhookUrl(
  drainWebhookUrl: string | undefined,
  options?: { waitForCompletion?: boolean },
): string | null {
  const raw = drainWebhookUrl?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (options?.waitForCompletion) url.searchParams.set("wait", "1")
    return url.toString()
  } catch {
    return null
  }
}

export function formatStaffDrainWakeMessage(summary: PublishDrainSummaryHint): PublishDrainWakeResult {
  if (summary.stopReason === "processing_disabled") {
    return {
      ok: false,
      status: "processing_disabled",
      message:
        "Jobs worker reached the queue but processing is disabled. On the VPS set IMAGE_PUBLISH_PROCESSING_ENABLED=true in apps/jobs/.env.production and restart fotocorp-jobs-wake.",
      drainSummary: summary,
    }
  }

  if (summary.processed > 0 && summary.pendingAtEnd < summary.pendingAtStart) {
    return {
      ok: true,
      status: "accepted",
      message: `Processed ${summary.processed} job(s). ${summary.pendingAtEnd} still queued.`,
      drainSummary: summary,
    }
  }

  if (summary.processed > 0 && summary.pendingAtEnd === 0) {
    return {
      ok: true,
      status: "accepted",
      message: `Processed ${summary.processed} job(s). Queue is empty.`,
      drainSummary: summary,
    }
  }

  if (summary.pendingAtStart > 0 && summary.processed === 0) {
    return {
      ok: false,
      status: "failed",
      message: `Drain finished without processing jobs (stopReason=${summary.stopReason}). Check VPS fotocorp-jobs-wake logs for publish_wake_drain_warning or publish_drain_complete.`,
      drainSummary: summary,
    }
  }

  return {
    ok: true,
    status: "accepted",
    message: "Jobs worker drain completed — no pending jobs were found.",
    drainSummary: summary,
  }
}

async function postPublishDrainWebhook(
  env: Env,
  params: NotifyPublishDrainWebhookParams,
  options: { waitForCompletion: boolean },
): Promise<PublishDrainWakeResult> {
  const webhookUrl = buildJobsDrainWebhookUrl(env.JOBS_DRAIN_WEBHOOK_URL, {
    waitForCompletion: options.waitForCompletion,
  })
  const webhookSecret = env.JOBS_DRAIN_WEBHOOK_SECRET?.trim()

  if (!webhookUrl || !webhookSecret) {
    console.warn(
      JSON.stringify({
        event: "publish_drain_webhook_skipped",
        publishJobId: params.publishJobId,
        reason: "JOBS_DRAIN_WEBHOOK_URL or JOBS_DRAIN_WEBHOOK_SECRET is not configured",
      }),
    )
    return {
      ok: false,
      status: "not_configured",
      message: "Jobs worker webhook is not configured on the API. Queued jobs will not run until the worker is triggered manually.",
    }
  }

  const timeoutMs = options.waitForCompletion ? STAFF_WAKE_TIMEOUT_MS : FIRE_AND_FORGET_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("publish_drain_webhook_timeout"), timeoutMs)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        [JOBS_DRAIN_WEBHOOK_SECRET_HEADER]: webhookSecret,
      },
      signal: controller.signal,
    })

    const bodyText = await response.text()
    let body: WakeResponseBody | null = null
    try {
      body = bodyText ? (JSON.parse(bodyText) as WakeResponseBody) : null
    } catch {
      body = null
    }

    if (response.status === 409) {
      console.info(
        JSON.stringify({
          event: "publish_drain_webhook_busy",
          publishJobId: params.publishJobId,
          approvedCount: params.approvedCount,
          status: response.status,
          body: bodyText.slice(0, 500),
        }),
      )
      return {
        ok: true,
        status: "already_running",
        message: "Jobs worker is already processing a drain run.",
        httpStatus: response.status,
      }
    }

    if (response.status === 200 && body?.waited && body.summary) {
      const summary = normalizeDrainSummary(body.summary)
      const formatted = formatStaffDrainWakeMessage(summary)
      console.info(
        JSON.stringify({
          event: "publish_drain_webhook_ok",
          publishJobId: params.publishJobId,
          approvedCount: params.approvedCount,
          status: response.status,
          summary,
        }),
      )
      return { ...formatted, httpStatus: response.status }
    }

    if (response.status === 202 || response.status === 200) {
      console.info(
        JSON.stringify({
          event: "publish_drain_webhook_ok",
          publishJobId: params.publishJobId,
          approvedCount: params.approvedCount,
          status: response.status,
          body: bodyText.slice(0, 200),
        }),
      )
      return {
        ok: true,
        status: "accepted",
        message: options.waitForCompletion
          ? "Jobs worker accepted the drain request but did not return a completion summary."
          : "Jobs worker accepted the drain request. Queued items should start processing shortly.",
        httpStatus: response.status,
      }
    }

    console.error(
      JSON.stringify({
        event: "publish_drain_webhook_failed",
        publishJobId: params.publishJobId,
        approvedCount: params.approvedCount,
        status: response.status,
        body: bodyText.slice(0, 500),
      }),
    )
    return {
      ok: false,
      status: "failed",
      message: body?.message ?? body?.error ?? `Jobs worker returned HTTP ${response.status}.`,
      httpStatus: response.status,
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "publish_drain_webhook_error",
        publishJobId: params.publishJobId,
        approvedCount: params.approvedCount,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
    const timedOut = error instanceof Error && error.message.includes("abort")
    return {
      ok: false,
      status: "unreachable",
      message: timedOut
        ? "Jobs worker drain timed out before completing. Large queues can take several minutes — check VPS logs or run drain with wait=1 on the server."
        : "Could not reach the jobs worker. Check that the VPS wake server is running and reachable.",
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeDrainSummary(raw: Partial<PublishDrainSummaryHint>): PublishDrainSummaryHint {
  return {
    pendingAtStart: raw.pendingAtStart ?? 0,
    pendingAtEnd: raw.pendingAtEnd ?? 0,
    processed: raw.processed ?? 0,
    stopReason: raw.stopReason ?? "unknown",
    durationMs: raw.durationMs ?? 0,
  }
}
