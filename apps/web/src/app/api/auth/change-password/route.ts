import type { NextRequest } from "next/server"
import { proxyPlatformAuthRequest } from "@/lib/api/platform-auth-proxy"

export async function POST(request: NextRequest) {
  return proxyPlatformAuthRequest(request, "/api/v1/auth/change-password")
}
