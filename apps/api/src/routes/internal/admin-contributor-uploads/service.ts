import { sql, type SQL } from "drizzle-orm";
import type { Env } from "../../../appTypes";
import { createHttpDb, createTransactionalDb, type DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import {
  allocateFotokeysForApproval,
  approvalBusinessDateIst,
} from "../../../lib/fotokey/allocator";
import {
  buildCanonicalOriginalKey,
  normalizeCanonicalExtension,
} from "../../../lib/fotokey/canonical-key";
import { json } from "../../../lib/http";
import { getR2Object } from "../../../lib/r2";
import {
  copyStagingObjectToOriginals,
  verifyPhotographerStagingObjectExists,
} from "../../../lib/r2-contributor-uploads";
import type {
  AdminContributorUploadApproveBody,
  AdminContributorUploadListQuery,
} from "./validators";

interface AdminUploadListRow {
  image_asset_id: string;
  upload_item_id: string;
  batch_id: string;
  original_file_name: string;
  original_file_extension: string | null;
  mime_type: string | null;
  size_bytes: number | string | null;
  status: string;
  visibility: string;
  source: string;
  fotokey: string | null;
  contributor_id: string;
  contributor_legacy_id: number | string | null;
  contributor_display_name: string | null;
  event_id: string | null;
  event_name: string | null;
  event_date: Date | string | null;
  event_city: string | null;
  event_location: string | null;
  batch_status: string;
  asset_type: string | null;
  batch_submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AdminUploadOriginalRow {
  image_asset_id: string;
  media_type: string;
  status: string;
  visibility: string;
  source: string;
  original_storage_key: string | null;
  original_exists_in_storage: boolean;
  original_file_name: string;
  original_file_extension: string | null;
  mime_type: string | null;
  upload_item_id: string;
  fotokey: string | null;
}

interface ApproveCandidateRow {
  id: string;
  status: string;
  visibility: string;
  source: string;
  fotokey: string | null;
  upload_item_id: string | null;
  staging_storage_key: string | null;
  source_extension: string | null;
  mime_type: string | null;
}

type ApproveSkippedReason =
  | "NOT_FOUND"
  | "NOT_LINKED_TO_UPLOAD"
  | "NOT_FOTOCORP_SOURCE"
  | "NOT_SUBMITTED"
  | "NOT_PRIVATE"
  | "ALREADY_FOTOKEYED"
  | "STAGING_OBJECT_MISSING"
  | "UNSUPPORTED_EXTENSION"
  | "CANONICAL_COPY_FAILED";

interface ApproveSkipped {
  imageAssetId: string;
  reason: ApproveSkippedReason;
}

interface ApprovedItem {
  imageAssetId: string;
  fotokey: string;
  status: "APPROVED";
}

const DEFAULT_LIMIT = 24;
const DEFAULT_STATUS: "SUBMITTED" | "APPROVED" | "ACTIVE" | "all" = "SUBMITTED";

export async function listAdminContributorUploadsService(
  env: Env,
  query: AdminContributorUploadListQuery,
): Promise<Response> {
  const database = httpDb(env);
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = query.offset ?? 0;
  const status = query.status ?? DEFAULT_STATUS;

  const filters = buildListFilters({ ...query, status, limit, offset });
  const filterSql = filters.length > 0 ? sql.join(filters, sql` and `) : sql`true`;

  const rows = await executeRows<AdminUploadListRow>(
    database,
    sql`
      select
        ia.id as image_asset_id,
        pui.id as upload_item_id,
        pui.batch_id as batch_id,
        coalesce(ia.original_file_name, pui.original_file_name) as original_file_name,
        coalesce(ia.original_file_extension, pui.original_file_extension) as original_file_extension,
        pui.mime_type as mime_type,
        pui.size_bytes as size_bytes,
        ia.status as status,
        ia.visibility as visibility,
        ia.source as source,
        ia.fotokey as fotokey,
        ph.id as contributor_id,
        ph.legacy_photographer_id as contributor_legacy_id,
        ph.display_name as contributor_display_name,
        ev.id as event_id,
        ev.name as event_name,
        ev.event_date as event_date,
        ev.city as event_city,
        ev.location as event_location,
        b.status as batch_status,
        b.asset_type as asset_type,
        b.submitted_at as batch_submitted_at,
        ia.created_at as created_at,
        ia.updated_at as updated_at
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      join contributor_upload_batches b on b.id = pui.batch_id
      join contributors ph on ph.id = pui.contributor_id
      left join photo_events ev on ev.id = ia.event_id
      where ${filterSql}
      order by ia.created_at desc, ia.id desc
      limit ${limit}
      offset ${offset}
    `,
  );

  const totalRows = await executeRows<{ total: string }>(
    database,
    sql`
      select count(*)::text as total
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      join contributor_upload_batches b on b.id = pui.batch_id
      join contributors ph on ph.id = pui.contributor_id
      left join photo_events ev on ev.id = ia.event_id
      where ${filterSql}
    `,
  );
  const total = Number(totalRows[0]?.total ?? 0) || 0;

  return json({
    ok: true as const,
    uploads: rows.map(toUploadDto),
    pagination: { limit, offset, total },
  });
}

export async function getAdminContributorUploadOriginalService(
  env: Env,
  imageAssetId: string,
): Promise<Response> {
  const database = httpDb(env);

  const rows = await executeRows<AdminUploadOriginalRow>(
    database,
    sql`
      select
        ia.id as image_asset_id,
        ia.media_type as media_type,
        ia.status as status,
        ia.visibility as visibility,
        ia.source as source,
        ia.original_storage_key as original_storage_key,
        ia.original_exists_in_storage as original_exists_in_storage,
        coalesce(ia.original_file_name, pui.original_file_name) as original_file_name,
        coalesce(ia.original_file_extension, pui.original_file_extension) as original_file_extension,
        pui.mime_type as mime_type,
        pui.id as upload_item_id,
        ia.fotokey as fotokey
      from image_assets ia
      join contributor_upload_items pui on pui.image_asset_id = ia.id
      where ia.id = ${imageAssetId}::uuid
      limit 1
    `,
  );

  const row = rows[0];
  if (!row) {
    throw new AppError(
      404,
      "CONTRIBUTOR_UPLOAD_NOT_FOUND",
      "This image is not a photographer-submitted upload, or it does not exist.",
    );
  }

  if (!row.original_storage_key) {
    throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original image is not available.");
  }

  // Pre-Fotokey assets live in the photographer staging bucket; canonical Fotokey originals
  // live in the originals bucket. Pick the right bucket based on whether the Fotokey is set.
  const usingCanonical = Boolean(row.fotokey);
  const bucket = usingCanonical ? env.MEDIA_ORIGINALS_BUCKET : env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET;
  if (!bucket) {
    throw new AppError(
      500,
      usingCanonical ? "ORIGINAL_BUCKET_NOT_CONFIGURED" : "CONTRIBUTOR_UPLOADS_BUCKET_NOT_CONFIGURED",
      "Original image service is unavailable.",
    );
  }

  let object: Awaited<ReturnType<typeof getR2Object>> | null = null;
  try {
    object = await getR2Object(bucket, row.original_storage_key);
  } catch {
    throw new AppError(502, "R2_ERROR", "Original image service is unavailable.");
  }

  if (!object?.body) {
    throw new AppError(404, "ORIGINAL_NOT_AVAILABLE", "Original image is not available.");
  }

  const headers = new Headers();
  headers.set("Content-Type", row.mime_type ?? object.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set(
    "Content-Disposition",
    `inline; filename="${safeFileName(row.original_file_name, row.original_file_extension)}"`,
  );
  if (object.etag) headers.set("ETag", object.etag);
  if (object.contentLength !== null && object.contentLength !== undefined) {
    headers.set("Content-Length", String(object.contentLength));
  }
  if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());

  return new Response(object.body, { status: 200, headers });
}

export interface ApproveAdminContributorUploadsContext {
  requestedByAdminUserId: string | null;
}

export async function approveAdminContributorUploadsService(
  env: Env,
  body: AdminContributorUploadApproveBody,
  context: ApproveAdminContributorUploadsContext,
): Promise<Response> {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  }

  const requestedIds = unique(body.imageAssetIds);
  const skipped: ApproveSkipped[] = [];

  // Phase 1: read-only verification (HTTP db is fine for this).
  const httpDatabase = httpDb(env);
  const candidateRows = await executeRows<ApproveCandidateRow>(
    httpDatabase,
    sql`
      select
        ia.id as id,
        ia.status as status,
        ia.visibility as visibility,
        ia.source as source,
        ia.fotokey as fotokey,
        pui.id as upload_item_id,
        pui.storage_key as staging_storage_key,
        coalesce(pui.original_file_extension, ia.original_file_extension) as source_extension,
        pui.mime_type as mime_type
      from image_assets ia
      left join contributor_upload_items pui on pui.image_asset_id = ia.id
      where ia.id in (${idList(requestedIds)})
    `,
  );
  const byId = new Map<string, ApproveCandidateRow>(candidateRows.map((row) => [row.id, row]));

  interface PreparedApproval {
    imageAssetId: string;
    sourceStorageKey: string;
    sourceBucket: string;
    canonicalExtension: ReturnType<typeof normalizeCanonicalExtension>;
    mimeType: string | null;
  }
  const prepared: PreparedApproval[] = [];

  for (const id of requestedIds) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ imageAssetId: id, reason: "NOT_FOUND" });
      continue;
    }
    if (!row.upload_item_id || !row.staging_storage_key) {
      skipped.push({ imageAssetId: id, reason: "NOT_LINKED_TO_UPLOAD" });
      continue;
    }
    if (row.source !== "FOTOCORP") {
      skipped.push({ imageAssetId: id, reason: "NOT_FOTOCORP_SOURCE" });
      continue;
    }
    if (row.fotokey) {
      skipped.push({ imageAssetId: id, reason: "ALREADY_FOTOKEYED" });
      continue;
    }
    if (row.status !== "SUBMITTED") {
      skipped.push({ imageAssetId: id, reason: "NOT_SUBMITTED" });
      continue;
    }
    if (row.visibility !== "PRIVATE") {
      skipped.push({ imageAssetId: id, reason: "NOT_PRIVATE" });
      continue;
    }
    const canonicalExt = normalizeCanonicalExtension(row.source_extension);
    if (!canonicalExt) {
      skipped.push({ imageAssetId: id, reason: "UNSUPPORTED_EXTENSION" });
      continue;
    }
    prepared.push({
      imageAssetId: id,
      sourceStorageKey: row.staging_storage_key,
      sourceBucket: env.CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET ?? "",
      canonicalExtension: canonicalExt,
      mimeType: row.mime_type ?? null,
    });
  }

  // Phase 1b: verify each source object actually exists in the photographer staging bucket.
  // Fotokeys must NEVER be assigned for missing source objects.
  const verified: PreparedApproval[] = [];
  for (const item of prepared) {
    let exists = false;
    try {
      exists = await verifyPhotographerStagingObjectExists(env, item.sourceStorageKey);
    } catch {
      exists = false;
    }
    if (!exists) {
      skipped.push({ imageAssetId: item.imageAssetId, reason: "STAGING_OBJECT_MISSING" });
      continue;
    }
    verified.push(item);
  }

  if (verified.length === 0) {
    return json({
      ok: true as const,
      approvedCount: 0,
      publishJobId: null,
      items: [] as ApprovedItem[],
      skipped,
    });
  }

  // Phase 2: allocate Fotokeys in the admin-supplied order (verified preserves insertion order).
  const approvalDateIso = approvalBusinessDateIst();
  const transactional = createTransactionalDb(env.DATABASE_URL);
  let allocations: Awaited<ReturnType<typeof allocateFotokeysForApproval>> = [];
  try {
    allocations = await allocateFotokeysForApproval(transactional.db, {
      count: verified.length,
      approvalDateIso,
    });
  } finally {
    await transactional.close().catch(() => undefined);
  }

  // Phase 3: copy each verified staging object to the canonical originals bucket.
  // If a copy fails for any reason, the burnt Fotokey is left unassigned (skipped permanently).
  interface SuccessfulCopy {
    imageAssetId: string;
    fotokey: string;
    fotokeySequence: number;
    canonicalKey: string;
    canonicalExtension: NonNullable<ReturnType<typeof normalizeCanonicalExtension>>;
    sourceStorageKey: string;
    sourceBucket: string;
  }
  const successful: SuccessfulCopy[] = [];
  for (let i = 0; i < verified.length; i += 1) {
    const item = verified[i]!;
    const allocation = allocations[i]!;
    const canonicalExt = item.canonicalExtension!;
    const canonicalKey = buildCanonicalOriginalKey(allocation.fotokey, canonicalExt);
    try {
      await copyStagingObjectToOriginals(env, {
        sourceKey: item.sourceStorageKey,
        destinationKey: canonicalKey,
      });
      successful.push({
        imageAssetId: item.imageAssetId,
        fotokey: allocation.fotokey,
        fotokeySequence: allocation.sequence,
        canonicalKey,
        canonicalExtension: canonicalExt,
        sourceStorageKey: item.sourceStorageKey,
        sourceBucket: item.sourceBucket,
      });
    } catch {
      skipped.push({ imageAssetId: item.imageAssetId, reason: "CANONICAL_COPY_FAILED" });
    }
  }

  if (successful.length === 0) {
    return json({
      ok: true as const,
      approvedCount: 0,
      publishJobId: null,
      items: [] as ApprovedItem[],
      skipped,
    });
  }

  // Phase 4: persist Fotokeys + canonical keys + APPROVED state, and create publish job/items.
  const writeDb = createTransactionalDb(env.DATABASE_URL);
  let publishJobId: string;
  const approvedItems: ApprovedItem[] = [];
  try {
    publishJobId = await writeDb.db.transaction(async (tx) => {
      const jobInsert = await tx.execute(sql`
        insert into image_publish_jobs (
          job_type,
          status,
          requested_by_admin_user_id,
          total_items,
          completed_items,
          failed_items,
          created_at,
          updated_at
        )
        values (
          'CONTRIBUTOR_APPROVAL',
          'QUEUED',
          ${context.requestedByAdminUserId ?? null},
          ${successful.length},
          0,
          0,
          now(),
          now()
        )
        returning id
      `);
      const job = readFirstRow<{ id: string }>(jobInsert);
      if (!job) throw new Error("Failed to create publish job row.");

      for (const item of successful) {
        // Re-check that the row is still SUBMITTED+PRIVATE+FOTOCORP+upload-linked under this
        // transaction. If anything changed since Phase 1, don't overwrite — treat as skipped
        // (the caller will see fewer approved items than R2 copies; canonical bytes for the
        // skipped row are an accepted orphan because Fotokeys must never be reused).
        const updated = await tx.execute(sql`
          update image_assets
          set
            status = 'APPROVED',
            visibility = 'PRIVATE',
            fotokey = ${item.fotokey},
            fotokey_date = ${approvalDateIso}::date,
            fotokey_sequence = ${item.fotokeySequence},
            fotokey_assigned_at = now(),
            original_storage_key = ${item.canonicalKey},
            original_file_name = ${item.canonicalKey},
            original_file_extension = ${item.canonicalExtension},
            original_exists_in_storage = true,
            original_storage_checked_at = now(),
            updated_at = now()
          where id = ${item.imageAssetId}::uuid
            and status = 'SUBMITTED'
            and visibility = 'PRIVATE'
            and source = 'FOTOCORP'
            and fotokey is null
            and exists (
              select 1 from contributor_upload_items pui where pui.image_asset_id = image_assets.id
            )
          returning id
        `);
        const updatedRow = readFirstRow<{ id: string }>(updated);
        if (!updatedRow) {
          skipped.push({ imageAssetId: item.imageAssetId, reason: "NOT_SUBMITTED" });
          continue;
        }

        await tx.execute(sql`
          insert into image_publish_job_items (
            job_id,
            image_asset_id,
            status,
            fotokey,
            canonical_original_key,
            source_bucket,
            source_storage_key,
            created_at,
            updated_at
          )
          values (
            ${job.id}::uuid,
            ${item.imageAssetId}::uuid,
            'QUEUED',
            ${item.fotokey},
            ${item.canonicalKey},
            ${item.sourceBucket},
            ${item.sourceStorageKey},
            now(),
            now()
          )
        `);

        approvedItems.push({
          imageAssetId: item.imageAssetId,
          fotokey: item.fotokey,
          status: "APPROVED",
        });
      }

      // If some Phase 1→4 races caused per-item skips, rewrite the job's planned total.
      if (approvedItems.length !== successful.length) {
        await tx.execute(sql`
          update image_publish_jobs
          set total_items = ${approvedItems.length},
              updated_at = now()
          where id = ${job.id}::uuid
        `);
      }

      return job.id;
    });
  } finally {
    await writeDb.close().catch(() => undefined);
  }

  return json({
    ok: true as const,
    approvedCount: approvedItems.length,
    publishJobId,
    items: approvedItems,
    skipped,
  });
}

