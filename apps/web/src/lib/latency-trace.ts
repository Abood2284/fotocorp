export const FOTOCORP_REQUEST_ID_HEADER = "x-fotocorp-request-id"
const LEGACY_REQUEST_ID_HEADER = "x-request-id"

export interface LatencyTraceLog {
  event: "latency_trace"
  requestId: string
  layer: "web" | "browser"
  route: string
  status: "ok" | "error"
  statusCode: number
  durationMs: number
  timings: Record<string, number>
  cache?: {
    mode: string
    hit: boolean
    cacheControl: string | null
  }
  error?: {
    name: string
    message: string
    upstreamPath?: string
    abortReason?: string
  }
}

export function resolveRequestId(request?: Request | null): string {
  if (request) {
    const fromRequest = resolveRequestIdFromHeaders(request.headers)
    if (fromRequest) return fromRequest
  }
  return crypto.randomUUID()
}

export function resolveRequestIdFromHeaders(headers: Headers): string | null {
  const fotocorp = headers.get(FOTOCORP_REQUEST_ID_HEADER)?.trim()
  if (fotocorp) return fotocorp
  const legacy = headers.get(LEGACY_REQUEST_ID_HEADER)?.trim()
  if (legacy) return legacy
  return null
}

export function requestIdHeaders(requestId: string): Record<string, string> {
  return {
    [FOTOCORP_REQUEST_ID_HEADER]: requestId,
    [LEGACY_REQUEST_ID_HEADER]: requestId,
  }
}

export function createTimingTracker(startedAt = Date.now()) {
  const marks = new Map<string, number>()
  let lastMarkAt = startedAt

  return {
    mark(name: string) {
      const now = Date.now()
      marks.set(name, now - lastMarkAt)
      lastMarkAt = now
    },
    elapsed(name: string) {
      return marks.get(name) ?? 0
    },
    timings(): Record<string, number> {
      return Object.fromEntries(marks.entries())
    },
    total() {
      return Date.now() - startedAt
    },
  }
}

export function formatServerTiming(timings: Record<string, number>, totalMs: number): string {
  const parts = Object.entries(timings).map(([name, duration]) => `${name};dur=${duration}`)
  parts.push(`total;dur=${totalMs}`)
  return parts.join(", ")
}

export function logLatencyTrace(payload: LatencyTraceLog): void {
  const line = JSON.stringify(payload)
  if (payload.status === "error") console.error(line)
  else console.info(line)
}

export function serializeFetchError(error: unknown): {
  name: string
  message: string
  abortReason?: string
} {
  if (error instanceof Error) {
    const abortReason =
      error.name === "AbortError" && "cause" in error && error.cause instanceof Error
        ? error.cause.message
        : error.name === "AbortError"
          ? error.message
          : undefined
    return {
      name: error.name,
      message: error.message,
      ...(abortReason ? { abortReason } : {}),
    }
  }

  return { name: "UnknownError", message: String(error) }
}

export function upstreamPathOnly(url: string): string {
  try {
    return new URL(url).pathname + new URL(url).search
  } catch {
    return url
  }
}
