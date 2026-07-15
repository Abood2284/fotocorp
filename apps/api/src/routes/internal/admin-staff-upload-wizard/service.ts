import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { ASSET_AUDIT_ACTION } from "../../../lib/audit/actions";
import {
  buildFieldDeltas,
  insertAssetAdminAuditLog,
  type AssetAdminAuditActor,
} from "../../../lib/audit/asset-admin-audit-log";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { schedulePublicEventFeedSync } from "../../../lib/assets/public-event-feed-projection";
import { listAssetCategoriesForContributor, assertContributorUploadCategoryExists } from "../../contributor/catalog/service";
import type { PatchUploadAssetMetadataBody, PrepareUploadFilesBody } from "../../contributor/uploads/validators";
import {
  staffDelegateCompletePhotographerUploadItem,
  staffDelegateCreatePhotographerUploadBatch,
  staffDelegateGetPhotographerUploadBatchDetail,
  staffDelegatePatchPhotographerUploadAssetMetadata,
  staffDelegatePreparePhotographerUploadFiles,
  staffDelegateSubmitPhotographerUploadBatch,
} from "../../contributor/uploads/service";
import type { Env } from "../../../appTypes";
import type { StaffUploadWizardBatchBody, StaffUploadWizardEventBody } from "./validators";

const PHOTO_EVENT_SOURCE_FOTOCORP_PORTAL = "Fotocorp" as const;

export async function listStaffUploadWizardContributorsService(
  db: DrizzleClient,
  query: { q?: string; limit: number },
): Promise<Response> {
  const q = query.q?.trim();
  const searchClause = q
    ? sql`and (
        p.display_name ilike ${"%" + q + "%"}
        or coalesce(p.email, '') ilike ${"%" + q + "%"}
      )`
    : sql``;

  const rows = await executeRows<{ id: string; display_name: string; email: string | null }>(
    db,
    sql`
      select p.id, p.display_name, p.email
      from contributors p
      where p.status = 'ACTIVE'
      ${searchClause}
      order by p.display_name asc
      limit ${query.limit}
    `,
  );

  return json({
    ok: true as const,
    contributors: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
    })),
  });
}

export async function listStaffUploadWizardAssetCategoriesService(db: DrizzleClient): Promise<Response> {
  return json(await listAssetCategoriesForContributor(db));
}

export async function createStaffUploadWizardEventService(db: DrizzleClient, body: StaffUploadWizardEventBody): Promise<Response> {
  await assertContributorUploadCategoryExists(db, body.categoryId);
  await assertContributorExists(db, body.targetContributorId);

  const eventDateSql = parseEventDateForSql(body.eventDate);

  const inserted = await executeRows<{ id: string }>(
    db,
    sql`
      insert into photo_events (
        name,
        description,
        event_date,
        event_time,
        country,
        state_region,
        city,
        location,
        keywords,
        category_id,
        status,
        source,
        created_by_contributor_id,
        created_by_source
      )
      values (
        ${body.name},
        null,
        ${eventDateSql},
        null,
        null,
        null,
        null,
        null,
        null,
        ${body.categoryId}::uuid,
        'ACTIVE',
        ${PHOTO_EVENT_SOURCE_FOTOCORP_PORTAL},
        ${body.targetContributorId}::uuid,
        'ADMIN'
      )
      returning id
    `,
  );
  const newId = inserted[0]?.id;
  if (!newId) throw new AppError(500, "EVENT_CREATE_FAILED", "Could not create event.");
  await schedulePublicEventFeedSync(db, newId);

  const detail = await executeRows<{
    id: string;
    name: string;
    event_date: Date | string | null;
    category_id: string | null;
    category_name: string | null;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    db,
    sql`
      select
        pe.id,
        pe.name,
        pe.event_date,
        pe.category_id,
        c.name as category_name,
        pe.created_at,
        pe.updated_at
      from photo_events pe
      left join asset_categories c on c.id = pe.category_id
      where pe.id = ${newId}::uuid
      limit 1
    `,
  );
  const row = detail[0];
  if (!row) throw new AppError(500, "EVENT_CREATE_FAILED", "Could not load created event.");

  return json(
    {
      ok: true as const,
      event: {
        id: row.id,
        name: row.name,
        eventDate: row.event_date ? dateOnlyIso(row.event_date) : null,
        category: row.category_id ? { id: row.category_id, name: row.category_name ?? "Category" } : null,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      },
    },
    201,
  );
}

export async function createStaffUploadWizardBatchService(
  db: DrizzleClient,
  body: StaffUploadWizardBatchBody,
): Promise<Response> {
  return json(await staffDelegateCreatePhotographerUploadBatch(db, body), 201);
}

export async function getStaffUploadWizardBatchService(db: DrizzleClient, batchId: string): Promise<Response> {
  return json(await staffDelegateGetPhotographerUploadBatchDetail(db, batchId));
}

export async function prepareStaffUploadWizardFilesService(
  env: Env,
  db: DrizzleClient,
  batchId: string,
  body: PrepareUploadFilesBody,
): Promise<Response> {
  return json(await staffDelegatePreparePhotographerUploadFiles(db, env, batchId, body), 201);
}

export async function completeStaffUploadWizardFileService(
  env: Env,
  db: DrizzleClient,
  batchId: string,
  itemId: string,
): Promise<Response> {
  return json(await staffDelegateCompletePhotographerUploadItem(db, env, batchId, itemId));
}

export async function submitStaffUploadWizardBatchService(db: DrizzleClient, batchId: string): Promise<Response> {
  return json(await staffDelegateSubmitPhotographerUploadBatch(db, batchId));
}

export async function patchStaffUploadWizardMetadataService(
  db: DrizzleClient,
  batchId: string,
  imageAssetId: string,
  body: PatchUploadAssetMetadataBody,
  actor: AssetAdminAuditActor,
): Promise<Response> {
  const beforeRows = await executeRows<{
    who_is_in_picture: string | null;
    caption: string | null;
    keywords: string | null;
  }>(
    db,
    sql`
      select who_is_in_picture, caption, keywords
      from image_assets
      where id = ${imageAssetId}::uuid
      limit 1
    `,
  );
  const beforeRow = beforeRows[0];
  const result = await staffDelegatePatchPhotographerUploadAssetMetadata(db, batchId, imageAssetId, body);

  if (result.ok && actor.authUserId && beforeRow) {
    const { before, after } = buildFieldDeltas(
      {
        who_is_in_picture: beforeRow.who_is_in_picture ?? null,
        caption: beforeRow.caption ?? null,
        keywords: beforeRow.keywords ?? null,
      },
      {
        who_is_in_picture: result.whoIsInPicture,
        caption: result.caption,
        keywords: result.keywords,
      },
    );
    if (Object.keys(after).length > 0) {
      await insertAssetAdminAuditLog(db, {
        assetId: imageAssetId,
        action: ASSET_AUDIT_ACTION.metadataUpdated,
        actor,
        before,
        after,
      }).catch(() => undefined);
    }
  }

  return json(result);
}


async function assertContributorExists(db: DrizzleClient, contributorId: string) {
  const rows = await executeRows<{ id: string }>(
    db,
    sql`select id from contributors where id = ${contributorId}::uuid and status = 'ACTIVE' limit 1`,
  );
  if (!rows[0]) throw new AppError(400, "TARGET_CONTRIBUTOR_INVALID", "Photographer was not found.");
}

function parseEventDateForSql(isoDate: string): string | null {
  if (!isoDate) return null;
  return `${isoDate}T12:00:00.000Z`;
}

function dateOnlyIso(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
