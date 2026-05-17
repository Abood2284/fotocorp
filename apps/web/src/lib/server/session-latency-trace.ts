import "server-only"

import { headers } from "next/headers"
import { createTimingTracker, logLatencyTrace, resolveRequestIdFromHeaders } from "@/lib/latency-trace"

export async function traceHomepageSessionCall<T>(
  route: string,
  run: () => Promise<T>,
): Promise<T> {
  const headerStore = await headers()
  const requestId = resolveRequestIdFromHeaders(headerStore) ?? crypto.randomUUID()
  const tracker = createTimingTracker()

  try {
    const result = await run()
    const durationMs = tracker.total()
    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route,
      status: "ok",
      statusCode: 200,
      durationMs,
      timings: { total: durationMs },
      cache: { mode: "session", hit: false, cacheControl: null },
    })
    return result
  } catch (error) {
    const durationMs = tracker.total()
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route,
      status: "error",
      statusCode: 500,
      durationMs,
      timings: { total: durationMs },
      cache: { mode: "session", hit: false, cacheControl: null },
      error: serialized,
    })
    throw error
  }
}
