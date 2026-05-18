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
  hasContributorStagingS3Config,
  listMissingContributorStagingS3ConfigKeys,
  verifyContributorStagingObjectExists,
} from "../../../lib/r2-contributor-uploads";
import { createContributorStagingPresignedPutUrl } from "../../../lib/r2-presigned-put";
import type { ContributorSessionResult } from "../auth/service";
import type {
  CreateUploadBatchBody,
  PatchUploadAssetMetadataBody,
  PrepareUploadFilesBody,
  UploadBatchesListQuery,
} from "./validators";

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

/** Staff/internal delegate: create an OPEN batch for `targetContributorId` (caller must enforce auth). */
export async function staffDelegateCreatePhotographerUploadBatch(
  db: DrizzleClient,
  body: CreateUploadBatchBody & { targetContributorId: string },
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

  const accountRows = await executeRows<{ id: string }>(
    db,
    sql`
      select id
      from contributor_accounts
      where contributor_id = ${body.targetContributorId}::uuid
        and status = 'ACTIVE'
      order by created_at asc
      limit 1
    `,
  );
  const accountId = accountRows[0]?.id;
  if (!accountId) {
    throw new AppError(
      400,
      "CONTRIBUTOR_ACCOUNT_REQUIRED",
      "The selected photographer has no active portal account. They must sign in once before staff can upload on their behalf.",
    );
  }

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
        ${body.targetContributorId}::uuid,
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
  who_is_in_picture: string | null;
  caption: string | null;
  keywords: string | null;
  asset_updated_at: Date | string | null;
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
        ia.visibility as image_asset_visibility,
        ia.who_is_in_picture,
        ia.caption,
        ia.keywords,
        ia.updated_at as asset_updated_at
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
      whoIsInPicture: row.who_is_in_picture,
      caption: row.caption,
      keywords: row.keywords,
      assetUpdatedAt: row.asset_updated_at ? toIso(row.asset_updated_at) : null,
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
  return preparePhotographerUploadFilesCore(db, env, batch, body);
}

/** Internal/staff delegate: open batch without contributor session (caller must enforce auth). */
export async function staffDelegatePreparePhotographerUploadFiles(
  db: DrizzleClient,
  env: Env,
  batchId: string,
  body: PrepareUploadFilesBody,
) {
  const batch = await requireOpenBatchById(db, batchId);
  return preparePhotographerUploadFilesCore(db, env, batch, body);
}

