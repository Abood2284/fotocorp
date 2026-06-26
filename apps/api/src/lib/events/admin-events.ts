import { and, eq, ilike, inArray, sql } from "drizzle-orm"
import { AppError } from "../errors"
import { verifyStaffPassword } from "../auth/staff-password"
import { getStaffCredentialPasswordHash } from "../staff/staff-member"
import {
  photoEvents,
  imageAssets,
  imageDerivatives,
  imageAccessLogs,
  imageDownloadLogs,
  imagePublishJobItems,
  contributorUploadBatches,
  contributorUploadItems,
  staffMembers,
} from "../../db/schema"
import type { DrizzleClient } from "../../db"
import type { Env } from "../../appTypes"
import { schedulePublicEventFeedSync } from "../assets/public-event-feed-projection"
import {
  scheduleTypesenseDeleteForEvent,
  scheduleTypesenseSyncForEvent,
} from "../search/typesense-public-asset-sync"

export interface AdminEventListFilters {
  q?: string
  source?: "LEGACY_IMPORT" | "MANUAL" | "CONTRIBUTOR" | "Fotocorp"
  hasAssets?: "true" | "false"
  assetsMin?: number
  assetsMax?: number
  page: number
  limit: number
}

export async function listInternalAdminEvents(db: DrizzleClient, filters: AdminEventListFilters) {
  const conditions = []

  const assetCountSubquery = db
    .select({ count: sql<number>`count(*)` })
    .from(imageAssets)
    .where(eq(imageAssets.eventId, photoEvents.id))

  if (filters.q) {
    conditions.push(ilike(photoEvents.name, `%${filters.q}%`))
  }

  if (filters.source) {
    conditions.push(eq(photoEvents.source, filters.source))
  }

  if (filters.hasAssets === "true") {
    conditions.push(sql`${assetCountSubquery} > 0`)
  } else if (filters.hasAssets === "false") {
    conditions.push(sql`${assetCountSubquery} = 0`)
  }

  if (filters.assetsMin !== undefined) {
    conditions.push(sql`${assetCountSubquery} >= ${filters.assetsMin}`)
  }

  if (filters.assetsMax !== undefined) {
    conditions.push(sql`${assetCountSubquery} <= ${filters.assetsMax}`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (filters.page - 1) * filters.limit

  const items = await db
    .select({
      event: photoEvents,
      photoCount: sql<number>`(${assetCountSubquery})`,
    })
    .from(photoEvents)
    .where(whereClause)
    .orderBy(sql`${photoEvents.createdAt} DESC`)
    .limit(filters.limit)
    .offset(offset)

  const countQuery = await db
    .select({ count: sql<number>`count(*)` })
    .from(photoEvents)
    .where(whereClause)

  const total = Number(countQuery[0]?.count ?? 0)

  return {
    items: items.map((row) => ({
      ...row.event,
      photoCount: Number(row.photoCount ?? 0)
    })),
    total,
    page: filters.page,
    limit: filters.limit,
  }
}

export async function getInternalAdminEventById(db: DrizzleClient, eventId: string) {
  const [event] = await db.select().from(photoEvents).where(eq(photoEvents.id, eventId))
  if (!event) return null

  // Get asset summary
  const [assetStats] = await db
    .select({
      total: sql<number>`count(*)`,
      public: sql<number>`sum(case when ${imageAssets.visibility} = 'PUBLIC' then 1 else 0 end)`,
      private: sql<number>`sum(case when ${imageAssets.visibility} = 'PRIVATE' then 1 else 0 end)`,
    })
    .from(imageAssets)
    .where(eq(imageAssets.eventId, eventId))

  return {
    event,
    assetStats: {
      total: Number(assetStats?.total ?? 0),
      public: Number(assetStats?.public ?? 0),
      private: Number(assetStats?.private ?? 0),
    },
  }
}

export async function updateInternalAdminEvent(
  db: DrizzleClient,
  env: Env,
  eventId: string,
  payload: Partial<typeof photoEvents.$inferInsert>
) {
  const normalizedPayload = normalizeAdminEventUpdatePayload(payload)

  const [updated] = await db
    .update(photoEvents)
    .set({
      ...normalizedPayload,
      updatedAt: new Date(),
    })
    .where(eq(photoEvents.id, eventId))
    .returning()

  if (!updated) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")
  await schedulePublicEventFeedSync(db, eventId)
  await scheduleTypesenseSyncForEvent(db, env, eventId)
  return updated
}

export async function purgeInternalAdminEvent(
  db: DrizzleClient,
  env: Env,
  eventId: string,
  payload: { exactName: string; phrase: string; password: string },
  actor: { authUserId: string | null }
) {
  if (payload.phrase !== "PURGE EVENT") {
    throw new AppError(400, "INVALID_PHRASE", "You must type PURGE EVENT exactly.")
  }

  if (!actor.authUserId) throw new AppError(401, "UNAUTHORIZED", "Missing authentication.")

  const [staff] = await db
    .select({ role: staffMembers.role })
    .from(staffMembers)
    .where(eq(staffMembers.id, actor.authUserId))

  if (!staff || staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can purge events.")
  }

  const passwordHash = await getStaffCredentialPasswordHash(db, actor.authUserId)
  if (!passwordHash) throw new AppError(403, "FORBIDDEN", "Staff credentials were not found.")

  const isPasswordValid = await verifyStaffPassword(payload.password, passwordHash)
  if (!isPasswordValid) {
    throw new AppError(400, "INVALID_PASSWORD", "Invalid password provided.")
  }

  const [event] = await db.select().from(photoEvents).where(eq(photoEvents.id, eventId))
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")

  if (event.name !== payload.exactName) {
    throw new AppError(400, "INVALID_NAME", "Exact event name does not match.")
  }

  // 1. Collect related assets
  const assets = await db
    .select({ id: imageAssets.id, originalStorageKey: imageAssets.originalStorageKey })
    .from(imageAssets)
    .where(eq(imageAssets.eventId, eventId))

  const assetIds = assets.map((a: any) => a.id)
  const originalKeysToDelete = assets.map((a: any) => a.originalStorageKey).filter(Boolean) as string[]

  const derivRows =
    assetIds.length > 0
      ? await db
          .select({ id: imageDerivatives.id, storageKey: imageDerivatives.storageKey })
          .from(imageDerivatives)
          .where(inArray(imageDerivatives.imageAssetId, assetIds))
      : []

  const derivIds = derivRows.map((d) => d.id)
  const previewKeysToDelete = derivRows.map((d) => d.storageKey).filter(Boolean) as string[]

  const contributorUploadRowsForEvent = await db
    .select({ storageKey: contributorUploadItems.storageKey })
    .from(contributorUploadItems)
    .innerJoin(
      contributorUploadBatches,
      eq(contributorUploadItems.batchId, contributorUploadBatches.id),
    )
    .where(eq(contributorUploadBatches.eventId, eventId))

  const contributorKeysToDelete = [...new Set(contributorUploadRowsForEvent.map((r: { storageKey: string }) => r.storageKey).filter(Boolean))] as string[]

  await scheduleTypesenseDeleteForEvent(env, eventId)

  // neon-http (createHttpDb) rejects db.transaction(); use Neon's transactional HTTP batch instead.
  const deletes = [
    // Removes upload items (FK cascade); contributor_upload_batches.event_id -> photo_events is RESTRICT.
    db.delete(contributorUploadBatches).where(eq(contributorUploadBatches.eventId, eventId)),
    ...(assetIds.length > 0
      ? [
          db.delete(imageAccessLogs).where(inArray(imageAccessLogs.imageAssetId, assetIds)),
          ...(derivIds.length > 0
            ? [db.delete(imageAccessLogs).where(inArray(imageAccessLogs.imageDerivativeId, derivIds))]
            : []),
          db.delete(imageDownloadLogs).where(inArray(imageDownloadLogs.imageAssetId, assetIds)),
          db.delete(imagePublishJobItems).where(inArray(imagePublishJobItems.imageAssetId, assetIds)),
          db.delete(imageDerivatives).where(inArray(imageDerivatives.imageAssetId, assetIds)),
          db.delete(imageAssets).where(inArray(imageAssets.id, assetIds)),
        ]
      : []),
    db.delete(photoEvents).where(eq(photoEvents.id, eventId)),
  ] as const satisfies readonly unknown[]

  await db.batch(deletes as unknown as Parameters<DrizzleClient["batch"]>[0])

  // 3. Delete R2 objects
  const r2Results = {
    originalsDeleted: 0,
    previewsDeleted: 0,
    uploadsDeleted: 0,
    originalsFailed: 0,
    previewsFailed: 0,
    uploadsFailed: 0,
  }

  const safelyDelete = async (bucket: R2Bucket | undefined, keys: string[]) => {
    if (!bucket || keys.length === 0) return { deleted: keys.length, failed: 0 } // Assume if no bucket, we can't do anything (though ideally we fail fast, but schema is already gone)
    try {
      // R2 delete can handle up to 1000 objects if used properly, but let's do it individually for safety or via array if supported
      // Usually bucket.delete([key]) or bucket.delete(key) works.
      await bucket.delete(keys)
      return { deleted: keys.length, failed: 0 }
    } catch (e) {
      console.error("R2 bulk delete failed, attempting individual", e)
      let deleted = 0, failed = 0
      for (const k of keys) {
        try {
          await bucket.delete(k)
          deleted++
        } catch {
          failed++
        }
      }
      return { deleted, failed }
    }
  }

  if (originalKeysToDelete.length > 0) {
    const res = await safelyDelete(env.MEDIA_ORIGINALS_BUCKET, originalKeysToDelete)
    r2Results.originalsDeleted = res.deleted
    r2Results.originalsFailed = res.failed
  }

  if (previewKeysToDelete.length > 0) {
    const res = await safelyDelete(env.MEDIA_PREVIEWS_BUCKET, previewKeysToDelete)
    r2Results.previewsDeleted = res.deleted
    r2Results.previewsFailed = res.failed
  }

  if (contributorKeysToDelete.length > 0) {
    const res = await safelyDelete(env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET, contributorKeysToDelete)
    r2Results.uploadsDeleted = res.deleted
    r2Results.uploadsFailed = res.failed
  }

  return {
    success: true,
    dbDeleted: {
      assets: assetIds.length,
      derivatives: previewKeysToDelete.length,
    },
    r2Results,
  }
}

function normalizeAdminEventUpdatePayload(
  payload: Partial<typeof photoEvents.$inferInsert>,
): Partial<typeof photoEvents.$inferInsert> {
  if (payload.eventDate === undefined || payload.eventDate === null) return payload
  if (payload.eventDate instanceof Date) return payload

  return {
    ...payload,
    eventDate: new Date(payload.eventDate as string),
  }
}
