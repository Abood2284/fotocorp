import { sql, type SQL } from "drizzle-orm";
import type { Env } from "../../../appTypes";
import type { DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import {
  buildPhotographerOriginalStorageKey,
  extensionFromFileNameAndMime,
  photographerUploadLegacyImageCode,
} from "../../../lib/contributor-upload-storage-key";
import {
  hasPhotographerUploadsS3Config,
  verifyPhotographerStagingObjectExists,
} from "../../../lib/r2-contributor-uploads";
import { createPhotographerStagingPresignedPutUrl } from "../../../lib/r2-presigned-put";
import type { ContributorSessionResult } from "../auth/service";
import type { CreateUploadBatchBody, PrepareUploadFilesBody, UploadBatchesListQuery } from "./validators";

interface BatchRow {
  id: string;
  contributor_id: string;
  contributor_account_id: string;
  event_id: string;
  status: string;
  asset_type: string;
  common_title: string | null;
  common_caption: string | null;
  common_keywords: string | null;
  total_files: number | string;
  uploaded_files: number | string;
  failed_files: number | string;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ItemRow {
  id: string;
  batch_id: string;
  contributor_id: string;
  image_asset_id: string | null;
  original_file_name: string;
  original_file_extension: string | null;
  mime_type: string | null;
  size_bytes: number | string | null;
  storage_key: string;
  upload_status: string;
  failure_code: string | null;
  failure_message: string | null;
  uploaded_at: Date | string | null;
  finalized_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CompleteUploadItemRow extends ItemRow {
  event_id: string;
  common_title: string | null;
  common_caption: string | null;
  common_keywords: string | null;
  batch_status: string;
  batch_contributor_id: string;
}

interface EventCheckRow {
  id: string;
  status: string;
}

export async function createPhotographerUploadBatch(
  db: DrizzleClient,
  session: ContributorSessionResult,
  body: CreateUploadBatchBody,
) {
  const eventRows = await executeRows<EventCheckRow>(
    db,
    sql`
      select id, status
      from photo_events
      where id = ${body.eventId}::uuid
      limit 1
    `,
  );
  const event = eventRows[0];
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found.");
  if (event.status !== "ACTIVE") throw new AppError(400, "EVENT_NOT_ACTIVE", "Only ACTIVE events accept uploads.");

  const photographerId = session.contributor.id;
  const accountId = session.account.id;

  const inserted = await executeRows<BatchRow>(
    db,
    sql`
      insert into contributor_upload_batches (
        contributor_id,
        contributor_account_id,
        event_id,
        asset_type,
        common_title,
        common_caption,
        common_keywords
      )
      values (
        ${photographerId}::uuid,
        ${accountId}::uuid,
        ${body.eventId}::uuid,
        ${body.assetType},
        ${body.commonTitle ?? null},
        ${body.commonCaption ?? null},
        ${body.commonKeywords ?? null}
      )
      returning
        id,
        contributor_id,
        contributor_account_id,
        event_id,
        status,
        asset_type,
        common_title,
        common_caption,
        common_keywords,
        total_files,
        uploaded_files,
        failed_files,
        submitted_at,
        created_at,
        updated_at
    `,
  );
  const batch = inserted[0];
  if (!batch) throw new AppError(500, "BATCH_CREATE_FAILED", "Could not create upload batch.");

  return {
    ok: true as const,
    batch: mapBatch(batch),
  };
}

export async function listPhotographerUploadBatches(
  db: DrizzleClient,
  session: ContributorSessionResult,
  query: UploadBatchesListQuery,
) {
  const photographerId = session.contributor.id;
  const statusFilter = query.status ? sql`and b.status = ${query.status}` : sql``;
  const eventFilter = query.eventId ? sql`and b.event_id = ${query.eventId}::uuid` : sql``;

  const countRows = await executeRows<{ total: string }>(
    db,
    sql`
      select count(*)::text as total
      from contributor_upload_batches b
      where b.contributor_id = ${photographerId}::uuid
      ${statusFilter}
      ${eventFilter}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0) || 0;

  const rows = await executeRows<BatchRow>(
    db,
    sql`
      select
        b.id,
        b.contributor_id,
        b.contributor_account_id,
        b.event_id,
        b.status,
        b.asset_type,
        b.common_title,
        b.common_caption,
        b.common_keywords,
        b.total_files,
        b.uploaded_files,
        b.failed_files,
        b.submitted_at,
        b.created_at,
        b.updated_at
      from contributor_upload_batches b
      where b.contributor_id = ${photographerId}::uuid
      ${statusFilter}
      ${eventFilter}
      order by b.created_at desc, b.id desc
      limit ${query.limit}
      offset ${query.offset}
    `,
  );

  return {
    ok: true as const,
    batches: rows.map(mapBatch),
    pagination: { limit: query.limit, offset: query.offset, total },
  };
}

interface BatchDetailEventRow extends BatchRow {
  event_name: string;
  event_status: string;
  event_date: Date | string | null;
  event_city: string | null;
  event_location: string | null;
}

interface BatchDetailItemRow extends ItemRow {
  image_asset_status: string | null;
  image_asset_visibility: string | null;
}

export async function getPhotographerUploadBatchDetail(db: DrizzleClient, session: ContributorSessionResult, batchId: string) {
  const photographerId = session.contributor.id;
  const batchRows = await executeRows<BatchDetailEventRow>(
    db,
    sql`
      select
        b.id,
        b.contributor_id,
        b.contributor_account_id,
        b.event_id,
        b.status,
        b.asset_type,
        b.common_title,
        b.common_caption,
        b.common_keywords,
        b.total_files,
        b.uploaded_files,
        b.failed_files,
        b.submitted_at,
        b.created_at,
        b.updated_at,
        pe.name as event_name,
        pe.status as event_status,
        pe.event_date as event_date,
        pe.city as event_city,
        pe.location as event_location
      from contributor_upload_batches b
      inner join photo_events pe on pe.id = b.event_id
      where b.id = ${batchId}::uuid
        and b.contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  const batch = batchRows[0];
  if (!batch) throw new AppError(404, "UPLOAD_BATCH_NOT_FOUND", "Upload batch was not found.");

  const itemRows = await executeRows<BatchDetailItemRow>(
    db,
    sql`
      select
        i.id,
        i.batch_id,
        i.contributor_id,
        i.image_asset_id,
        i.original_file_name,
        i.original_file_extension,
        i.mime_type,
        i.size_bytes,
        i.storage_key,
        i.upload_status,
        i.failure_code,
        i.failure_message,
        i.uploaded_at,
        i.finalized_at,
        i.created_at,
        i.updated_at,
        ia.status as image_asset_status,
        ia.visibility as image_asset_visibility
      from contributor_upload_items i
      left join image_assets ia on ia.id = i.image_asset_id
      where i.batch_id = ${batchId}::uuid
      order by i.created_at asc, i.id asc
    `,
  );

  return {
    ok: true as const,
    batch: mapBatch(batch),
    event: {
      id: batch.event_id,
      name: batch.event_name,
      status: batch.event_status,
      eventDate: dateOnlyIso(batch.event_date),
      city: batch.event_city,
      location: batch.event_location,
    },
    items: itemRows.map((row) => ({
      id: row.id,
      fileName: row.original_file_name,
      uploadStatus: row.upload_status,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      imageAssetId: row.image_asset_id,
      imageAssetStatus: row.image_asset_status,
      imageAssetVisibility: row.image_asset_visibility,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      uploadedAt: row.uploaded_at ? toIso(row.uploaded_at) : null,
      finalizedAt: row.finalized_at ? toIso(row.finalized_at) : null,
      createdAt: toIso(row.created_at),
    })),
  };
}

export async function preparePhotographerUploadFiles(
  db: DrizzleClient,
  env: Env,
  session: ContributorSessionResult,
  batchId: string,
  body: PrepareUploadFilesBody,
) {
  const batch = await requireOpenBatchForPhotographer(db, session, batchId);
  const photographerId = session.contributor.id;
  const accountId = session.account.id;

  const items: Array<{
    itemId: string;
    fileName: string;
    uploadMethod: "SIGNED_PUT" | "NOT_CONFIGURED";
    uploadUrl: string | null;
    headers: { "content-type": string };
  }> = [];

  for (const file of body.files) {
    const ext = extensionFromFileNameAndMime(file.fileName, file.mimeType);
    if (!ext)
      throw new AppError(400, "INVALID_UPLOAD_FILE", `Unsupported file type for ${file.fileName}.`);

    const itemId = crypto.randomUUID();
    let storageKey: string;
    try {
      storageKey = buildPhotographerOriginalStorageKey({
        photographerId,
        eventId: batch.event_id,
        batchId: batch.id,
        itemId,
        extension: ext,
      });
    } catch {
      throw new AppError(400, "INVALID_UPLOAD_FILE", `Invalid upload file extension for ${file.fileName}.`);
    }

    const originalExt = ext === "jpg" ? "jpg" : ext;

    await db.execute(sql`
      insert into contributor_upload_items (
        id,
        batch_id,
        contributor_id,
        contributor_account_id,
        original_file_name,
        original_file_extension,
        mime_type,
        size_bytes,
        storage_key,
        upload_status
      )
      values (
        ${itemId}::uuid,
        ${batch.id}::uuid,
        ${photographerId}::uuid,
        ${accountId}::uuid,
        ${file.fileName},
        ${originalExt},
        ${file.mimeType},
        ${file.sizeBytes},
        ${storageKey},
        'PENDING'
      )
    `);

    const uploadUrl = await createPhotographerStagingPresignedPutUrl(env, storageKey, file.mimeType);
    const uploadMethod = uploadUrl ? ("SIGNED_PUT" as const) : ("NOT_CONFIGURED" as const);

    items.push({
      itemId,
      fileName: file.fileName,
      uploadMethod,
      uploadUrl,
      headers: { "content-type": file.mimeType },
    });
  }

  return { ok: true as const, items };
}

export async function completePhotographerUploadItem(
  db: DrizzleClient,
  env: Env,
  session: ContributorSessionResult,
  batchId: string,
  itemId: string,
) {
  const photographerId = session.contributor.id;
  const rows = await executeRows<CompleteUploadItemRow>(
    db,
    sql`
      select
        i.id,
        i.batch_id,
        i.contributor_id,
        i.image_asset_id,
        i.original_file_name,
        i.original_file_extension,
        i.mime_type,
        i.size_bytes,
        i.storage_key,
        i.upload_status,
        i.failure_code,
        i.failure_message,
        i.uploaded_at,
        i.finalized_at,
        i.created_at,
        i.updated_at,
        b.event_id as event_id,
        b.common_title as common_title,
        b.common_caption as common_caption,
        b.common_keywords as common_keywords,
        b.status as batch_status,
        b.contributor_id as batch_contributor_id
      from contributor_upload_items i
      inner join contributor_upload_batches b on b.id = i.batch_id
      where i.id = ${itemId}::uuid
        and i.batch_id = ${batchId}::uuid
        and i.contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  const row = rows[0];
  if (!row) throw new AppError(404, "UPLOAD_ITEM_NOT_FOUND", "Upload item was not found.");

  if (row.batch_contributor_id !== photographerId)
    throw new AppError(403, "UPLOAD_FORBIDDEN", "This upload does not belong to the current photographer.");

  if (row.upload_status === "ASSET_CREATED" && row.image_asset_id) {
    return {
      ok: true as const,
      itemId,
      imageAssetId: row.image_asset_id,
      uploadStatus: row.upload_status,
      idempotent: true as const,
    };
  }

  const allowedComplete = row.upload_status === "PENDING" || row.upload_status === "UPLOADED" || row.upload_status === "FAILED";
  if (!allowedComplete) throw new AppError(400, "UPLOAD_ITEM_INVALID_STATE", "This upload item cannot be completed.");

  const canVerifyWithBinding = Boolean(env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET);
  const canVerifyWithS3Api = hasPhotographerUploadsS3Config(env);
  if (!canVerifyWithBinding && !canVerifyWithS3Api) {
    throw new AppError(
      503,
      "UPLOAD_STORAGE_NOT_CONFIGURED",
      "Photographer upload staging storage is not available to verify uploads (configure MEDIA_CONTRIBUTOR_UPLOADS_BUCKET binding or CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET S3 API).",
    );
  }

  const objectExists = await verifyPhotographerStagingObjectExists(env, row.storage_key);
  if (!objectExists) {
    await db.execute(sql`
      update contributor_upload_items
      set
        upload_status = 'FAILED',
        failure_code = 'OBJECT_NOT_FOUND',
        failure_message = 'Original object is not present in storage yet.',
        updated_at = now()
      where id = ${itemId}::uuid
    `);
    throw new AppError(400, "UPLOAD_OBJECT_MISSING", "The file was not found in storage. Upload the bytes first, then retry.");
  }

  const existingAsset = await executeRows<{ id: string }>(
    db,
    sql`
      select id
      from image_assets
      where original_storage_key = ${row.storage_key}
        and contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  let imageAssetId = existingAsset[0]?.id;

  if (!imageAssetId) {
    const legacyCode = photographerUploadLegacyImageCode(itemId);
    const title = row.common_title ?? null;
    const caption = row.common_caption ?? null;
    const keywords = row.common_keywords ?? null;
    const searchText = [title, caption, keywords].filter(Boolean).join(" ").trim() || null;

    const inserted = await executeRows<{ id: string }>(
      db,
      sql`
        insert into image_assets (
          title,
          headline,
          caption,
          keywords,
          search_text,
          contributor_id,
          event_id,
          original_storage_key,
          original_file_name,
          original_file_extension,
          original_exists_in_storage,
          original_storage_checked_at,
          status,
          visibility,
          media_type,
          source,
          legacy_image_code,
          uploaded_at,
          created_at,
          updated_at
        )
        values (
          ${title},
          ${title},
          ${caption},
          ${keywords},
          ${searchText},
          ${photographerId}::uuid,
          ${row.event_id}::uuid,
          ${row.storage_key},
          ${row.original_file_name},
          ${row.original_file_extension},
          true,
          now(),
          'SUBMITTED',
          'PRIVATE',
          'IMAGE',
          'FOTOCORP',
          ${legacyCode},
          now(),
          now(),
          now()
        )
        returning id
      `,
    );
    imageAssetId = inserted[0]?.id;
    if (!imageAssetId) throw new AppError(500, "ASSET_CREATE_FAILED", "Could not create image asset.");
  }

  await db.execute(sql`
    update contributor_upload_items
    set
      upload_status = 'ASSET_CREATED',
      image_asset_id = ${imageAssetId}::uuid,
      uploaded_at = coalesce(uploaded_at, now()),
      finalized_at = now(),
      failure_code = null,
      failure_message = null,
      updated_at = now()
    where id = ${itemId}::uuid
  `);

  return {
    ok: true as const,
    itemId,
    imageAssetId,
    uploadStatus: "ASSET_CREATED" as const,
    idempotent: false as const,
  };
}

export async function submitPhotographerUploadBatch(db: DrizzleClient, session: ContributorSessionResult, batchId: string) {
  const photographerId = session.contributor.id;
  const batchRows = await executeRows<BatchRow>(
    db,
    sql`
      select
        id,
        contributor_id,
        contributor_account_id,
        event_id,
        status,
        asset_type,
        common_title,
        common_caption,
        common_keywords,
        total_files,
        uploaded_files,
        failed_files,
        submitted_at,
        created_at,
        updated_at
      from contributor_upload_batches
      where id = ${batchId}::uuid
        and contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  const batch = batchRows[0];
  if (!batch) throw new AppError(404, "UPLOAD_BATCH_NOT_FOUND", "Upload batch was not found.");

  if (batch.status === "SUBMITTED" || batch.status === "COMPLETED") {
    return {
      ok: true as const,
      batch: mapBatch(batch),
      idempotent: true as const,
    };
  }

  if (batch.status !== "OPEN")
    throw new AppError(400, "UPLOAD_BATCH_NOT_OPEN", "Only OPEN batches can be submitted.");

  const counts = await executeRows<{ total: string; asset_created: string; failed: string }>(
    db,
    sql`
      select
        count(*)::text as total,
        count(*) filter (where upload_status = 'ASSET_CREATED')::text as asset_created,
        count(*) filter (where upload_status = 'FAILED')::text as failed
      from contributor_upload_items
      where batch_id = ${batchId}::uuid
    `,
  );
  const c = counts[0];
  const assetCreated = Number(c?.asset_created ?? 0) || 0;
  if (assetCreated < 1)
    throw new AppError(400, "UPLOAD_BATCH_EMPTY", "Submit requires at least one completed upload (ASSET_CREATED).");

  const totalFiles = Number(c?.total ?? 0) || 0;
  const failedFiles = Number(c?.failed ?? 0) || 0;
  const uploadedFiles = assetCreated;

  await db.execute(sql`
    update contributor_upload_batches
    set
      status = 'SUBMITTED',
      submitted_at = now(),
      total_files = ${totalFiles},
      uploaded_files = ${uploadedFiles},
      failed_files = ${failedFiles},
      updated_at = now()
    where id = ${batchId}::uuid
      and contributor_id = ${photographerId}::uuid
      and status = 'OPEN'
  `);

  const updated = await executeRows<BatchRow>(
    db,
    sql`
      select
        id,
        contributor_id,
        contributor_account_id,
        event_id,
        status,
        asset_type,
        common_title,
        common_caption,
        common_keywords,
        total_files,
        uploaded_files,
        failed_files,
        submitted_at,
        created_at,
        updated_at
      from contributor_upload_batches
      where id = ${batchId}::uuid
      limit 1
    `,
  );
  const next = updated[0];
  if (!next) throw new AppError(500, "BATCH_UPDATE_FAILED", "Could not reload upload batch.");

  return {
    ok: true as const,
    batch: mapBatch(next),
    idempotent: false as const,
  };
}

async function requireOpenBatchForPhotographer(db: DrizzleClient, session: ContributorSessionResult, batchId: string) {
  const photographerId = session.contributor.id;
  const rows = await executeRows<BatchRow>(
    db,
    sql`
      select
        id,
        contributor_id,
        contributor_account_id,
        event_id,
        status,
        asset_type,
        common_title,
        common_caption,
        common_keywords,
        total_files,
        uploaded_files,
        failed_files,
        submitted_at,
        created_at,
        updated_at
      from contributor_upload_batches
      where id = ${batchId}::uuid
        and contributor_id = ${photographerId}::uuid
      limit 1
    `,
  );
  const batch = rows[0];
  if (!batch) throw new AppError(404, "UPLOAD_BATCH_NOT_FOUND", "Upload batch was not found.");
  if (batch.status !== "OPEN") throw new AppError(400, "UPLOAD_BATCH_NOT_OPEN", "The batch is not open for new upload instructions.");
  return batch;
}

function mapBatch(row: BatchRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    assetType: row.asset_type,
    commonTitle: row.common_title,
    commonCaption: row.common_caption,
    commonKeywords: row.common_keywords,
    totalFiles: Number(row.total_files) || 0,
    uploadedFiles: Number(row.uploaded_files) || 0,
    failedFiles: Number(row.failed_files) || 0,
    submittedAt: row.submitted_at ? toIso(row.submitted_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function dateOnlyIso(value: Date | string | null) {
  if (value === null) return null;
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