export async function getAdminContributorUploadBatchService(
  env: Env,
  batchId: string,
): Promise<Response> {
  const database = httpDb(env);

  const batchRows = await executeRows<{
    id: string;
    status: string;
    asset_type: string;
    submitted_at: Date | string | null;
    created_at: Date | string;
    contributor_id: string;
    contributor_legacy_id: number | null;
    contributor_name: string | null;
    event_id: string | null;
    event_name: string | null;
  }>(
    database,
    sql`
      select
        b.id as id,
        b.status as status,
        b.asset_type as asset_type,
        b.submitted_at as submitted_at,
        b.created_at as created_at,
        ph.id as contributor_id,
        ph.legacy_photographer_id as contributor_legacy_id,
        ph.display_name as contributor_name,
        ev.id as event_id,
        ev.name as event_name
      from contributor_upload_batches b
      join contributors ph on ph.id = b.contributor_id
      left join photo_events ev on ev.id = b.event_id
      where b.id = ${batchId}::uuid
      limit 1
    `,
  );

  const batchRow = batchRows[0];
  if (!batchRow) {
    throw new AppError(404, "BATCH_NOT_FOUND", "Contributor upload batch not found.");
  }

  const itemsQuery = {
    batchId: batchRow.id,
    limit: 500, // Reasonable max for a single batch view
    offset: 0,
    status: "all" as const,
  };

  const filters = buildListFilters(itemsQuery);
  const filterSql = filters.length > 0 ? sql.join(filters, sql` and `) : sql`true`;

  const itemsRows = await executeRows<AdminUploadListRow>(
    database,
    sql`
      select
        ia.id as image_asset_id,
        pui.id as upload_item_id,
        pui.batch_id as batch_id,
        coalesce(ia.original_file_name, pui.original_file_name) as original_file_name,
        coalesce(ia.original_file_extension, pui.original_file_extension) as original_file_extension,
        pui.mime_type as mime_type,
        pui.size_bytes as size_bytes,
        ia.status as status,
        ia.visibility as visibility,
        ia.source as source,
        ia.fotokey as fotokey,
        ph.id as contributor_id,
        ph.legacy_photographer_id as contributor_legacy_id,
        ph.display_name as contributor_display_name,
        ev.id as event_id,
        ev.name as event_name,
        ev.event_date as event_date,
        ev.city as event_city,
        ev.location as event_location,
        b.status as batch_status,
        b.asset_type as asset_type,
        b.submitted_at as batch_submitted_at,
        ia.created_at as created_at,
        ia.updated_at as updated_at
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      join contributor_upload_batches b on b.id = pui.batch_id
      join contributors ph on ph.id = pui.contributor_id
      left join photo_events ev on ev.id = ia.event_id
      where ${filterSql}
      order by ia.created_at desc, ia.id desc
    `,
  );

  return json({
    ok: true as const,
    batch: {
      id: batchRow.id,
      status: batchRow.status,
      assetType: batchRow.asset_type,
      submittedAt: toIso(batchRow.submitted_at),
      createdAt: toIso(batchRow.created_at) ?? new Date(0).toISOString(),
    },
    contributor: {
      id: batchRow.contributor_id,
      displayName: batchRow.contributor_name ?? "Unnamed contributor",
    },
    event: batchRow.event_id
      ? {
          id: batchRow.event_id,
          name: batchRow.event_name ?? "Untitled event",
        }
      : null,
    items: itemsRows.map(toUploadDto),
  });
}

