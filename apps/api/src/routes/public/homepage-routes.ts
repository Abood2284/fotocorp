import { Hono, type Context } from "hono"
import type { Env } from "../../appTypes"
import { withPublicReadDb, type AppRequestVariables } from "../../db"
import {
  buildEventCategoryBrowseResponse,
  buildLatestEventsResponse,
  fetchPublicEventCategoryBrowseRows,
  fetchPublicLatestEventsRows,
  getPublicHomepageFeed,
  parseEventCategoryBrowseQuery,
  parseLatestEventsQuery,
} from "../../lib/assets/public-homepage"
import {
  buildLatestCaricaturesResponse,
  fetchPublicLatestCaricaturesRows,
  parseLatestCaricaturesQuery,
} from "../../lib/caricatures/public-homepage-caricatures"
import {
  getPublicHomepageHeroSet,
  PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL,
} from "../../lib/assets/public-homepage-hero-set"
import { listPublicRoyaltyFreeFeaturedAssets, parsePreviewTtl } from "../../lib/assets/public-assets"
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

export const PUBLIC_ROYALTY_FREE_FEATURED_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800"

/** @deprecated Use {@link PUBLIC_ROYALTY_FREE_FEATURED_CACHE_CONTROL}. */
export const PUBLIC_CREATIVE_FEATURED_CACHE_CONTROL = PUBLIC_ROYALTY_FREE_FEATURED_CACHE_CONTROL

export const PUBLIC_EVENT_CATEGORY_BROWSE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400"

const PUBLIC_READ_DB_PATH_HEADER = "x-fotocorp-db-path"
const PUBLIC_READ_DB_PATH = "public-read"

publicHomepageRoutes.get("/api/v1/public/homepage", async (c) => {
  const startedAt = Date.now()

  try {
    const cdn = parsePublicPreviewCdnConfig(c.env)
    const feed = await withPublicReadDb(c.env, (readDb) => getPublicHomepageFeed(readDb, cdn))
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
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
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
    section: searchParams.get("section"),
  }

  try {
    const cdn = parsePublicPreviewCdnConfig(c.env)
    const query = parseLatestEventsQuery(input)
    tracker.mark("parse")
    const { rows, dbTrace } = await withPublicReadDb(c.env, (readDb) => fetchPublicLatestEventsRows(readDb, query))
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
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
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

publicHomepageRoutes.get("/api/v1/public/caricatures/latest", async (c) => {
  const requestId = c.get("requestId")
  const route = "/api/v1/public/caricatures/latest"
  const tracker = createTimingTracker()
  const searchParams = new URL(c.req.url).searchParams
  const input = {
    windowDays: searchParams.get("windowDays"),
    limit: searchParams.get("limit"),
    cursor: searchParams.get("cursor"),
  }

  try {
    const query = parseLatestCaricaturesQuery(input)
    tracker.mark("parse")
    const { rows, dbTrace } = await withPublicReadDb(c.env, (readDb) =>
      fetchPublicLatestCaricaturesRows(readDb, query),
    )
    tracker.mark("db")
    const response = buildLatestCaricaturesResponse(rows, query)
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
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
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

publicHomepageRoutes.get("/api/v1/public/events/browse", async (c) => {
  const startedAt = Date.now()
  const searchParams = new URL(c.req.url).searchParams
  const input = {
    limit: searchParams.get("limit"),
    cursor: searchParams.get("cursor"),
    section: searchParams.get("section"),
  }

  try {
    const cdn = parsePublicPreviewCdnConfig(c.env)
    const query = parseEventCategoryBrowseQuery(input)
    const { rows } = await withPublicReadDb(c.env, (readDb) => fetchPublicEventCategoryBrowseRows(readDb, query))
    const response = buildEventCategoryBrowseResponse(rows, query, cdn)
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        event: "public_event_category_browse",
        section: query.section,
        limit: query.limit,
        hasCursor: Boolean(query.cursor),
        rowCount: response.items.length,
        hasMore: response.hasMore,
        durationMs,
        cacheMode: "category-browse-photo-events",
      }),
    )

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_EVENT_CATEGORY_BROWSE_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    console.error(
      JSON.stringify({
        event: "public_event_category_browse",
        status: "error",
        hasCursor: Boolean(input.cursor),
        durationMs,
        error: serialized,
      }),
    )

    throw error
  }
})

publicHomepageRoutes.get("/api/v1/public/homepage/hero-set", async (c) => {
  const startedAt = Date.now()
  const route = "/api/v1/public/homepage/hero-set"

  try {
    const cdn = parsePublicPreviewCdnConfig(c.env)
    const response = await withPublicReadDb(c.env, (readDb) => getPublicHomepageHeroSet(readDb, cdn))
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        event: "homepage_hero_set_request",
        route,
        durationMs,
        status: "ok",
        itemCount: response.items.length,
        setKey: response.setKey,
        cacheControl: PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL,
      }),
    )

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    console.error(
      JSON.stringify({
        event: "homepage_hero_set_request",
        route,
        durationMs,
        status: "error",
        error: serialized,
      }),
    )

    throw error
  }
})

async function handleRoyaltyFreeFeaturedRequest(
  c: Context<{ Bindings: Env; Variables: AppRequestVariables }>,
  options: { route: string; legacyRoute: boolean },
) {
  const startedAt = Date.now()
  const { route, legacyRoute } = options

  try {
    const cdn = parsePublicPreviewCdnConfig(c.env)
    const { response, timings } = await withPublicReadDb(c.env, (readDb) => listPublicRoyaltyFreeFeaturedAssets(
      readDb,
      { limit: c.req.query("limit") },
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      parsePreviewTtl(c.env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS),
      cdn,
    ))
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        event: "public_royalty_free_featured_request",
        route,
        legacyRoute,
        durationMs,
        status: "ok",
        itemCount: response.items.length,
        cacheControl: PUBLIC_ROYALTY_FREE_FEATURED_CACHE_CONTROL,
        timings,
      }),
    )

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_ROYALTY_FREE_FEATURED_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
        [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }

    console.error(
      JSON.stringify({
        event: "public_royalty_free_featured_request",
        route,
        legacyRoute,
        durationMs,
        status: "error",
        error: serialized,
      }),
    )

    throw error
  }
}

publicHomepageRoutes.get("/api/v1/public/royalty-free/featured", (c) =>
  handleRoyaltyFreeFeaturedRequest(c, {
    route: "/api/v1/public/royalty-free/featured",
    legacyRoute: false,
  }))

publicHomepageRoutes.get("/api/v1/public/creative/featured", (c) =>
  handleRoyaltyFreeFeaturedRequest(c, {
    route: "/api/v1/public/creative/featured",
    legacyRoute: true,
  }))

publicHomepageRoutes.all("/api/v1/public/homepage", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/homepage/hero-set", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/events/latest", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/caricatures/latest", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/events/browse", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/royalty-free/featured", () => methodNotAllowed())
publicHomepageRoutes.all("/api/v1/public/creative/featured", () => methodNotAllowed())
