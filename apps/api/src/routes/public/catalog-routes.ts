// apps/api/src/routes/public/catalog-routes.ts
import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { withPublicReadDb } from "../../db";
import { getPublicAssetCollections, getPublicAssetDetail, getPublicAssetEvents, getPublicAssetFilters, listPublicAssets, parsePreviewTtl } from "../../lib/assets/public-assets";
import {
  countPublicCaricatures,
  getPublicCaricatureDetail,
  isUnfilteredCaricatureBrowseQuery,
  listPublicCaricatures,
  shouldUseCaricatureSqlFallback,
} from "../../lib/caricatures/public-caricature-assets";
import { json } from "../../lib/http";
import { resolveRequestId } from "../../lib/latency-trace";
import { parsePublicPreviewCdnConfig } from "../../lib/media/public-preview-cdn-url";
import { methodNotAllowed } from "../../lib/route-errors";
import {
  buildTypesensePublicAssetFilterSummary,
  isTypesenseNotConfiguredError,
  isTypesenseSearchFailedError,
  isTypesenseSearchInputError,
  parseTypesensePublicAssetSearchQuery,
  searchTypesensePublicAssets,
} from "../../lib/search/typesense-public-assets";
import {
  buildTypesenseCaricatureFilterSummary,
  parseTypesenseCaricatureSearchQuery,
  searchTypesenseCaricatures,
} from "../../lib/search/typesense-caricatures";
import { searchTypesensePublicEvents } from "../../lib/search/typesense-public-event-search";

export const publicCatalogRoutes = new Hono<{ Bindings: Env }>();

export const PUBLIC_CATALOG_LIST_CACHE_CONTROL =
  "public, max-age=30, s-maxage=120, stale-while-revalidate=300";

export const PUBLIC_TYPESENSE_SEARCH_CACHE_CONTROL =
  "public, max-age=30, s-maxage=120, stale-while-revalidate=300";

export const PUBLIC_ASSET_DETAIL_CACHE_CONTROL =
  "public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800";

export const PUBLIC_CATALOG_FILTERS_CACHE_CONTROL =
  "public, max-age=300, s-maxage=900, stale-while-revalidate=1800";

const PUBLIC_READ_DB_PATH_HEADER = "x-fotocorp-db-path";
const PUBLIC_READ_DB_PATH = "public-read";

publicCatalogRoutes.get("/api/v1/assets", async (c) => {
  const routeStartedAt = Date.now();
  const requestId = resolveRequestId(c.req.raw.headers);
  const debugEnabled = c.env.HOMEPAGE_DEBUG_LATENCY === "true" || c.req.header("x-homepage-debug-latency") === "true";
  const debugLog = (payload: Record<string, unknown>) => {
    if (!debugEnabled) return;
    console.info(JSON.stringify({
      event: "public_assets_latency_step",
      requestId,
      route: "/api/v1/assets",
      ...payload,
    }));
  };

  const configStartedAt = Date.now();
  const cdn = parsePublicPreviewCdnConfig(c.env);
  debugLog({
    step: "cdn_config_parse_done",
    durationMs: Date.now() - configStartedAt,
    cdnConfigured: Boolean(cdn.baseUrl),
  });

  const result = await withPublicReadDb(c.env, (readDb) => listPublicAssets(
      readDb,
      {
        q: c.req.query("q"),
        categoryId: c.req.query("categoryId"),
        eventId: c.req.query("eventId"),
        contributorId: c.req.query("contributorId") ?? c.req.query("photographerId"),
        year: c.req.query("year"),
        month: c.req.query("month"),
        sort: c.req.query("sort"),
        cursor: c.req.query("cursor"),
        limit: c.req.query("limit"),
      },
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
      cdn,
      debugLog,
  ));
  debugLog({
    step: "route_complete",
    durationMs: Date.now() - routeStartedAt,
    rowCount: result.items.length,
    hasMore: result.hasMore,
  });

  return json(result, 200, { headers: publicReadHeaders({ "Cache-Control": PUBLIC_CATALOG_LIST_CACHE_CONTROL }) });
});

