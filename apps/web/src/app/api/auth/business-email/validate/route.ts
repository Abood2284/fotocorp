import { buildApiAssetUrl } from "@/lib/api/fotocorp-api"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const response = await fetch(buildApiAssetUrl("/api/v1/auth/business-email/validate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
