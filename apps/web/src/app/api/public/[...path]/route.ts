// apps/web/src/app/api/public/[...path]/route.ts
import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { NextRequest } from "next/server"
import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"
import { tracedUpstreamProxy } from "@/lib/server/latency-proxy"

interface RouteContext {
  params: Promise<{
    path?: string[]
  }>
}

const PUBLIC_UPSTREAM_BY_BFF_PATH: Record<string, string> = {
  assets: "/api/v1/assets",
  "assets/filters": "/api/v1/assets/filters",
  "search/assets": "/api/v1/search/assets",
  "events/latest": "/api/v1/public/events/latest",
  "creative/featured": "/api/v1/public/creative/featured",
}

const PUBLIC_EVENTS_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
const PUBLIC_SEARCH_CACHE_CONTROL =
  "public, max-age=30, s-maxage=120, stale-while-revalidate=300"
const PUBLIC_CREATIVE_FEATURED_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800"
const PUBLIC_ASSET_DETAIL_CACHE_CONTROL =
  "public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800"

type CloudflareServiceBinding = {
  fetch: typeof fetch
}

function getProductionApiServiceBinding(): CloudflareServiceBinding | null {
  if (process.env.NODE_ENV !== "production") return null

  try {
    const { env } = getCloudflareContext()
    const binding = (env as { FOTOCORP_API?: CloudflareServiceBinding }).FOTOCORP_API
    return binding?.fetch ? binding : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handlePublicProxy(request, context, { responseBody: true })
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return handlePublicProxy(request, context, { responseBody: false })
}

async function handlePublicProxy(
  request: NextRequest,
  context: RouteContext,
  options: { responseBody: boolean },
) {
  const params = await context.params
  const bffPath = params.path?.join("/") ?? ""
  const upstreamBase = resolvePublicUpstreamBase(bffPath)
  if (!upstreamBase) {
    return Response.json(
      {
        error: {
          code: "ROUTE_NOT_FOUND",
          message: `Public API proxy path '/api/public/${bffPath}' was not found.`,
        },
      },
      { status: 404 },
    )
  }

  const query = request.nextUrl.search
  const upstreamPath = `${upstreamBase}${query}`
  const apiServiceBinding = getProductionApiServiceBinding()
  const upstreamUrl = apiServiceBinding ? `https://fotocorp-api${upstreamPath}` : buildApiAssetUrl(upstreamPath)
  const upstreamFetch = apiServiceBinding ? apiServiceBinding.fetch.bind(apiServiceBinding) : undefined

  const isAssetList = bffPath === "assets"
  const isAssetFilters = bffPath === "assets/filters"
  const isAssetDetail = bffPath.startsWith("assets/")
  const isSearchAssets = bffPath === "search/assets"
  const isLatestEvents = bffPath === "events/latest"
  const isCreativeFeatured = bffPath === "creative/featured"
  const revalidateSeconds = isAssetDetail
    ? 300
    : isAssetList || isSearchAssets
    ? 30
    : isLatestEvents
      ? 60
      : isCreativeFeatured
        ? 86_400
      : isAssetFilters
        ? 300
        : undefined
  const responseCacheControl = isLatestEvents
    ? PUBLIC_EVENTS_CACHE_CONTROL
    : isSearchAssets
      ? PUBLIC_SEARCH_CACHE_CONTROL
      : isCreativeFeatured
        ? PUBLIC_CREATIVE_FEATURED_CACHE_CONTROL
        : isAssetDetail
          ? PUBLIC_ASSET_DETAIL_CACHE_CONTROL
          : undefined

  return tracedUpstreamProxy({
    request,
    route: `/api/public/${bffPath}`,
    upstreamUrl,
    upstreamFetch,
    cacheMode: revalidateSeconds ? `revalidate-${revalidateSeconds}` : "no-store",
    upstreamRevalidateSeconds: revalidateSeconds,
    passthroughCacheControl: isAssetList || isAssetFilters || isAssetDetail || isSearchAssets || isLatestEvents || isCreativeFeatured,
    responseCacheControl,
    responseBody: options.responseBody,
  })
}

function resolvePublicUpstreamBase(bffPath: string) {
  const exact = PUBLIC_UPSTREAM_BY_BFF_PATH[bffPath]
  if (exact) return exact
  if (bffPath.startsWith("assets/") && !bffPath.includes("..")) {
    return `/api/v1/${bffPath}`
  }
  return undefined
}
