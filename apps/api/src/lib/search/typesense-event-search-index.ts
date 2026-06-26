import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db/http"
import { AppError } from "../errors"
import {
  countTypesenseEligiblePublicAssetsForEvent,
  syncTypesensePublicAssetsForEvent,
} from "./typesense-public-asset-sync"
import {
  isTypesenseNotConfiguredError,
  isTypesenseSearchFailedError,
  parseTypesensePublicAssetSearchQuery,
  searchTypesensePublicAssets,
} from "./typesense-public-assets"

export interface AdminEventSearchIndexStatus {
  eventId: string
  catalogSearchEligibleCount: number
  typesenseIndexedCount: number | null
  missingCount: number | null
  inSync: boolean
  typesenseConfigured: boolean
}

export interface AdminEventSearchIndexSyncResult {
  eventId: string
  upsertedCount: number
  deletedCount: number
  status: AdminEventSearchIndexStatus
}

export function buildAdminEventSearchIndexStatus(input: {
  eventId: string
  catalogSearchEligibleCount: number
  typesenseIndexedCount: number | null
  typesenseConfigured: boolean
}): AdminEventSearchIndexStatus {
  const missingCount =
    input.typesenseConfigured && input.typesenseIndexedCount !== null
      ? Math.max(0, input.catalogSearchEligibleCount - input.typesenseIndexedCount)
      : null

  const inSync =
    input.typesenseConfigured
    && input.typesenseIndexedCount !== null
    && missingCount === 0

  return {
    eventId: input.eventId,
    catalogSearchEligibleCount: input.catalogSearchEligibleCount,
    typesenseIndexedCount: input.typesenseIndexedCount,
    missingCount,
    inSync,
    typesenseConfigured: input.typesenseConfigured,
  }
}

export async function getTypesenseIndexedAssetCountForEvent(
  env: Env,
  eventId: string,
): Promise<{ count: number | null; configured: boolean }> {
  try {
    const query = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams({
        q: "*",
        eventId,
        limit: "1",
        includeFacets: "false",
      }),
    )
    const result = await searchTypesensePublicAssets(env, query)
    return { count: result.totalCount, configured: true }
  } catch (error) {
    if (isTypesenseNotConfiguredError(error)) {
      return { count: null, configured: false }
    }
    if (isTypesenseSearchFailedError(error)) {
      throw new AppError(
        502,
        "TYPESENSE_SEARCH_FAILED",
        "Unable to read the public search index for this event.",
      )
    }
    throw error
  }
}

export async function getAdminEventSearchIndexStatus(
  db: DrizzleClient,
  env: Env,
  eventId: string,
): Promise<AdminEventSearchIndexStatus> {
  const [catalogSearchEligibleCount, typesense] = await Promise.all([
    countTypesenseEligiblePublicAssetsForEvent(db, eventId),
    getTypesenseIndexedAssetCountForEvent(env, eventId),
  ])

  return buildAdminEventSearchIndexStatus({
    eventId,
    catalogSearchEligibleCount,
    typesenseIndexedCount: typesense.count,
    typesenseConfigured: typesense.configured,
  })
}

export async function syncAdminEventSearchIndex(
  db: DrizzleClient,
  env: Env,
  eventId: string,
): Promise<AdminEventSearchIndexSyncResult> {
  const syncResult = await syncTypesensePublicAssetsForEvent(db, env, eventId, { critical: true })
  if (syncResult.action === "skipped") {
    throw new AppError(
      503,
      "TYPESENSE_NOT_CONFIGURED",
      "Public search indexing is not configured in this environment.",
    )
  }

  const status = await getAdminEventSearchIndexStatus(db, env, eventId)
  return {
    eventId,
    upsertedCount: syncResult.upsertedCount,
    deletedCount: syncResult.deletedCount,
    status,
  }
}
