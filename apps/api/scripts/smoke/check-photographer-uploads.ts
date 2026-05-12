#!/usr/bin/env node
/**
 * Photographer upload smoke.
 *
 * Prepare-only (default with credentials): login → batch → prepare → assert shape → logout.
 * Full R2 path: set PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1 plus CLOUDFLARE_R2_* and matching bucket name.
 */
import dotenv from "dotenv";
import pg from "pg";
import type { Env } from "../../src/appTypes";
import { honoApp } from "../../src/honoApp";
import { CONTRIBUTOR_SESSION_COOKIE } from "../../src/routes/contributor/auth/service";

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

/** Minimal valid JPEG (JFIF), for PUT body — `sizeBytes` in prepare must match byte length. */
const TINY_JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALCwwODQ4QEhITFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Af/Z",
  "base64",
);

async function main() {
  if (databaseUrl) await runDbSmoke(databaseUrl);
  else console.log("DB smoke skipped: DATABASE_URL is missing.");

  const username = process.env.PHOTOGRAPHER_SMOKE_USERNAME;
  const password = process.env.PHOTOGRAPHER_SMOKE_PASSWORD;
  if (!username || !password) {
    console.log(
      "HTTP photographer uploads smoke skipped: PHOTOGRAPHER_SMOKE_USERNAME and PHOTOGRAPHER_SMOKE_PASSWORD are not set.",
    );
    return;
  }
  if (!databaseUrl) {
    console.log("HTTP photographer uploads smoke skipped: DATABASE_URL is missing.");
    return;
  }

  const env = buildApiEnv(databaseUrl);
  const cookieHeader = await loginAndCookie(env, username, password);

  const eventsRes = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/events?scope=available&limit=1", {
      headers: { cookie: cookieHeader },
    }),
    env,
  );
  assertStatus(eventsRes, 200, "list available events");
  const eventsBody = (await eventsRes.json()) as { events?: Array<{ id: string }> };
  const eventId = eventsBody.events?.[0]?.id;
  if (!eventId) throw new Error("no active event available for upload batch smoke");

  const createBatchRes = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/upload-batches", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ eventId, commonTitle: "Smoke batch" }),
    }),
    env,
  );
  assertStatus(createBatchRes, 201, "create upload batch");
  const batchBody = (await createBatchRes.json()) as { batch?: { id?: string } };
  const batchId = batchBody.batch?.id;
  if (!batchId) throw new Error("create batch did not return batch.id");

  const jpegSize = TINY_JPEG_BYTES.byteLength;
  const prepareRes = await honoApp.fetch(
    new Request(`https://fotocorp.local/api/v1/contributor/upload-batches/${batchId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({
        files: [{ fileName: "smoke.jpg", mimeType: "image/jpeg", sizeBytes: jpegSize }],
      }),
    }),
    env,
  );
  assertStatus(prepareRes, 201, "prepare upload files");
  const prepareBody = (await prepareRes.json()) as {
    items?: Array<{ itemId?: string; uploadMethod?: string; uploadUrl?: string | null; headers?: { "content-type"?: string } }>;
  };
  const item = prepareBody.items?.[0];
  const itemId = item?.itemId;
  const uploadMethod = item?.uploadMethod;
  if (!itemId) throw new Error("prepare files did not return itemId");
  if (uploadMethod !== "SIGNED_PUT" && uploadMethod !== "NOT_CONFIGURED") {
    throw new Error(`unexpected uploadMethod: ${uploadMethod}`);
  }
  if (uploadMethod === "SIGNED_PUT") {
    if (!item?.uploadUrl || !item.uploadUrl.startsWith("https://")) throw new Error("SIGNED_PUT missing https uploadUrl");
    if (item.headers?.["content-type"] !== "image/jpeg") throw new Error("expected content-type image/jpeg in instructions");
    console.log("prepare: SIGNED_PUT ok, uploadUrl:", redactPresignedUrl(item.uploadUrl));
  } else {
    console.log("prepare: NOT_CONFIGURED (CLOUDFLARE_R2_* incomplete in process env for API)");
  }

  const realR2 = process.env.PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2 === "1";
  if (!realR2) {
    await logout(env, cookieHeader);
    console.log("PASS photographer uploads HTTP smoke (prepare only; set PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1 for PUT+complete+submit).");
    return;
  }

  if (uploadMethod !== "SIGNED_PUT" || !item?.uploadUrl) {
    throw new Error(
      "PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1 requires SIGNED_PUT and uploadUrl; set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_ORIGINALS_BUCKET (same bucket as Worker MEDIA_ORIGINALS_BUCKET).",
    );
  }

  const r2Configured =
    Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim()) &&
    Boolean(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim()) &&
    Boolean(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim()) &&
    Boolean(process.env.CLOUDFLARE_R2_ORIGINALS_BUCKET?.trim());
  if (!r2Configured) {
    throw new Error("PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1 requires full CLOUDFLARE_R2_* env for presign and complete (S3 head fallback).");
  }

  const putRes = await fetch(item.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: TINY_JPEG_BYTES,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`R2 PUT failed: ${putRes.status} ${text.slice(0, 200)}`);
  }
  console.log("R2 PUT: ok (status", putRes.status + ")");

  await new Promise((r) => setTimeout(r, 400));

  const completeRes = await honoApp.fetch(
    new Request(
      `https://fotocorp.local/api/v1/contributor/upload-batches/${batchId}/files/${itemId}/complete`,
      { method: "POST", headers: { cookie: cookieHeader } },
    ),
    env,
  );
  assertStatus(completeRes, 200, "complete upload item");
  const completeJson = (await completeRes.json()) as { uploadStatus?: string; imageAssetId?: string };
  if (completeJson.uploadStatus !== "ASSET_CREATED") throw new Error(`complete expected ASSET_CREATED, got ${completeJson.uploadStatus}`);

  const submitRes = await honoApp.fetch(
    new Request(`https://fotocorp.local/api/v1/contributor/upload-batches/${batchId}/submit`, {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
    env,
  );
  assertStatus(submitRes, 200, "submit batch");
  const submitJson = (await submitRes.json()) as { batch?: { status?: string } };
  if (submitJson.batch?.status !== "SUBMITTED") throw new Error(`submit expected SUBMITTED, got ${submitJson.batch?.status}`);

  await logout(env, cookieHeader);

  await printRecentUploadRows(databaseUrl, itemId);

  console.log("PASS photographer uploads HTTP smoke (real R2 PUT + complete + submit).");
}

function buildApiEnv(databaseUrl: string): Env {
  return {
    DATABASE_URL: databaseUrl,
    CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_ORIGINALS_BUCKET: process.env.CLOUDFLARE_R2_ORIGINALS_BUCKET,
  } as Env;
}

function redactPresignedUrl(url: string): string {
  try {
    const u = new URL(url);
    const redacted = `${u.origin}${u.pathname}?[redacted]`;
    return redacted;
  } catch {
    return "[invalid-url]";
  }
}

async function logout(env: Env, cookieHeader: string) {
  await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
    env,
  );
}

