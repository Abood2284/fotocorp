import { eq, sql } from "drizzle-orm";
import type { Env } from "../../appTypes";
import type { DrizzleClient } from "../../db";
import { imageAssets } from "../../db/schema/image-assets";
import { imagePublishJobItems } from "../../db/schema/image-publish-job-items";
import { AppError } from "../errors";
import { syncTypesensePublicAsset } from "../search/typesense-public-asset-sync";
import { assertAssetCanBeHardDeleted } from "./asset-delete-guard";
import { schedulePublicEventFeedSyncForAsset } from "./public-event-feed-projection";

export function canDeleteIncompleteCatalogUpload(input: {
  fotokey: string | null | undefined;
  source: string | null | undefined;
  originalStorageKey: string | null | undefined;
  uploadLinked: boolean;
}): boolean {
  if (input.fotokey?.trim()) return false;
  if (input.source !== "FOTOCORP") return false;
  if (!input.originalStorageKey?.startsWith("staging/")) return false;
  if (input.uploadLinked) return false;
  return true;
}

export async function deleteInternalAdminIncompleteUploadAsset(
  db: DrizzleClient,
  env: Env,
  assetId: string,
): Promise<{ ok: true; deletedAssetId: string }> {
  const assetRows = await db
    .select({
      id: imageAssets.id,
      fotokey: imageAssets.fotokey,
      source: imageAssets.source,
      originalStorageKey: imageAssets.originalStorageKey,
      eventId: imageAssets.eventId,
    })
    .from(imageAssets)
    .where(eq(imageAssets.id, assetId))
    .limit(1);

  const row = assetRows[0];
  if (!row) throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");

  await assertAssetCanBeHardDeleted(db, assetId);

  const linkedRows = await db.execute(sql`
    select exists (
      select 1
      from contributor_upload_items pui
      where pui.image_asset_id = ${assetId}::uuid
        and pui.upload_status = 'ASSET_CREATED'
    ) as upload_linked
  `);
  const linkedResultRows = Array.isArray(linkedRows) ? linkedRows : (linkedRows as { rows?: unknown[] }).rows;
  const uploadLinked = Boolean((linkedResultRows?.[0] as { upload_linked?: boolean } | undefined)?.upload_linked);

  if (
    !canDeleteIncompleteCatalogUpload({
      fotokey: row.fotokey,
      source: row.source,
      originalStorageKey: row.originalStorageKey,
      uploadLinked,
    })
  ) {
    throw new AppError(
      409,
      "ASSET_NOT_DELETABLE",
      "Only incomplete contributor uploads without a Fotokey can be deleted. Archive published assets instead.",
    );
  }

  const eventId = row.eventId;

  await db.batch([
    db.delete(imagePublishJobItems).where(eq(imagePublishJobItems.imageAssetId, assetId)),
    db.delete(imageAssets).where(eq(imageAssets.id, assetId)),
  ]);

  if (eventId) {
    await schedulePublicEventFeedSyncForAsset(db, assetId, eventId);
  }

  try {
    await syncTypesensePublicAsset(db, env, assetId);
  } catch (error) {
    console.warn("[catalog-delete] Typesense delete failed", { assetId, error });
  }

  return { ok: true, deletedAssetId: assetId };
}