async function preparePhotographerUploadFilesCore(
  db: DrizzleClient,
  env: Env,
  batch: BatchRow,
  body: PrepareUploadFilesBody,
) {
  const photographerId = batch.contributor_id;
  const accountId = batch.contributor_account_id;

  const items: Array<{
    itemId: string;
    fileName: string;
    uploadMethod: "SIGNED_PUT" | "NOT_CONFIGURED";
    uploadUrl: string | null;
    expiresAt?: string | null;
    headers: { "content-type": string };
  }> = [];

  if (!hasContributorStagingS3Config(env)) {
    const missing = listMissingContributorStagingS3ConfigKeys(env);
    console.warn("[contributor-upload] Direct R2 upload disabled — missing env:", missing.join(", "));
    throw new AppError(
      503,
      "UPLOAD_STORAGE_NOT_CONFIGURED",
      `Upload storage is not configured on the API. Add to apps/api/.dev.vars (server-side only): ${missing.join(
        ", ",
      )}. Then restart the API dev server.`,
    );
  }

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

    let signed: { uploadUrl: string; expiresAt: string };
    try {
      signed = await createContributorStagingPresignedPutUrl(env, storageKey, file.mimeType);
    } catch (cause: unknown) {
      console.error("[contributor-upload] Presign failed", { itemId, storageKey, cause });
      throw new AppError(
        502,
        "UPLOAD_SIGN_FAILED",
        "Could not create a signed upload URL. Check API R2 credentials and restart the server.",
      );
    }

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

    items.push({
      itemId,
      fileName: file.fileName,
      uploadMethod: "SIGNED_PUT",
      uploadUrl: signed.uploadUrl,
      expiresAt: signed.expiresAt,
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
  const batch = await requireOpenBatchForPhotographer(db, session, batchId);
  return completePhotographerUploadItemCore(db, env, batch, itemId);
}

/** Internal/staff delegate: complete item for an open batch (caller must enforce auth). */
export async function staffDelegateCompletePhotographerUploadItem(
  db: DrizzleClient,
  env: Env,
  batchId: string,
  itemId: string,
) {
  const batch = await requireOpenBatchById(db, batchId);
  return completePhotographerUploadItemCore(db, env, batch, itemId);
}

async function completePhotographerUploadItemCore(
  db: DrizzleClient,
  env: Env,
  batch: BatchRow,
  itemId: string,
) {
  const batchId = batch.id;
  const photographerId = batch.contributor_id;
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
  const canVerifyWithS3Api = hasContributorStagingS3Config(env);
  if (!canVerifyWithBinding && !canVerifyWithS3Api) {
    const missing = listMissingContributorStagingS3ConfigKeys(env);
    console.warn("[contributor-upload] Complete blocked — missing staging verification config:", missing.join(", "));
    throw new AppError(
      503,
      "UPLOAD_STORAGE_NOT_CONFIGURED",
      `Upload storage is not configured on the API. Configure the MEDIA_CONTRIBUTOR_UPLOADS_BUCKET binding and/or S3 API vars in apps/api/.dev.vars: ${missing.join(
        ", ",
      )}.`,
    );
  }

  const objectExists = await verifyContributorStagingObjectExists(env, row.storage_key);
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
    const whoIsInPicture = row.common_title ?? null;
    const caption = row.common_caption ?? null;
    const keywords = row.common_keywords ?? null;
    const searchText = [whoIsInPicture, caption, keywords].filter(Boolean).join(" ").trim() || null;

    const inserted = await executeRows<{ id: string }>(
      db,
      sql`
        insert into image_assets (
          who_is_in_picture,
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
          ${whoIsInPicture},
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
  const batch = await requireOpenBatchForPhotographer(db, session, batchId);
  return submitPhotographerUploadBatchCore(db, batch);
}

/** Internal/staff delegate (caller must enforce auth). */
export async function staffDelegateSubmitPhotographerUploadBatch(db: DrizzleClient, batchId: string) {
  const batch = await requireOpenBatchById(db, batchId);
  return submitPhotographerUploadBatchCore(db, batch);
}

async function submitPhotographerUploadBatchCore(db: DrizzleClient, batch: BatchRow) {
  const batchId = batch.id;
  const photographerId = batch.contributor_id;

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

async function requireOpenBatchById(db: DrizzleClient, batchId: string): Promise<BatchRow> {
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
      limit 1
    `,
  );
  const batch = rows[0];
  if (!batch) throw new AppError(404, "UPLOAD_BATCH_NOT_FOUND", "Upload batch was not found.");
  if (batch.status !== "OPEN") throw new AppError(400, "UPLOAD_BATCH_NOT_OPEN", "The batch is not open for new upload instructions.");
  return batch;
}

export async function patchPhotographerUploadAssetMetadata(
  db: DrizzleClient,
  session: ContributorSessionResult,
  batchId: string,
  imageAssetId: string,
  body: PatchUploadAssetMetadataBody,
) {
  const batch = await requireOpenBatchForPhotographer(db, session, batchId);
  return patchPhotographerUploadAssetMetadataCore(db, batch, imageAssetId, body);
}

/** Internal/staff delegate (caller must enforce auth). */
export async function staffDelegatePatchPhotographerUploadAssetMetadata(
  db: DrizzleClient,
  batchId: string,
  imageAssetId: string,
  body: PatchUploadAssetMetadataBody,
) {
  const batch = await requireOpenBatchById(db, batchId);
  return patchPhotographerUploadAssetMetadataCore(db, batch, imageAssetId, body);
}

async function patchPhotographerUploadAssetMetadataCore(
  db: DrizzleClient,
  batch: BatchRow,
  imageAssetId: string,
  body: PatchUploadAssetMetadataBody,
) {
  const photographerId = batch.contributor_id;
  const batchId = batch.id;

  const linkRows = await executeRows<{ id: string }>(
    db,
    sql`
      select i.id
      from contributor_upload_items i
      where i.batch_id = ${batch.id}::uuid
        and i.contributor_id = ${photographerId}::uuid
        and i.image_asset_id = ${imageAssetId}::uuid
        and i.upload_status = 'ASSET_CREATED'
      limit 1
    `,
  );
  if (!linkRows[0]) {
    throw new AppError(404, "UPLOAD_ASSET_NOT_FOUND", "This image is not part of your open upload batch.");
  }

  const currentRows = await executeRows<{
    who_is_in_picture: string | null;
    caption: string | null;
    keywords: string | null;
    updated_at: Date | string;
  }>(
    db,
    sql`
      select ia.who_is_in_picture, ia.caption, ia.keywords, ia.updated_at
      from image_assets ia
      where ia.id = ${imageAssetId}::uuid
        and ia.contributor_id = ${photographerId}::uuid
        and ia.source = 'FOTOCORP'
        and ia.status = 'SUBMITTED'
        and ia.visibility = 'PRIVATE'
        and ia.fotokey is null
      limit 1
    `,
  );
  const cur = currentRows[0];
  if (!cur) {
    throw new AppError(404, "UPLOAD_ASSET_NOT_FOUND", "This image is not editable.");
  }

  const nextWhoIsInPicture =
    body.whoIsInPicture !== undefined
      ? normalizeNullableText(body.whoIsInPicture, 2048)
      : (cur.who_is_in_picture ?? null);
  const nextCaption =
    body.caption !== undefined ? normalizeNullableText(body.caption, 8000) : (cur.caption ?? null);
  const nextKeywords =
    body.keywords !== undefined ? normalizeKeywordsInput(body.keywords) : (cur.keywords ?? null);
  const searchText = [nextWhoIsInPicture, nextCaption, nextKeywords].filter(Boolean).join(" ").trim() || null;

  const expectedAt = body.expectedUpdatedAt ?? toIso(cur.updated_at);
  const updated = await executeRows<{ updated_at: Date | string }>(
    db,
    sql`
      update image_assets ia
      set
        who_is_in_picture = ${nextWhoIsInPicture},
        caption = ${nextCaption},
        keywords = ${nextKeywords},
        search_text = ${searchText},
        updated_at = now()
      where ia.id = ${imageAssetId}::uuid
        and ia.contributor_id = ${photographerId}::uuid
        and ia.source = 'FOTOCORP'
        and ia.status = 'SUBMITTED'
        and ia.visibility = 'PRIVATE'
        and ia.fotokey is null
        and ia.updated_at = ${expectedAt}::timestamptz
        and exists (
          select 1
          from contributor_upload_items i
          where i.image_asset_id = ia.id
            and i.batch_id = ${batch.id}::uuid
            and i.contributor_id = ${photographerId}::uuid
        )
      returning ia.updated_at
    `,
  );
  const u = updated[0];
  if (!u) {
    const snapRows = await executeRows<{
      who_is_in_picture: string | null;
      caption: string | null;
      keywords: string | null;
      updated_at: Date | string;
    }>(
      db,
      sql`
        select ia.who_is_in_picture, ia.caption, ia.keywords, ia.updated_at
        from image_assets ia
        where ia.id = ${imageAssetId}::uuid
        limit 1
      `,
    );
    const snap = snapRows[0];
    if (!snap) {
      throw new AppError(404, "UPLOAD_ASSET_NOT_FOUND", "This image is not editable.");
    }
    throw new AppError(409, "METADATA_CONFLICT", "Another change was saved first. Reload and try again.", {
      whoIsInPicture: snap.who_is_in_picture ?? null,
      caption: snap.caption ?? null,
      keywords: snap.keywords ?? null,
      updatedAt: toIso(snap.updated_at) ?? new Date(0).toISOString(),
    });
  }

  return {
    ok: true as const,
    whoIsInPicture: nextWhoIsInPicture,
    caption: nextCaption,
    keywords: nextKeywords,
    updatedAt: toIso(u.updated_at) ?? new Date(0).toISOString(),
  };
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

function normalizeNullableText(value: string | null, maxLen: number): string | null {
  if (value === null) return null;
  const t = value.trim().slice(0, maxLen);
  return t ? t : null;
}

function normalizeKeywordsInput(value: string | string[] | null): string | null {
  if (value === null) return null;
  if (Array.isArray(value)) {
    const parts = value.map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    return parts.slice(0, 80).join(", ");
  }
  const t = value.trim();
  return t ? t.slice(0, 8000) : null;
}
