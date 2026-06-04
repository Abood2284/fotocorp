import type { Env } from "../../appTypes"

/** Must match `JOBS_WAKE_SECRET_HEADER` in `apps/jobs/src/publishWakeServer.ts`. */
export const JOBS_DRAIN_WEBHOOK_SECRET_HEADER = "x-jobs-wake-secret"

const DEFAULT_TIMEOUT_MS = 5_000

export interface NotifyPublishDrainWebhookParams {
  publishJobId: string
  approvedCount: number
}

/**
 * Fire-and-forget wake of the VPS jobs drain HTTP server after staff approval enqueues work.
 * Approval must succeed even when the webhook is missing, times out, or returns an error.
 */
export function schedulePublishDrainWebhook(
  env: Env,
  params: NotifyPublishDrainWebhookParams,
): void {
  void notifyPublishDrainWebhook(env, params)
}

async function notifyPublishDrainWebhook(
  env: Env,
  params: NotifyPublishDrainWebhookParams,
): Promise<void> {
  const webhookUrl = env.JOBS_DRAIN_WEBHOOK_URL?.trim()
  const webhookSecret = env.JOBS_DRAIN_WEBHOOK_SECRET?.trim()

  if (!webhookUrl || !webhookSecret) {
    console.warn(
      JSON.stringify({
        event: "publish_drain_webhook_skipped",
        publishJobId: params.publishJobId,
        reason: "JOBS_DRAIN_WEBHOOK_URL or JOBS_DRAIN_WEBHOOK_SECRET is not configured",
      }),
    )
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("publish_drain_webhook_timeout"), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        [JOBS_DRAIN_WEBHOOK_SECRET_HEADER]: webhookSecret,
      },
      signal: controller.signal,
    })

    const body = await response.text()

    if (response.status === 202 || response.status === 200) {
      console.info(
        JSON.stringify({
          event: "publish_drain_webhook_ok",
          publishJobId: params.publishJobId,
          approvedCount: params.approvedCount,
          status: response.status,
          body: body.slice(0, 200),
        }),
      )
      return
    }

    if (response.status === 409) {
      console.info(
        JSON.stringify({
          event: "publish_drain_webhook_busy",
          publishJobId: params.publishJobId,
          approvedCount: params.approvedCount,
          status: response.status,
          body: body.slice(0, 200),
        }),
      )
      return
    }

    console.error(
      JSON.stringify({
        event: "publish_drain_webhook_failed",
        publishJobId: params.publishJobId,
        approvedCount: params.approvedCount,
        status: response.status,
        body: body.slice(0, 200),
      }),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "publish_drain_webhook_error",
        publishJobId: params.publishJobId,
        approvedCount: params.approvedCount,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}
