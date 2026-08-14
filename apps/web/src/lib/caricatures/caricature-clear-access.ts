import "server-only"

import { headers } from "next/headers"

import {
  listSubscriberEntitlements,
} from "@/lib/app-user-profile-store"
import { hasActiveCaricatureEntitlement } from "@/lib/caricatures/caricature-clear-access-shared"
import { getPgPool } from "@/lib/db"

export {
  buildCaricatureClearPreviewUrl,
  hasActiveCaricatureEntitlement,
} from "@/lib/caricatures/caricature-clear-access-shared"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveSubscriberHasCaricatureClearAccess(authUserId: string): Promise<boolean> {
  const entitlements = await listSubscriberEntitlements(authUserId)
  return hasActiveCaricatureEntitlement(entitlements)
}

/** Uses the same `/api/v1/auth/session` path as the header, not contributor `/me`. */
export async function getOptionalContributorClearPreviewIdentity(): Promise<{ id: string } | null> {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  const cookieHeader = (await headers()).get("cookie")
  if (!apiBaseUrl || !cookieHeader?.includes("fotocorp_session=")) return null

  let response: Response
  try {
    response = await fetch(new URL("/api/v1/auth/session", apiBaseUrl), {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        accept: "application/json",
      },
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as {
    ownerType?: string
    contributor?: { id?: string } | null
  } | null

  const contributorId = payload?.contributor?.id?.trim()
  if (payload?.ownerType !== "CONTRIBUTOR" || !contributorId) return null
  return { id: contributorId }
}

export async function listPublishedCaricatureIdsForContributor(
  contributorId: string,
): Promise<string[]> {
  if (!UUID_PATTERN.test(contributorId)) return []

  const result = await getPgPool().query<{ id: string }>(
    `
      select id::text as id
      from caricature_assets
      where created_by_contributor_id = $1::uuid
        and status = 'PUBLISHED'
        and visibility = 'PUBLIC'
        and deleted_at is null
    `,
    [contributorId],
  )

  return result.rows.map((row) => row.id)
}
