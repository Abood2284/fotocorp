import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"
import { tracedUpstreamBinaryProxy } from "@/lib/server/latency-proxy"

interface RouteContext {
  params: Promise<{ assetId: string; variant: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { assetId, variant } = await context.params
  const upstreamUrl = buildApiAssetUrl(
    `/api/media/assets/${encodeURIComponent(assetId)}/preview/${encodeURIComponent(variant)}`,
  )

  return tracedUpstreamBinaryProxy({
    request,
    route: `/api/media/assets/${assetId}/preview/${variant}`,
    upstreamUrl,
    accept: "image/*",
  })
}
