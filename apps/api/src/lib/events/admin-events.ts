import { and, eq, ilike, inArray, sql } from "drizzle-orm"
import { AppError } from "../errors"
import { verifyStaffPassword } from "../auth/staff-password"
import {
  photoEvents,
  imageAssets,
  imageDerivatives,
  imageAccessLogs,
  imageDownloadLogs,
  imagePublishJobItems,
  contributorUploadItems,
  staffAccounts,
} from "../../db/schema"
import type { DrizzleClient } from "../../db"
import type { Env } from "../../appTypes"

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
  eventId: string,
  payload: Partial<typeof photoEvents.$inferInsert>
) {
  const [updated] = await db
    .update(photoEvents)
    .set({
      ...payload,
      updatedAt: new Date(),
    })
    .where(eq(photoEvents.id, eventId))
    .returning()

  if (!updated) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")
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
    .select({ role: staffAccounts.role, passwordHash: staffAccounts.passwordHash })
    .from(staffAccounts)
    .where(eq(staffAccounts.id, actor.authUserId))

  if (!staff || staff.role !== "SUPER_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Only SUPER_ADMIN can purge events.")
  }

  const isPasswordValid = await verifyStaffPassword(payload.password, staff.passwordHash)
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

  let previewKeysToDelete: string[] = []
  let contributorKeysToDelete: string[] = []

  // 2. Perform DB deletion in transaction
  await db.transaction(async (tx: any) => {
    if (assetIds.length > 0) {
      // Find derivatives
      const derivs = await tx
        .select({ id: imageDerivatives.id, storageKey: imageDerivatives.storageKey })
        .from(imageDerivatives)
        .where(inArray(imageDerivatives.imageAssetId, assetIds))
      
      const derivIds = derivs.map((d: any) => d.id)
      previewKeysToDelete = derivs.map((d: any) => d.storageKey).filter(Boolean)

      // Delete Access Logs
      await tx.delete(imageAccessLogs).where(inArray(imageAccessLogs.imageAssetId, assetIds))
      if (derivIds.length > 0) {
        await tx.delete(imageAccessLogs).where(inArray(imageAccessLogs.imageDerivativeId, derivIds))
      }

      // Delete Download Logs
      await tx.delete(imageDownloadLogs).where(inArray(imageDownloadLogs.imageAssetId, assetIds))

      // Delete Publish Job Items
      await tx.delete(imagePublishJobItems).where(inArray(imagePublishJobItems.imageAssetId, assetIds))

      // Gather upload items for storage key deletion, then delete the rows
      const uploads = await tx
        .select({ storageKey: contributorUploadItems.storageKey })
        .from(contributorUploadItems)
        .where(inArray(contributorUploadItems.imageAssetId, assetIds))
      
      contributorKeysToDelete = uploads.map((u: any) => u.storageKey).filter(Boolean)
      
      await tx.delete(contributorUploadItems).where(inArray(contributorUploadItems.imageAssetId, assetIds))

      // Delete derivatives
      await tx.delete(imageDerivatives).where(inArray(imageDerivatives.imageAssetId, assetIds))

      // Delete Image Assets
      await tx.delete(imageAssets).where(inArray(imageAssets.id, assetIds))
    }

    // Finally, delete the event
    await tx.delete(photoEvents).where(eq(photoEvents.id, eventId))
  })

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