async function printRecentUploadRows(url: string, assertItemId: string) {
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query<Record<string, unknown>>(`
      select
        ia.id,
        ia.legacy_image_code,
        ia.status,
        ia.visibility,
        ia.source,
        ia.original_exists_in_storage,
        ia.original_storage_checked_at,
        ia.contributor_id,
        ia.event_id,
        i.upload_status,
        b.status as batch_status
      from contributor_upload_items i
      join contributor_upload_batches b on b.id = i.batch_id
      left join image_assets ia on ia.id = i.image_asset_id
      where i.created_at >= now() - interval '30 minutes'
      order by i.created_at desc
      limit 5
    `);
    console.log("Recent upload rows (last 30m, up to 5):");
    console.table(rows);
    const target = rows.find((r) => (r as { i?: { id?: string } }).id === assertItemId) ?? rows.find(() => false);
    const byId = await pool.query<Record<string, unknown>>(
      `
      select
        ia.id,
        ia.legacy_image_code,
        ia.status,
        ia.visibility,
        ia.source,
        ia.original_exists_in_storage,
        ia.original_storage_checked_at,
        ia.contributor_id,
        ia.event_id,
        i.upload_status,
        b.status as batch_status
      from contributor_upload_items i
      join contributor_upload_batches b on b.id = i.batch_id
      left join image_assets ia on ia.id = i.image_asset_id
      where i.id = $1::uuid
    `,
      [assertItemId],
    );
    const last = byId.rows[0];
    if (!last) throw new Error(`assert: no upload item row for itemId ${assertItemId}`);
    if (last.status !== "SUBMITTED") throw new Error(`assert: image_assets.status expected SUBMITTED, got ${String(last.status)}`);
    if (last.visibility !== "PRIVATE") throw new Error(`assert: visibility expected PRIVATE, got ${String(last.visibility)}`);
    if (last.source !== "FOTOCORP") throw new Error(`assert: source expected FOTOCORP, got ${String(last.source)}`);
    if (last.upload_status !== "ASSET_CREATED") {
      throw new Error(`assert: item upload_status expected ASSET_CREATED, got ${String(last.upload_status)}`);
    }
    if (last.batch_status !== "SUBMITTED") {
      throw new Error(`assert: batch_status expected SUBMITTED, got ${String(last.batch_status)}`);
    }
  } finally {
    await pool.end();
  }
}

async function runDbSmoke(url: string) {
  const pool = new Pool({ connectionString: url });
  try {
    const batches = await pool.query<{ c: string }>(`select count(*)::text as c from contributor_upload_batches`);
    const items = await pool.query<{ c: string }>(`select count(*)::text as c from contributor_upload_items`);
    const assets = await pool.query<{ c: string }>(`
      select count(*)::text as c
      from image_assets ia
      where exists (select 1 from contributor_upload_items pui where pui.image_asset_id = ia.id)
    `);
    console.log("DB photographer uploads smoke:", {
      upload_batches: batches.rows[0]?.c,
      upload_items: items.rows[0]?.c,
      photographer_upload_linked_image_assets: assets.rows[0]?.c,
    });
  } finally {
    await pool.end();
  }
}

async function loginAndCookie(env: Env, username: string, password: string) {
  const login = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
    env,
  );
  assertStatus(login, 200, "login");
  const setCookieValues = readSetCookieValues(login.headers);
  const sessionCookie =
    setCookieValues.find((value) => value.trimStart().startsWith(`${CONTRIBUTOR_SESSION_COOKIE}=`)) ?? setCookieValues[0];
  return sessionCookie.split(";")[0]!.trim();
}

function readSetCookieValues(headers: Headers) {
  const results: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") results.push(value);
  });
  return results;
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
