import type { NextRequest } from "next/server"
import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"
import { tracedUpstreamProxy } from "@/lib/server/latency-proxy"

export async function POST(request: NextRequest) {
  const upstreamUrl = buildApiAssetUrl("/api/v1/public/contributor-applications")
  return tracedUpstreamProxy({
    request,
    route: "/api/public/contributor-applications",
    upstreamUrl,
    cacheMode: "no-store",
    responseBody: true,
  })
}

export async function GET() {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
    { status: 405 },
  )
}
