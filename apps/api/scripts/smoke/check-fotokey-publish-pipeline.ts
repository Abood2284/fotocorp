#!/usr/bin/env node
/**
 * PR-15.1 — Fotokey + photographer publish pipeline smoke.
 *
 * Always runs DB-level smoke. HTTP smoke runs only if `INTERNAL_API_SECRET` is set.
 *
 * Default smoke does NOT mutate. Set `FOTOKEY_PUBLISH_SMOKE_APPROVE=1` (and provide
 * INTERNAL_API_SECRET + DATABASE_URL) to enable a one-shot mutation that:
 *   1. picks one SUBMITTED upload-linked asset,
 *   2. POSTs to /api/v1/internal/admin/photographer-uploads/approve,
 *   3. asserts a Fotokey was assigned and asset moved to APPROVED + PRIVATE.
 *
 * Derivative generation is intentionally NOT triggered by this smoke; it only verifies
 * the approval phase. Run `pnpm --dir apps/api media:process-image-publish-jobs` for the
 * derivative phase.
 *
 * Never prints R2 keys or signed URLs.
 */
import dotenv from "dotenv";
import pg from "pg";
import type { Env } from "../../src/appTypes";
import { honoApp } from "../../src/honoApp";

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

interface DbCounts {
  fotokey_assets: string;
  duplicate_fotokeys: string;
  queued_jobs: string;
  running_jobs: string;
  approved_private: string;
  active_public_uploads: string;
  active_public_missing_derivatives: string;
}

async function main() {
  if (!databaseUrl) {
    console.log("DB smoke skipped: DATABASE_URL is missing.");
  } else {
    await runDbSmoke(databaseUrl);
  }

  const internalSecret = process.env.INTERNAL_API_SECRET?.trim();
  if (!internalSecret) {
    console.log(
      "\nHTTP fotokey publish smoke skipped: INTERNAL_API_SECRET not set.",
    );
    return;
  }
  if (!databaseUrl) {
    console.log("\nHTTP fotokey publish smoke skipped: DATABASE_URL is missing.");
    return;
  }

  const env = { DATABASE_URL: databaseUrl, INTERNAL_API_SECRET: internalSecret } as Env;

  console.log("\n--- HTTP admin list (status=SUBMITTED, default) ---");
  const listRes = await honoApp.fetch(
    new Request(
      "https://fotocorp.local/api/v1/internal/admin/photographer-uploads?status=SUBMITTED&limit=1",
      { headers: { "x-internal-api-secret": internalSecret } },
    ),
    env,
  );
  assertStatus(listRes, 200, "list submitted uploads");
  const listBody = (await listRes.json()) as {
    ok: boolean;
    uploads: Array<{
      imageAssetId: string;
      status: string;
      visibility: string;
      source: string;
      fotokey: string | null;
      canApprove: boolean;
    }>;
    pagination: { limit: number; offset: number; total: number };
  };
  console.log({
    listed: listBody.uploads.length,
    total: listBody.pagination.total,
    firstSample: listBody.uploads[0]
      ? {
          status: listBody.uploads[0].status,
          visibility: listBody.uploads[0].visibility,
          source: listBody.uploads[0].source,
          fotokey: listBody.uploads[0].fotokey ? "[set]" : null,
          canApprove: listBody.uploads[0].canApprove,
        }
      : null,
  });

  console.log("\n--- HTTP admin list (status=APPROVED) ---");
  const approvedRes = await honoApp.fetch(
    new Request(
      "https://fotocorp.local/api/v1/internal/admin/photographer-uploads?status=APPROVED&limit=1",
      { headers: { "x-internal-api-secret": internalSecret } },
    ),
    env,
  );
  assertStatus(approvedRes, 200, "list approved uploads");
  const approvedBody = (await approvedRes.json()) as {
    pagination: { total: number };
  };
  console.log({ approvedTotal: approvedBody.pagination.total });

  if (process.env.FOTOKEY_PUBLISH_SMOKE_APPROVE !== "1") {
    console.log(
      "\n--- HTTP approve (mutating): skipped (set FOTOKEY_PUBLISH_SMOKE_APPROVE=1 to enable) ---",
    );
    console.log("\nPASS fotokey publish HTTP smoke (read-only).");
    return;
  }

  const candidate = listBody.uploads[0];
  if (!candidate) {
    console.log("\n--- HTTP approve: skipped (no SUBMITTED uploads available) ---");
    return;
  }
  if (!candidate.canApprove || candidate.fotokey) {
    console.log(
      "\n--- HTTP approve: skipped (first upload is not approvable or already has fotokey) ---",
    );
    return;
  }

  console.log("\n--- HTTP approve (mutating; flag set) ---");
  const approveRes = await honoApp.fetch(
    new Request(
      "https://fotocorp.local/api/v1/internal/admin/photographer-uploads/approve",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-api-secret": internalSecret,
        },
        body: JSON.stringify({ imageAssetIds: [candidate.imageAssetId] }),
      },
    ),
    env,
  );
  assertStatus(approveRes, 200, "approve & queue publish");
  const approveBody = (await approveRes.json()) as {
    approvedCount: number;
    publishJobId: string | null;
    items: Array<{ imageAssetId: string; fotokey: string; status: "APPROVED" }>;
    skipped: Array<{ imageAssetId: string; reason: string }>;
  };
  console.log({
    approvedCount: approveBody.approvedCount,
    publishJobAssigned: Boolean(approveBody.publishJobId),
    firstFotokeyAssigned: approveBody.items[0]?.fotokey ? "[set]" : null,
    skipped: approveBody.skipped.length,
  });

  if (approveBody.approvedCount !== 1) {
    if (approveBody.skipped.length === 0) {
      throw new Error("approve returned approvedCount != 1 with no skipped items");
    }
  } else {
    if (!approveBody.publishJobId) {
      throw new Error("approve succeeded but publishJobId was null");
    }
    if (!approveBody.items[0]?.fotokey?.startsWith("FC")) {
      throw new Error("approved item missing FC-prefixed fotokey");
    }

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const row = await pool.query<{
        status: string;
        visibility: string;
        fotokey: string | null;
        original_filename: string | null;
      }>(
        `select status, visibility, fotokey, original_filename
         from image_assets
         where id = $1::uuid`,
        [candidate.imageAssetId],
      );
      const r = row.rows[0];
      if (!r) throw new Error("approved asset not found in DB");
      if (r.status !== "APPROVED" || r.visibility !== "PRIVATE") {
        throw new Error(
          `expected APPROVED+PRIVATE, got ${r.status}+${r.visibility}`,
        );
      }
      if (!r.fotokey?.startsWith("FC")) {
        throw new Error("DB row missing FC-prefixed fotokey after approval");
      }
      console.log({
        dbStatus: r.status,
        dbVisibility: r.visibility,
        dbFotokeyAssigned: Boolean(r.fotokey),
        dbOriginalFilenamePattern: r.original_filename?.startsWith("FC") ? "FC..." : null,
      });
    } finally {
      await pool.end();
    }
  }

  console.log(
    "\nPASS fotokey publish HTTP smoke (mutation phase). Note: derivatives must be generated separately via media:process-image-publish-jobs.",
  );
}

