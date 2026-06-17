import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import { caricaturePreviewJobs } from "../../db/schema/caricature-preview-jobs"
import { AppError } from "../errors"
import { schedulePublishDrainWebhook } from "../jobs/publish-drain-webhook"
import {
  queueCaricaturePreviewGeneration,
  requireCaricatureAssetWithOriginal,
} from "./caricature-preview-generation"

export interface EnqueueCaricaturePreviewJobInput {
  assetId: string
  staffMemberId: string | null
  publishOnSuccess: boolean
}

export interface EnqueueCaricaturePreviewJobResult {
  ok: true
  jobId: string
  assetId: string
  publishOnSuccess: boolean
  alreadyQueued: boolean
}

export async function enqueueCaricaturePreviewJob(
  db: DrizzleClient,
  env: Env,
  input: EnqueueCaricaturePreviewJobInput,
  executionCtx?: ExecutionContext,
): Promise<EnqueueCaricaturePreviewJobResult> {
  await requireCaricatureAssetWithOriginal(db, input.assetId)

  const activeJob = await db
    .select({ id: caricaturePreviewJobs.id })
    .from(caricaturePreviewJobs)
    .where(
      and(
        eq(caricaturePreviewJobs.caricatureAssetId, input.assetId),
        inArray(caricaturePreviewJobs.status, ["QUEUED", "RUNNING"]),
      ),
    )
    .limit(1)

  if (activeJob[0]) {
    schedulePublishDrainWebhook(
      env,
      { publishJobId: activeJob[0].id, approvedCount: 1 },
      executionCtx,
    )
    return {
      ok: true,
      jobId: activeJob[0].id,
      assetId: input.assetId,
      publishOnSuccess: input.publishOnSuccess,
      alreadyQueued: true,
    }
  }

  const [created] = await db
    .insert(caricaturePreviewJobs)
    .values({
      caricatureAssetId: input.assetId,
      status: "QUEUED",
      publishOnSuccess: input.publishOnSuccess,
      requestedByStaffId: input.staffMemberId,
    })
    .returning({ id: caricaturePreviewJobs.id })

  await queueCaricaturePreviewGeneration(db, input.assetId)

  schedulePublishDrainWebhook(
    env,
    { publishJobId: created.id, approvedCount: 1 },
    executionCtx,
  )

  return {
    ok: true,
    jobId: created.id,
    assetId: input.assetId,
    publishOnSuccess: input.publishOnSuccess,
    alreadyQueued: false,
  }
}

export interface ApproveCaricatureForPublishResult {
  ok: true
  assetId: string
  jobId: string
  alreadyQueued: boolean
}

export async function approveCaricatureForPublish(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  staffMemberId: string | null,
  executionCtx?: ExecutionContext,
): Promise<ApproveCaricatureForPublishResult> {
  const rows = await db
    .select()
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const asset = rows[0]
  if (!asset) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }

  if (asset.status === "PUBLISHED") {
    throw new AppError(409, "CARICATURE_ALREADY_PUBLISHED", "This caricature is already published.")
  }

  if (asset.status === "REJECTED") {
    throw new AppError(
      409,
      "CARICATURE_REJECTED",
      "Rejected caricatures must be edited back to pending review before approval.",
    )
  }

  if (!asset.originalObjectKey?.trim()) {
    throw new AppError(
      400,
      "CARICATURE_ORIGINAL_REQUIRED",
      "Upload the original caricature image before approval.",
    )
  }

  if (asset.status !== "PENDING_REVIEW" && asset.status !== "DRAFT") {
    throw new AppError(
      400,
      "CARICATURE_STATUS_INVALID",
      "Only draft or pending-review caricatures can be approved.",
    )
  }

  if (asset.status === "DRAFT") {
    await db
      .update(caricatureAssets)
      .set({ status: "PENDING_REVIEW", updatedAt: new Date(), updatedByStaffId: staffMemberId })
      .where(eq(caricatureAssets.id, assetId))
  }

  const queued = await enqueueCaricaturePreviewJob(
    db,
    env,
    { assetId, staffMemberId, publishOnSuccess: true },
    executionCtx,
  )

  return {
    ok: true,
    assetId,
    jobId: queued.jobId,
    alreadyQueued: queued.alreadyQueued,
  }
}

export async function rejectCaricatureAsset(
  db: DrizzleClient,
  assetId: string,
  staffMemberId: string | null,
): Promise<{ ok: true; assetId: string }> {
  const rows = await db
    .select({ status: caricatureAssets.status })
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const asset = rows[0]
  if (!asset) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }

  if (asset.status === "PUBLISHED") {
    throw new AppError(409, "CARICATURE_ALREADY_PUBLISHED", "Published caricatures cannot be rejected.")
  }

  if (asset.status === "REJECTED") {
    return { ok: true, assetId }
  }

  await db
    .update(caricatureAssets)
    .set({
      status: "REJECTED",
      visibility: "PRIVATE",
      updatedAt: new Date(),
      updatedByStaffId: staffMemberId,
    })
    .where(eq(caricatureAssets.id, assetId))

  await db
    .update(caricaturePreviewJobs)
    .set({
      status: "FAILED",
      failureCode: "REJECTED",
      failureMessage: "Staff rejected this caricature before processing completed.",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(caricaturePreviewJobs.caricatureAssetId, assetId),
        inArray(caricaturePreviewJobs.status, ["QUEUED", "RUNNING"]),
      ),
    )

  return { ok: true, assetId }
}

export async function getLatestCaricaturePreviewJobStatus(
  db: DrizzleClient,
  assetId: string,
): Promise<string | null> {
  const rows = await db
    .select({ status: caricaturePreviewJobs.status })
    .from(caricaturePreviewJobs)
    .where(eq(caricaturePreviewJobs.caricatureAssetId, assetId))
    .orderBy(sql`${caricaturePreviewJobs.createdAt} DESC`)
    .limit(1)

  return rows[0]?.status ?? null
}
