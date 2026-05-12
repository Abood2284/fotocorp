import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.toString()
  const upstreamUrl = buildApiAssetUrl(`/api/v1/assets${query ? `?${query}` : ""}`)

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null)

  if (!upstream) {
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Catalog service is unavailable." } },
      {
        status: 502,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  }

  const bodyText = await upstream.text()
  return new Response(bodyText, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
