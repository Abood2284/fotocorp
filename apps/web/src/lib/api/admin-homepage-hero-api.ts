import "server-only"

import type {
  HomepageHeroPoolCandidatesResponse,
  HomepageHeroPoolResponse,
} from "@/features/homepage-hero/types"
import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import {
  internalApiJson,
  internalApiRoutes,
  withQuery,
} from "@/lib/server/internal-api"

export async function getHomepageHeroPool() {
  return adminJson<HomepageHeroPoolResponse>({
    path: internalApiRoutes.adminHomepageHeroPool(),
  })
}

export async function listHomepageHeroPoolCandidates(searchParams: URLSearchParams) {
  return adminJson<HomepageHeroPoolCandidatesResponse>({
    path: withQuery(internalApiRoutes.adminHomepageHeroPoolCandidates(), searchParams),
  })
}

export async function replaceHomepageHeroPool(assetIds: string[]) {
  return adminJson<HomepageHeroPoolResponse>({
    path: internalApiRoutes.adminHomepageHeroPool(),
    method: "PUT",
    body: { assetIds },
  })
}

async function adminJson<T>(input: {
  path: string
  method?: "GET" | "PUT"
  body?: unknown
}): Promise<T> {
  return internalApiJson<T>({
    ...input,
    headers: await getStaffInternalAdminActorHeaders(),
  })
}
