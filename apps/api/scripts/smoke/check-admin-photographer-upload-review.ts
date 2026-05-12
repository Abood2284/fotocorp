#!/usr/bin/env node
/**
 * PR-15 — Admin photographer upload review smoke.
 *
 * Always runs DB-level smoke (counts of upload-linked assets by state).
 *
 * If `INTERNAL_API_SECRET` is set in the environment, also runs HTTP smoke
 * against the in-process Hono app:
 *   - GET /api/v1/internal/admin/photographer-uploads (default SUBMITTED)
 *   - HEAD-equivalent fetch of the protected original route (status code only)
 *
 * Default smoke does NOT mutate approval state.
 * Set `ADMIN_PHOTOGRAPHER_UPLOAD_REVIEW_SMOKE_APPROVE=1` to also POST a
 * single approve call against the first SUBMITTED upload (only intended for
 * non-production smoke environments).
 */
import dotenv from "dotenv";
import pg from "pg";
import type { Env } from "../../src/appTypes";
import { honoApp } from "../../src/honoApp";

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

interface SubmittedSampleRow {
  image_asset_id: string;
  status: string;
  visibility: string;
  source: string;
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
      "HTTP admin photographer upload review smoke skipped: INTERNAL_API_SECRET not set.",
    );
    return;
  }
  if (!databaseUrl) {
    console.log("HTTP admin photographer upload review smoke skipped: DATABASE_URL is missing.");
    return;
  }

  const env = { DATABASE_URL: databaseUrl, INTERNAL_API_SECRET: internalSecret } as Env;

  console.log("\n--- HTTP admin list (status=SUBMITTED, default) ---");
  const listRes = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/internal/admin/photographer-uploads", {
      headers: { "x-internal-api-secret": internalSecret },
    }),
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
      canApprove: boolean;
      photographer: { displayName: string };
      batch: { status: string };
    }>;
    pagination: { limit: number; offset: number; total: number };
  };
  console.log({
    listed: listBody.uploads.length,
    pagination: listBody.pagination,
    firstSample: listBody.uploads[0]
      ? {
          status: listBody.uploads[0].status,
          visibility: listBody.uploads[0].visibility,
          source: listBody.uploads[0].source,
          canApprove: listBody.uploads[0].canApprove,
        }
      : null,
  });

  console.log("\n--- HTTP unauth check (no internal secret) ---");
  const unauth = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/internal/admin/photographer-uploads"),
    env,
  );
  assertStatus(unauth, 401, "unauthenticated list");

  const firstUpload = listBody.uploads[0];
  if (firstUpload) {
    console.log("\n--- HTTP original route status (first submitted upload) ---");
    const originalRes = await honoApp.fetch(
      new Request(
        `https://fotocorp.local/api/v1/internal/admin/photographer-uploads/${encodeURIComponent(firstUpload.imageAssetId)}/original`,
        { headers: { "x-internal-api-secret": internalSecret } },
      ),
      env,
    );
    const ok = originalRes.status === 200 || originalRes.status === 404 || originalRes.status === 500;
    if (!ok) {
      throw new Error(
        `original route returned unexpected status ${originalRes.status} (expected 200, 404, or 500 in smoke without R2 binding)`,
      );
    }
    console.log({
      imageAssetId: firstUpload.imageAssetId,
      status: originalRes.status,
      contentType: originalRes.headers.get("content-type"),
      cacheControl: originalRes.headers.get("cache-control"),
      contentDisposition: originalRes.headers.get("content-disposition"),
    });
  } else {
    console.log("\n--- HTTP original route status: skipped (no submitted uploads) ---");
  }

  if (process.env.ADMIN_PHOTOGRAPHER_UPLOAD_REVIEW_SMOKE_APPROVE === "1") {
    if (!firstUpload) {
      console.log("\n--- HTTP approve: skipped (no submitted uploads to approve) ---");
    } else if (!firstUpload.canApprove) {
      console.log("\n--- HTTP approve: skipped (first upload is not approvable) ---");
    } else {
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
            body: JSON.stringify({ imageAssetIds: [firstUpload.imageAssetId] }),
          },
        ),
        env,
      );
      assertStatus(approveRes, 200, "approve selected");
      const approveBody = (await approveRes.json()) as {
        approvedCount: number;
        skipped: Array<{ imageAssetId: string; reason: string }>;
      };
      console.log(approveBody);
      if (approveBody.approvedCount !== 1 && approveBody.skipped.length === 0) {
        throw new Error(
          `approve returned approvedCount ${approveBody.approvedCount} with no skipped items`,
        );
      }
    }
  } else {
    console.log(
      "\n--- HTTP approve: skipped (set ADMIN_PHOTOGRAPHER_UPLOAD_REVIEW_SMOKE_APPROVE=1 to enable mutation) ---",
    );
  }

  console.log("\nPASS admin photographer upload review HTTP smoke.");
}

async function runDbSmoke(url: string) {
  const pool = new Pool({ connectionString: url });
  try {
    const submitted = await pool.query<{ submitted_private: string }>(
      `select count(*)::text as submitted_private
       from contributor_upload_items pui
       join image_assets ia on ia.id = pui.image_asset_id
       where ia.status = 'SUBMITTED' and ia.visibility = 'PRIVATE'`,
    );
    const active = await pool.query<{ active_public: string }>(
      `select count(*)::text as active_public
       from contributor_upload_items pui
       join image_assets ia on ia.id = pui.image_asset_id
       where ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC'`,
    );
    const wrongSource = await pool.query<{ wrong_source: string }>(
      `select count(*)::text as wrong_source
       from contributor_upload_items pui
       join image_assets ia on ia.id = pui.image_asset_id
       where ia.source <> 'FOTOCORP'`,
    );
    const invalidPair = await pool.query<{ invalid_pair: string }>(
      `select count(*)::text as invalid_pair
       from contributor_upload_items pui
       join image_assets ia on ia.id = pui.image_asset_id
       where not (
         (ia.status = 'SUBMITTED' and ia.visibility = 'PRIVATE')
         or
         (ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC')
       )`,
    );
    const sample = await pool.query<SubmittedSampleRow>(`
      select ia.id as image_asset_id, ia.status, ia.visibility, ia.source
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status = 'SUBMITTED' and ia.visibility = 'PRIVATE'
      order by ia.created_at desc
      limit 3
    `);

    console.log("DB admin photographer upload review smoke:");
    console.table([
      {
        submitted_private: submitted.rows[0]?.submitted_private,
        active_public: active.rows[0]?.active_public,
        wrong_source: wrongSource.rows[0]?.wrong_source,
        invalid_status_visibility_pair: invalidPair.rows[0]?.invalid_pair,
      },
    ]);
    if (sample.rows.length > 0) {
      console.log("Recent submitted/private upload-linked image_assets (sample):");
      console.table(sample.rows);
    }
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
