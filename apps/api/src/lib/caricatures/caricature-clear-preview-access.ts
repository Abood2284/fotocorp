import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import { subscriberEntitlements } from "../../db/schema/subscriber-entitlements"
import { AppError } from "../errors"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CaricatureClearPreviewActorKind = "staff" | "subscriber" | "contributor"

/** ACTIVE CARICATURE entitlement within its validity window (quota not required for clear browse). */
export async function assertSubscriberHasActiveCaricatureAccess(
  db: DrizzleClient,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ id: subscriberEntitlements.id })
    .from(subscriberEntitlements)
    .where(
      and(
        eq(subscriberEntitlements.userId, userId),
        eq(subscriberEntitlements.status, "ACTIVE"),
        eq(subscriberEntitlements.assetType, "CARICATURE"),
        or(isNull(subscriberEntitlements.validUntil), gt(subscriberEntitlements.validUntil, sql`now()`)),
        or(isNull(subscriberEntitlements.validFrom), lte(subscriberEntitlements.validFrom, sql`now()`)),
      ),
    )
    .limit(1)

  if (!rows[0]) {
    throw new AppError(403, "ENTITLEMENT_REQUIRED", "Caricature access is required.")
  }
}

/** Subscribers may only load clear previews for published public caricatures. */
export async function assertCaricatureIsPubliclyPublished(
  db: DrizzleClient,
  assetId: string,
): Promise<void> {
  const rows = await db
    .select({ id: caricatureAssets.id })
    .from(caricatureAssets)
    .where(
      and(
        eq(caricatureAssets.id, assetId),
        eq(caricatureAssets.status, "PUBLISHED"),
        eq(caricatureAssets.visibility, "PUBLIC"),
        isNull(caricatureAssets.deletedAt),
      ),
    )
    .limit(1)

  if (!rows[0]) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature was not found.")
  }
}

/** Contributors may only load clear previews for published public caricatures they uploaded. */
export async function assertContributorOwnsPublishedCaricature(
  db: DrizzleClient,
  assetId: string,
  contributorId: string,
): Promise<void> {
  const rows = await db
    .select({ id: caricatureAssets.id })
    .from(caricatureAssets)
    .where(
      and(
        eq(caricatureAssets.id, assetId),
        eq(caricatureAssets.status, "PUBLISHED"),
        eq(caricatureAssets.visibility, "PUBLIC"),
        isNull(caricatureAssets.deletedAt),
        eq(caricatureAssets.createdByContributorId, contributorId),
      ),
    )
    .limit(1)

  if (!rows[0]) {
    throw new AppError(403, "CARICATURE_OWNER_REQUIRED", "You can only view clear previews of your own caricatures.")
  }
}

export function resolveCaricatureClearPreviewActor(input: {
  staffActorId: string | null
  authUserId: string | null
  contributorId: string | null
}): CaricatureClearPreviewActorKind | null {
  if (input.staffActorId) return "staff"
  if (input.authUserId) return "subscriber"
  if (input.contributorId) return "contributor"
  return null
}

export function normalizeCaricatureClearPreviewContributorId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || null
  if (!trimmed) return null
  if (!UUID_PATTERN.test(trimmed)) return null
  return trimmed
}
