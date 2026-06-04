import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { URL } from "node:url"

import { executePublishDrain } from "./executePublishDrain"
import { secretHeaderMatches } from "./lib/secretCompare"
import type { PublishDrainSummary } from "./publishDrain"

export const JOBS_WAKE_SECRET_HEADER = "x-jobs-wake-secret"
export const PUBLISH_DRAIN_WAKE_PATH = "/internal/publish/drain"

export interface PublishWakeServerConfig {
  bindHost: string
  port: number
  wakeSecret: string
}

interface DrainHandle {
  promise: Promise<PublishDrainSummary>
  startedAt: string
}

let activeDrain: DrainHandle | undefined

function logStructured(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function readBindHost(): string {
  const raw = process.env.JOBS_WAKE_BIND_HOST?.trim()
  if (!raw) return "0.0.0.0"
  return raw
}

function readPort(): number {
  const raw = process.env.JOBS_WAKE_PORT
  if (raw === undefined || raw === "") return 18_765
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65_535) {
    console.log(`[fotocorp-jobs] warn: invalid JOBS_WAKE_PORT=${JSON.stringify(raw)}; using 18765`)
    return 18_765
  }
  return parsed
}

export function requireJobsWakeSecret(): string {
  const raw = process.env.JOBS_WAKE_SECRET?.trim()
  if (!raw) {
    throw new Error("[fotocorp-jobs] JOBS_WAKE_SECRET is required for publish:wake")
  }
  return raw
}

export function readPublishWakeServerConfig(): PublishWakeServerConfig {
  return {
    bindHost: readBindHost(),
    port: readPort(),
    wakeSecret: requireJobsWakeSecret(),
  }
}

function writeJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  })
  res.end(payload)
}

function isDrainInProgress(): boolean {
  return activeDrain !== undefined
}

function startBackgroundDrain(): DrainHandle {
  const startedAt = new Date().toISOString()
  const promise = executePublishDrain()
    .then((summary) => {
      logStructured({
        event: "publish_wake_drain_finished",
        startedAt,
        ...summary,
      })
      if (summary.stopReason === "processing_disabled" && summary.pendingAtStart > 0) {
        logStructured({
          event: "publish_wake_drain_warning",
          message: "queued jobs remain because IMAGE_PUBLISH_PROCESSING_ENABLED=false",
        })
      }
      return summary
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logStructured({ event: "publish_drain_failed", error: message, startedAt })
      throw error
    })
    .finally(() => {
      if (activeDrain?.promise === promise) activeDrain = undefined
    })

  const handle: DrainHandle = { promise, startedAt }
  activeDrain = handle
  return handle
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function readWakeSecretHeader(req: IncomingMessage): string | null {
  const raw = req.headers[JOBS_WAKE_SECRET_HEADER]
  if (raw === undefined) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function authorizeWake(req: IncomingMessage, config: PublishWakeServerConfig): boolean {
  return secretHeaderMatches(readWakeSecretHeader(req), config.wakeSecret)
}

async function handleDrainPost(
  req: IncomingMessage,
  res: ServerResponse,
  config: PublishWakeServerConfig,
  url: URL
): Promise<void> {
  if (!authorizeWake(req, config)) {
    writeJson(res, 401, { ok: false, error: "unauthorized" })
    return
  }

  if (isDrainInProgress()) {
    writeJson(res, 409, {
      ok: false,
      error: "drain_in_progress",
      startedAt: activeDrain?.startedAt,
    })
    return
  }

  const waitForCompletion =
    url.searchParams.get("wait") === "1" || url.searchParams.get("wait") === "true"

  logStructured({ event: "publish_wake_drain_accepted", wait: waitForCompletion })

  const handle = startBackgroundDrain()

  if (!waitForCompletion) {
    writeJson(res, 202, {
      ok: true,
      accepted: true,
      startedAt: handle.startedAt,
    })
    return
  }

  try {
    const summary = await handle.promise
    writeJson(res, 200, {
      ok: true,
      accepted: true,
      waited: true,
      summary,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    writeJson(res, 500, { ok: false, error: "drain_failed", message })
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: PublishWakeServerConfig
): Promise<void> {
  const host = req.headers.host ?? `127.0.0.1:${config.port}`
  const url = new URL(req.url ?? "/", `http://${host}`)

  if (req.method === "GET" && url.pathname === "/health") {
    writeJson(res, 200, {
      ok: true,
      drainInProgress: isDrainInProgress(),
    })
    return
  }

  if (req.method === "POST" && url.pathname === PUBLISH_DRAIN_WAKE_PATH) {
    await readBody(req)
    await handleDrainPost(req, res, config, url)
    return
  }

  writeJson(res, 404, { ok: false, error: "not_found" })
}

export function startPublishWakeServer(config: PublishWakeServerConfig): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    void handleRequest(req, res, config).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logStructured({ event: "publish_wake_request_failed", error: message })
      if (!res.headersSent) writeJson(res, 500, { ok: false, error: "internal_error" })
    })
  })

  server.listen(config.port, config.bindHost, () => {
    logStructured({
      event: "publish_wake_listening",
      bindHost: config.bindHost,
      port: config.port,
      path: PUBLISH_DRAIN_WAKE_PATH,
    })
  })

  return server
}

export async function main(): Promise<void> {
  const config = readPublishWakeServerConfig()
  const server = startPublishWakeServer(config)

  const shutdown = () => {
    logStructured({ event: "publish_wake_shutting_down" })
    server.close()
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}