publicCatalogRoutes.all("/api/v1/assets", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/search/assets", async (c) => {
  const route = "/api/v1/search/assets";
  const startedAt = Date.now();
  let q = "*";
  let page = 1;
  let limit = 50;
  let filters = "";

  try {
    const query = parseTypesensePublicAssetSearchQuery(new URL(c.req.url).searchParams);
    q = query.q;
    page = query.page;
    limit = query.limit;
    filters = buildTypesensePublicAssetFilterSummary(query);

    const response = await searchTypesensePublicAssets(c.env, query);
    const durationMs = Date.now() - startedAt;

    console.info(
      JSON.stringify({
        event: "typesense_public_asset_search",
        route,
        durationMs,
        status: "ok",
        statusCode: 200,
        backend: "typesense",
        q,
        filters,
        page,
        limit,
        found: response.total,
        hits: response.items.length,
        facetCount:
          response.facets.categories.length +
          response.facets.events.length +
          response.facets.cities.length +
          response.facets.sources.length,
        tookMs: response.timing.tookMs,
        timeout: false,
      }),
    );

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_TYPESENSE_SEARCH_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isTypesenseNotConfiguredError(error)) {
      console.error(
        JSON.stringify({
          event: "typesense_public_asset_search",
          route,
          durationMs,
          status: "error",
          statusCode: 503,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          timeout: false,
        }),
      );
      return json({ error: "typesense_not_configured" }, 503);
    }

    if (isTypesenseSearchInputError(error)) {
      console.warn(
        JSON.stringify({
          event: "typesense_public_asset_search",
          route,
          durationMs,
          status: "error",
          statusCode: 400,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          timeout: false,
          error: error.code,
        }),
      );
      return json({ error: error.code }, 400);
    }

    if (isTypesenseSearchFailedError(error)) {
      console.error(
        JSON.stringify({
          event: "typesense_public_asset_search",
          route,
          durationMs,
          status: "error",
          statusCode: 502,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          tookMs: durationMs,
          timeout: error.timedOut,
          upstreamStatusCode: error.statusCode ?? null,
        }),
      );
      return json({ error: "typesense_search_failed" }, 502);
    }

    throw error;
  }
});