function buildListFilters(
  query: AdminContributorUploadListQuery & {
    status: "SUBMITTED" | "APPROVED" | "ACTIVE" | "all";
    limit: number;
    offset: number;
  },
): SQL[] {
  const filters: SQL[] = [sql`ia.media_type = 'IMAGE'`, sql`ia.source = 'FOTOCORP'`];

  if (query.status === "SUBMITTED") {
    filters.push(sql`ia.status = 'SUBMITTED' and ia.visibility = 'PRIVATE'`);
  } else if (query.status === "APPROVED") {
    filters.push(sql`ia.status = 'APPROVED' and ia.visibility = 'PRIVATE'`);
  } else if (query.status === "ACTIVE") {
    filters.push(sql`ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC'`);
  } else {
    filters.push(sql`ia.status in ('SUBMITTED', 'APPROVED', 'ACTIVE')`);
  }

  if (query.assetType && query.assetType !== "all") {
    filters.push(sql`b.asset_type = ${query.assetType}`);
  }

  if (query.eventId) filters.push(sql`ia.event_id = ${query.eventId}::uuid`);
  if (query.contributorId) filters.push(sql`pui.contributor_id = ${query.contributorId}::uuid`);
  if (query.batchId) filters.push(sql`pui.batch_id = ${query.batchId}::uuid`);

  if (query.q) {
    const like = `%${query.q}%`;
    filters.push(sql`(
      coalesce(ia.original_file_name, '') ilike ${like}
      or coalesce(pui.original_file_name, '') ilike ${like}
      or coalesce(ia.headline, '') ilike ${like}
      or coalesce(ia.caption, '') ilike ${like}
      or coalesce(ia.keywords, '') ilike ${like}
      or coalesce(ev.name, '') ilike ${like}
      or coalesce(ph.display_name, '') ilike ${like}
      or coalesce(ia.fotokey, '') ilike ${like}
    )`);
  }

  if (query.from) {
    filters.push(sql`ia.created_at >= ${`${query.from}T00:00:00Z`}::timestamptz`);
  }
  if (query.to) {
    filters.push(sql`ia.created_at < (${`${query.to}T00:00:00Z`}::timestamptz + interval '1 day')`);
  }

  return filters;
}