async function runDbSmoke(url: string) {
  const pool = new Pool({ connectionString: url });
  try {
    const counts = await pool.query<DbCounts>(`
      with
        f as (
          select count(*)::text as fotokey_assets
          from image_assets where fotokey is not null
        ),
        d as (
          select count(*)::text as duplicate_fotokeys
          from (
            select fotokey
            from image_assets
            where fotokey is not null
            group by fotokey
            having count(*) > 1
          ) x
        ),
        q as (
          select count(*)::text as queued_jobs
          from image_publish_jobs where status = 'QUEUED'
        ),
        r as (
          select count(*)::text as running_jobs
          from image_publish_jobs where status in ('RUNNING', 'PARTIAL_FAILED')
        ),
        ap as (
          select count(*)::text as approved_private
          from contributor_upload_items pui
          join image_assets ia on ia.id = pui.image_asset_id
          where ia.status = 'APPROVED' and ia.visibility = 'PRIVATE'
        ),
        ac as (
          select count(*)::text as active_public_uploads
          from contributor_upload_items pui
          join image_assets ia on ia.id = pui.image_asset_id
          where ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC'
        ),
        m as (
          select count(*)::text as active_public_missing_derivatives
          from image_assets ia
          left join image_derivatives thumb
            on thumb.image_asset_id = ia.id and thumb.variant = 'THUMB' and thumb.generation_status = 'READY'
          left join image_derivatives card
            on card.image_asset_id = ia.id and card.variant = 'CARD' and card.generation_status = 'READY'
          left join image_derivatives detail
            on detail.image_asset_id = ia.id and detail.variant = 'DETAIL' and detail.generation_status = 'READY'
          where ia.source = 'FOTOCORP'
            and ia.status = 'ACTIVE'
            and ia.visibility = 'PUBLIC'
            and ia.fotokey is not null
            and exists (
              select 1 from contributor_upload_items pui
              where pui.image_asset_id = ia.id
            )
            and (thumb.id is null or card.id is null or detail.id is null)
        )
      select f.fotokey_assets,
             d.duplicate_fotokeys,
             q.queued_jobs,
             r.running_jobs,
             ap.approved_private,
             ac.active_public_uploads,
             m.active_public_missing_derivatives
      from f, d, q, r, ap, ac, m
    `);
    console.log("DB fotokey publish smoke:");
    console.table([counts.rows[0]]);
  } finally {
    await pool.end();
  }
}

function assertStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} expected ${expected}, got ${response.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