publicCatalogRoutes.all("/api/v1/search/assets", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/search/caricatures", async (c) => {
  const route = "/api/v1/search/caricatures";
  const startedAt = Date.now();
  let q = "*";
  let page = 1;
  let limit = 50;
  let filters = "";
  let backend: "typesense" | "postgres" = "typesense";

  try {
    const query = parseTypesenseCaricatureSearchQuery(new URL(c.req.url).searchParams);
    q = query.q;
    page = query.page;
    limit = query.limit;
    filters = buildTypesenseCaricatureFilterSummary(query);

    let response = await searchTypesenseCaricatures(c.env, query);

    if (isUnfilteredCaricatureBrowseQuery(query)) {
      const sqlFallback = await withPublicReadDb(c.env, async (readDb) => {
        const postgresTotal = await countPublicCaricatures(readDb, query);
        if (!shouldUseCaricatureSqlFallback(query, response.total, postgresTotal)) {
          return null;
        }
        return listPublicCaricatures(readDb, query);
      });
      if (sqlFallback) {
        response = sqlFallback;
        backend = "postgres";
      }
    }

    const durationMs = Date.now() - startedAt;

    console.info(
      JSON.stringify({
        event: "typesense_public_caricature_search",
        route,
        durationMs,
        status: "ok",
        statusCode: 200,
        backend,
        q,
        filters,
        page,
        limit,
        found: response.total,
        hits: response.items.length,
        facetCount:
          response.facets.categories.length +
          response.facets.languages.length +
          response.facets.credits.length +
          response.facets.hasVisibleText.length +
          response.facets.depictedSubjects.length,
        tookMs: response.timing.tookMs,
        timeout: false,
      }),
    );

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_TYPESENSE_SEARCH_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isTypesenseNotConfiguredError(error) || isTypesenseSearchFailedError(error)) {
      try {
        const query = parseTypesenseCaricatureSearchQuery(new URL(c.req.url).searchParams);
        const response = await withPublicReadDb(c.env, (readDb) => listPublicCaricatures(readDb, query));
        console.warn(
          JSON.stringify({
            event: "typesense_public_caricature_search",
            route,
            durationMs: Date.now() - startedAt,
            status: "ok",
            statusCode: 200,
            backend: "postgres",
            q: query.q,
            filters: buildTypesenseCaricatureFilterSummary(query),
            page: query.page,
            limit: query.limit,
            found: response.total,
            hits: response.items.length,
            fallbackReason: isTypesenseNotConfiguredError(error) ? "typesense_not_configured" : "typesense_search_failed",
          }),
        );
        return json(response, 200, {
          headers: {
            "Cache-Control": PUBLIC_TYPESENSE_SEARCH_CACHE_CONTROL,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (fallbackError) {
        console.error(
          JSON.stringify({
            event: "typesense_public_caricature_search",
            route,
            durationMs,
            status: "error",
            statusCode: 502,
            backend: "postgres",
            q,
            filters,
            page,
            limit,
            errorMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          }),
        );
        return json({ error: "caricature_search_failed" }, 502);
      }
    }

    if (isTypesenseSearchInputError(error)) {
      console.warn(
        JSON.stringify({
          event: "typesense_public_caricature_search",
          route,
          durationMs,
          status: "error",
          statusCode: 400,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          timeout: false,
          error: error.code,
        }),
      );
      return json({ error: error.code }, 400);
    }

    throw error;
  }
});

publicCatalogRoutes.all("/api/v1/search/caricatures", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/search/events", async (c) => {
  const route = "/api/v1/search/events";
  const startedAt = Date.now();
  let q = "*";
  let page = 1;
  let limit = 25;
  let filters = "";

  try {
    const query = parseTypesensePublicAssetSearchQuery(new URL(c.req.url).searchParams);
    q = query.q;
    page = query.page;
    limit = query.limit;
    filters = buildTypesensePublicAssetFilterSummary(query);

    const response = await searchTypesensePublicEvents(c.env, query);
    const durationMs = Date.now() - startedAt;

    console.info(
      JSON.stringify({
        event: "typesense_public_event_search",
        route,
        durationMs,
        status: "ok",
        statusCode: 200,
        backend: "typesense",
        q,
        filters,
        page,
        limit,
        foundEvents: response.foundEvents,
        hits: response.items.length,
        tookMs: response.timing.tookMs,
        timeout: false,
      }),
    );

    return json(response, 200, {
      headers: {
        "Cache-Control": PUBLIC_TYPESENSE_SEARCH_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isTypesenseNotConfiguredError(error)) {
      console.error(
        JSON.stringify({
          event: "typesense_public_event_search",
          route,
          durationMs,
          status: "error",
          statusCode: 503,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          timeout: false,
        }),
      );
      return json({ error: "typesense_not_configured" }, 503);
    }

    if (isTypesenseSearchInputError(error)) {
      console.warn(
        JSON.stringify({
          event: "typesense_public_event_search",
          route,
          durationMs,
          status: "error",
          statusCode: 400,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          timeout: false,
          error: error.code,
        }),
      );
      return json({ error: error.code }, 400);
    }

    if (isTypesenseSearchFailedError(error)) {
      console.error(
        JSON.stringify({
          event: "typesense_public_event_search",
          route,
          durationMs,
          status: "error",
          statusCode: 502,
          backend: "typesense",
          q,
          filters,
          page,
          limit,
          tookMs: durationMs,
          timeout: error.timedOut,
          upstreamStatusCode: error.statusCode ?? null,
        }),
      );
      return json({ error: "typesense_search_failed" }, 502);
    }

    throw error;
  }
});

publicCatalogRoutes.all("/api/v1/search/events", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/filters", async (c) => {
  const includeCounts = c.req.query("includeCounts") === "true";
  return json(await withPublicReadDb(c.env, (readDb) => getPublicAssetFilters(readDb, { includeCounts })), 200, {
    headers: publicReadHeaders({ "Cache-Control": PUBLIC_CATALOG_FILTERS_CACHE_CONTROL }),
  });
});

publicCatalogRoutes.all("/api/v1/assets/filters", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/collections", async (c) => {
  const cdn = parsePublicPreviewCdnConfig(c.env);
  return json(
    await withPublicReadDb(c.env, (readDb) => getPublicAssetCollections(
      readDb,
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
      cdn,
    )),
    200,
    { headers: publicReadHeaders() },
  );
});

publicCatalogRoutes.all("/api/v1/assets/collections", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/events", async (c) => {
  const cdn = parsePublicPreviewCdnConfig(c.env);
  return json(
    await withPublicReadDb(c.env, (readDb) => getPublicAssetEvents(
      readDb,
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
      cdn,
    )),
    200,
    { headers: publicReadHeaders() },
  );
});

publicCatalogRoutes.all("/api/v1/assets/events", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/:assetId", async (c) => {
  const cdn = parsePublicPreviewCdnConfig(c.env);
  return json(
    await withPublicReadDb(c.env, (readDb) => getPublicAssetDetail(
      readDb,
      c.req.param("assetId"),
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
      cdn,
    )),
    200,
    {
      headers: publicReadHeaders({
        "Cache-Control": PUBLIC_ASSET_DETAIL_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      }),
    },
  );
});

publicCatalogRoutes.all("/api/v1/assets/:assetId", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/caricatures/:assetId", async (c) => {
  return json(
    await withPublicReadDb(c.env, (readDb) => getPublicCaricatureDetail(readDb, c.req.param("assetId"))),
    200,
    {
      headers: publicReadHeaders({
        "Cache-Control": PUBLIC_ASSET_DETAIL_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      }),
    },
  );
});

publicCatalogRoutes.all("/api/v1/caricatures/:assetId", () => methodNotAllowed());

function ttl(env: Env) {
  return parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS);
}

function publicReadHeaders(headers: Record<string, string> = {}) {
  return {
    ...headers,
    [PUBLIC_READ_DB_PATH_HEADER]: PUBLIC_READ_DB_PATH,
  };
}