function toUploadDto(row: AdminUploadListRow) {
  const status = row.status;
  const visibility = row.visibility;
  const source = row.source;
  const canApprove =
    status === "SUBMITTED" && visibility === "PRIVATE" && source === "FOTOCORP" && !row.fotokey;
  return {
    imageAssetId: row.image_asset_id,
    uploadItemId: row.upload_item_id,
    batchId: row.batch_id,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type ?? null,
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    status,
    visibility,
    source,
    assetType: row.asset_type,
    fotokey: row.fotokey ?? null,
    contributor: {
      id: row.contributor_id,
      legacyPhotographerId:
        row.contributor_legacy_id === null || row.contributor_legacy_id === undefined
          ? null
          : Number(row.contributor_legacy_id),
      displayName: row.contributor_display_name ?? "Unnamed contributor",
    },
    event: row.event_id
      ? {
          id: row.event_id,
          name: row.event_name ?? "Untitled event",
          eventDate: toIso(row.event_date),
          city: row.event_city ?? null,
          location: row.event_location ?? null,
        }
      : null,
    batch: {
      id: row.batch_id,
      status: row.batch_status,
      submittedAt: toIso(row.batch_submitted_at),
    },
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
    canApprove,
  };
}

function safeFileName(name: string, extension: string | null) {
  const fallback = "original";
  const base = (name || fallback).replace(/[\\/\r\n"]/g, "_").trim() || fallback;
  if (base.includes(".") || !extension) return base;
  return `${base}.${extension.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function idList(ids: string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

function httpDb(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  }
  return createHttpDb(env.DATABASE_URL);
}

async function executeRows<T>(database: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await database.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  return [];
}

function readFirstRow<T>(result: unknown): T | null {
  if (Array.isArray(result)) return (result[0] as T) ?? null;
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return (rows[0] as T) ?? null;
  }
  return null;
}
