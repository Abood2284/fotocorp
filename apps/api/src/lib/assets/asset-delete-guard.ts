/**
 * PR-15.1 — Fotokey-protected hard delete guard.
 *
 * Once an `image_assets` row has been assigned a Fotokey via the photographer publish pipeline,
 * the canonical original sits in `fotocorp-2026-megafinal` keyed by that Fotokey, derivatives
 * may exist in `fotocorp-2026-previews`, and downstream tables (downloads, analytics, etc.) may
 * reference it. Hard-deleting such an asset would orphan R2 objects and break catalog identity.
 *
 * No hard-delete endpoint exists today (PR-15.1). This module is the choke point that any
 * future internal delete route MUST call before issuing a DELETE on `image_assets` so the
 * Fotokey invariant is enforced in code, not just documentation.
 */
import { eq } from "drizzle-orm";
import type { DrizzleClient, TransactionalDrizzleClient } from "../../db";
import { imageAssets } from "../../db/schema/image-assets";
import { AppError } from "../errors";

export type AssetDeleteGuardClient = DrizzleClient | TransactionalDrizzleClient;

/**
 * Throws an `ASSET_HAS_FOTOKEY` AppError (HTTP 409) if the asset has a Fotokey.
 *
 * Resolves silently when the asset has no Fotokey or does not exist (the missing-asset case
 * is left to the caller, since "no row" is delete-idempotent).
 */
export async function assertAssetCanBeHardDeleted(
  db: AssetDeleteGuardClient,
  imageAssetId: string,
): Promise<void> {
  const rows = await db
    .select({ fotokey: imageAssets.fotokey })
    .from(imageAssets)
    .where(eq(imageAssets.id, imageAssetId))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  if (row.fotokey) {
    throw new AppError(
      409,
      "ASSET_HAS_FOTOKEY",
      "This asset has been published with a Fotokey and cannot be hard-deleted. Hide, archive, or replace it instead.",
    );
  }
}
