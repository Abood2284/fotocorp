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
}

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
  const params = await context.params
  const bffPath = params.path?.join("/") ?? ""
  const upstreamBase = PUBLIC_UPSTREAM_BY_BFF_PATH[bffPath]
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

  return tracedUpstreamProxy({
    request,
    route: `/api/public/${bffPath}`,
    upstreamUrl,
    upstreamFetch,
    cacheMode: isAssetList ? "revalidate-30" : isAssetFilters ? "revalidate-300" : "no-store",
    upstreamRevalidateSeconds: isAssetList ? 30 : isAssetFilters ? 300 : undefined,
    passthroughCacheControl: isAssetList || isAssetFilters,
  })
}
