import { Hono } from "hono"
import type { Env } from "../../appTypes"
import { createHttpDb, type AppRequestVariables } from "../../db"
import {
  buildLatestEventsResponse,
  fetchPublicLatestEventsRows,
  getPublicHomepageFeed,
  parseLatestEventsQuery,
} from "../../lib/assets/public-homepage"
import { AppError } from "../../lib/errors"
import {
  createTimingTracker,
  formatServerTiming,
  FOTOCORP_REQUEST_ID_HEADER,
  logLatencyTrace,
} from "../../lib/latency-trace"
import { json } from "../../lib/http"
import { parsePublicPreviewCdnConfig } from "../../lib/media/public-preview-cdn-url"
import { methodNotAllowed } from "../../lib/route-errors"

export const publicHomepageRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

export const PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"

publicHomepageRoutes.get("/api/v1/public/homepage", async (c) => {
  const startedAt = Date.now()

  try {
    if (!c.env.DATABASE_URL) {
      throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
    }

    const cdn = parsePublicPreviewCdnConfig(c.env)
    const feed = await getPublicHomepageFeed(createHttpDb(c.env.DATABASE_URL), cdn)
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        event: "homepage_feed_request",
        mode: "lightweight",
        durationMs,
        latestEventsPreviewCount: feed.latestEventsPreview.items.length,
        status: "ok",
      }),
    )

    return json(feed, 200, {
      headers: {
        "Cache-Control": PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const reason = error instanceof AppError ? error.code : error instanceof Error ? error.message : "UNKNOWN"

    console.error(
      JSON.stringify({
        event: "homepage_feed_request",
        mode: "lightweight",
        durationMs,
        latestEventsPreviewCount: 0,
        status: "error",
        errorMessage: reason,
      }),
    )

    throw error
  }
})

publicHomepageRoutes.get("/api/v1/public/events/latest", async (c) => {
  const requestId = c.get("requestId")
  const route = "/api/v1/public/events/latest"
  const tracker = createTimingTracker()
  const searchParams = new URL(c.req.url).searchParams
  const input = {
    windowDays: searchParams.get("windowDays"),
    limit: searchParams.get("limit"),
    cursor: searchParams.get("cursor"),
  }

  try {
    if (!c.env.DATABASE_URL) {
      throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
    }

    const cdn = parsePublicPreviewCdnConfig(c.env)
    const db = createHttpDb(c.env.DATABASE_URL)
    const query = parseLatestEventsQuery(input)
    tracker.mark("parse")
    const { rows, dbTrace } = await fetchPublicLatestEventsRows(db, query)
    tracker.mark("db")
    const response = buildLatestEventsResponse(rows, query, cdn)
    tracker.mark("map")
    tracker.mark("response_build")

    const durationMs = tracker.total()
    const segmentTimings = {
      parse: tracker.elapsed("parse"),
      db: dbTrace.dbMs,
      map: tracker.elapsed("map"),
      response_build: tracker.elapsed("response_build"),
    }
    const timings = { ...segmentTimings, total: durationMs }

    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "api",
      route,
      status: "ok",
      statusCode: 200,
      durationMs,
      timings,
      cache: {
        mode: "public-feed",
        hit: false,
        cacheControl: PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL,
      },
      db: dbTrace,
    })

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        [FOTOCORP_REQUEST_ID_HEADER]: requestId,
        "Server-Timing": formatServerTiming(segmentTimings, durationMs),
      },
    })
  } catch (error) {
    const durationMs = tracker.total()
    const timings = {
      parse: tracker.elapsed("parse"),
      db: tracker.elapsed("db"),
      map: tracker.elapsed("map"),
      response_build: tracker.elapsed("response_build"),
      total: durationMs,
    }
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "api",
      route,
      status: "error",
      statusCode: error instanceof AppError ? error.status : 500,
      durationMs,
      timings,
      cache: {
        mode: "public-feed",
        hit: false,
        cacheControl: PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL,
      },
      error: serialized,
    })

    throw error
  }
})

publicHomepageRoutes.all("/api/v1/public/homepage", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/events/latest", () => methodNotAllowed())
