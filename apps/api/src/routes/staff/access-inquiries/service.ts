import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import {
  appUserProfiles,
  customerAccessInquiries,
  fotocorpUserProfiles,
  subscriberEntitlements,
} from "../../../db/schema";
import { AppError } from "../../../lib/errors";
import { qualityRank } from "../../../lib/subscriber-download-quality";
import { recordIntendedEmailEvent } from "../../../lib/email/email-service";
import type { StaffPublicProfile } from "../auth/service";

export function suggestedImageDownloadsForRange(range: string | null): number | null {
  if (!range) return null;
  switch (range) {
    case "0_20":
      return 20;
    case "20_50":
      return 50;
    case "50_100":
      return 100;
    case "100_250":
      return 250;
    case "250_plus":
      return null;
    default:
      return null;
  }
}

export async function listAccessInquiriesWithProfiles(db: DrizzleClient) {
  return db
    .select({
      inquiryId: customerAccessInquiries.id,
      status: customerAccessInquiries.status,
      authUserId: customerAccessInquiries.authUserId,
      interestedAssetTypes: customerAccessInquiries.interestedAssetTypes,
      imageQuantityRange: customerAccessInquiries.imageQuantityRange,
      imageQualityPreference: customerAccessInquiries.imageQualityPreference,
      createdAt: customerAccessInquiries.createdAt,
      companyName: fotocorpUserProfiles.companyName,
      companyEmail: fotocorpUserProfiles.companyEmail,
      firstName: fotocorpUserProfiles.firstName,
      lastName: fotocorpUserProfiles.lastName,
    })
    .from(customerAccessInquiries)
    .innerJoin(fotocorpUserProfiles, eq(customerAccessInquiries.authUserId, fotocorpUserProfiles.userId))
    .orderBy(desc(customerAccessInquiries.createdAt))
    .limit(200);
}

export async function getAccessInquiryDetail(db: DrizzleClient, inquiryId: string) {
  const rows = await db
    .select({
      inquiry: customerAccessInquiries,
      companyName: fotocorpUserProfiles.companyName,
      companyEmail: fotocorpUserProfiles.companyEmail,
      firstName: fotocorpUserProfiles.firstName,
      lastName: fotocorpUserProfiles.lastName,
      jobTitle: fotocorpUserProfiles.jobTitle,
      companyType: fotocorpUserProfiles.companyType,
      subscriberIsSubscriber: appUserProfiles.isSubscriber,
      subscriberSubscriptionStatus: appUserProfiles.subscriptionStatus,
    })
    .from(customerAccessInquiries)
    .innerJoin(fotocorpUserProfiles, eq(customerAccessInquiries.authUserId, fotocorpUserProfiles.userId))
    .leftJoin(appUserProfiles, eq(customerAccessInquiries.authUserId, appUserProfiles.authUserId))
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const entitlements = await db
    .select()
    .from(subscriberEntitlements)
    .where(eq(subscriberEntitlements.sourceInquiryId, inquiryId));
  return {
    inquiry: row.inquiry,
    companyName: row.companyName,
    companyEmail: row.companyEmail,
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    companyType: row.companyType,
    subscriberAccess: {
      isSubscriber: Boolean(row.subscriberIsSubscriber),
      subscriptionStatus: row.subscriberSubscriptionStatus ?? "NONE",
    },
    entitlements,
  };
}

function buildDraftEntitlementInsertRow(
  inquiry: typeof customerAccessInquiries.$inferSelect,
  assetType: "IMAGE" | "VIDEO" | "CARICATURE",
  staffId: string,
) {
  if (assetType === "IMAGE") {
    const allowed = suggestedImageDownloadsForRange(inquiry.imageQuantityRange ?? null);
    const quality = (inquiry.imageQualityPreference ?? "MEDIUM").toUpperCase();
    return {
      userId: inquiry.authUserId,
      sourceInquiryId: inquiry.id,
      assetType: "IMAGE" as const,
      allowedDownloads: allowed,
      downloadsUsed: 0,
      qualityAccess: quality === "LOW" || quality === "MEDIUM" || quality === "HIGH" ? quality : "MEDIUM",
      status: "DRAFT" as const,
      validFrom: null,
      validUntil: null,
      createdByStaffId: staffId,
      approvedByStaffId: null,
    };
  }
  return {
    userId: inquiry.authUserId,
    sourceInquiryId: inquiry.id,
    assetType,
    allowedDownloads: null as number | null,
    downloadsUsed: 0,
    qualityAccess: "MEDIUM" as const,
    status: "DRAFT" as const,
    validFrom: null,
    validUntil: null,
    createdByStaffId: staffId,
    approvedByStaffId: null,
  };
}

/** Create missing DRAFT rows per inquiry asset type only. Never overwrites existing DRAFT or ACTIVE rows. */
export async function ensureEntitlementDraftsForInquiry(
  db: DrizzleClient,
  inquiryId: string,
  staff: StaffPublicProfile,
) {
  const detail = await getAccessInquiryDetail(db, inquiryId);
  if (!detail) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.");

  const inquiry = detail.inquiry;
  const typesRaw = inquiry.interestedAssetTypes ?? [];
  const uniqueAssetTypes = [...new Set(typesRaw.map((t) => String(t).toUpperCase()))].filter(
    (t): t is "IMAGE" | "VIDEO" | "CARICATURE" => t === "IMAGE" || t === "VIDEO" || t === "CARICATURE",
  );

  if (!uniqueAssetTypes.length) throw new AppError(400, "INQUIRY_EMPTY", "Inquiry has no supported asset types.");

  const staffId = staff.id;
  let insertedCount = 0;

  for (const upper of uniqueAssetTypes) {
    const existing = await db
      .select({ id: subscriberEntitlements.id })
      .from(subscriberEntitlements)
      .where(and(eq(subscriberEntitlements.sourceInquiryId, inquiryId), eq(subscriberEntitlements.assetType, upper)))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(subscriberEntitlements).values(buildDraftEntitlementInsertRow(inquiry, upper, staffId));
    insertedCount += 1;
  }

  if (insertedCount > 0 && inquiry.status === "PENDING") {
    await db
      .update(customerAccessInquiries)
      .set({ status: "IN_REVIEW", updatedAt: new Date() })
      .where(eq(customerAccessInquiries.id, inquiryId));
  }

  return db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.sourceInquiryId, inquiryId));
}

function normalizeQualityAccess(value: string): "LOW" | "MEDIUM" | "HIGH" {
  const u = value.trim().toUpperCase();
  if (u === "LOW" || u === "MEDIUM" || u === "HIGH") return u;
  throw new AppError(400, "INVALID_QUALITY_ACCESS", "Quality access must be LOW, MEDIUM, or HIGH.");
}

export async function patchSubscriberEntitlement(
  db: DrizzleClient,
  entitlementId: string,
  input: {
    allowedDownloads?: number | null;
    qualityAccess?: "LOW" | "MEDIUM" | "HIGH";
    validFrom?: Date | null;
    validUntil?: Date | null;
  },
) {
  const rows = await db
    .select()
    .from(subscriberEntitlements)
    .where(eq(subscriberEntitlements.id, entitlementId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError(404, "ENTITLEMENT_NOT_FOUND", "Entitlement was not found.");

  if (row.status === "DRAFT") {
    const nextQuality = input.qualityAccess !== undefined ? input.qualityAccess : row.qualityAccess;
    normalizeQualityAccess(nextQuality);

    await db
      .update(subscriberEntitlements)
      .set({
        allowedDownloads: input.allowedDownloads !== undefined ? input.allowedDownloads : row.allowedDownloads,
        qualityAccess: input.qualityAccess ?? row.qualityAccess,
        validFrom: input.validFrom !== undefined ? input.validFrom : row.validFrom,
        validUntil: input.validUntil !== undefined ? input.validUntil : row.validUntil,
        updatedAt: new Date(),
      })
      .where(eq(subscriberEntitlements.id, entitlementId));
  } else if (row.status === "ACTIVE") {
    const nextQuality = input.qualityAccess !== undefined ? input.qualityAccess : row.qualityAccess;
    normalizeQualityAccess(nextQuality);

    if (input.allowedDownloads !== undefined) {
      if (input.allowedDownloads === null) {
        throw new AppError(400, "ALLOWED_DOWNLOADS_REQUIRED", "Set a numeric allowed downloads cap when adjusting an active entitlement.");
      }
      if (input.allowedDownloads < 1) {
        throw new AppError(400, "ALLOWED_DOWNLOADS_INVALID", "Allowed downloads must be at least 1.");
      }
      if (input.allowedDownloads < row.downloadsUsed) {
        throw new AppError(400, "ALLOWED_DOWNLOADS_BELOW_USAGE", "Allowed downloads cannot be less than downloads already used.");
      }
    }

    await db
      .update(subscriberEntitlements)
      .set({
        allowedDownloads: input.allowedDownloads !== undefined ? input.allowedDownloads : row.allowedDownloads,
        qualityAccess: input.qualityAccess ?? row.qualityAccess,
        validFrom: input.validFrom !== undefined ? input.validFrom : row.validFrom,
        validUntil: input.validUntil !== undefined ? input.validUntil : row.validUntil,
        updatedAt: new Date(),
      })
      .where(eq(subscriberEntitlements.id, entitlementId));
  } else {
    throw new AppError(409, "ENTITLEMENT_NOT_EDITABLE", "Only draft or active entitlements can be edited with this endpoint.");
  }

  const updated = await db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.id, entitlementId)).limit(1);
  return updated[0] ?? null;
}

export async function activateSubscriberEntitlement(
  db: DrizzleClient,
  entitlementId: string,
  staff: StaffPublicProfile,
  options: { validUntil?: Date | null },
) {
  const rows = await db
    .select()
    .from(subscriberEntitlements)
    .where(eq(subscriberEntitlements.id, entitlementId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError(404, "ENTITLEMENT_NOT_FOUND", "Entitlement was not found.");
  if (row.status !== "DRAFT") throw new AppError(409, "ENTITLEMENT_NOT_ACTIVATABLE", "Only draft entitlements can be activated.");

  normalizeQualityAccess(row.qualityAccess ?? "MEDIUM");

  if (row.allowedDownloads === null || row.allowedDownloads === undefined || row.allowedDownloads < 1) {
    throw new AppError(400, "ALLOWED_DOWNLOADS_POSITIVE", "Allowed downloads must be a positive whole number before activation.");
  }

  const validFrom = row.validFrom ?? new Date();
  const validUntil = options.validUntil !== undefined ? options.validUntil : row.validUntil;

  await db
    .update(subscriberEntitlements)
    .set({
      status: "ACTIVE",
      validFrom,
      validUntil: validUntil ?? null,
      approvedByStaffId: staff.id,
      updatedAt: new Date(),
    })
    .where(eq(subscriberEntitlements.id, entitlementId));

  await db
    .update(appUserProfiles)
    .set({
      isSubscriber: true,
      subscriptionStatus: "ACTIVE",
      updatedAt: new Date(),
    })
    .where(eq(appUserProfiles.authUserId, row.userId));

  if (row.sourceInquiryId) {
    await db
      .update(customerAccessInquiries)
      .set({ status: "ACCESS_GRANTED", updatedAt: new Date() })
      .where(eq(customerAccessInquiries.id, row.sourceInquiryId));
  }

  const profileRows = await db
    .select({ email: appUserProfiles.email })
    .from(appUserProfiles)
    .where(eq(appUserProfiles.authUserId, row.userId))
    .limit(1);
  const email = profileRows[0]?.email;
  if (email) {
    recordIntendedEmailEvent({
      templateId: "entitlement_activated",
      to: email,
      subject: "Your Fotocorp download access is active",
      payload: { entitlementId, assetType: row.assetType },
      createdAt: new Date().toISOString(),
    });
  }

  return db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.id, entitlementId)).limit(1).then((r) => r[0] ?? null);
}

export async function suspendSubscriberEntitlement(db: DrizzleClient, entitlementId: string) {
  const rows = await db
    .select()
    .from(subscriberEntitlements)
    .where(eq(subscriberEntitlements.id, entitlementId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError(404, "ENTITLEMENT_NOT_FOUND", "Entitlement was not found.");
  if (row.status !== "ACTIVE") {
    throw new AppError(409, "ENTITLEMENT_NOT_SUSPENDED", "Only an active entitlement can be suspended.");
  }

  await db
    .update(subscriberEntitlements)
    .set({ status: "SUSPENDED", updatedAt: new Date() })
    .where(eq(subscriberEntitlements.id, entitlementId));

  return db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.id, entitlementId)).limit(1).then((r) => r[0] ?? null);
}

/** Authorize subscriber download: ACTIVE entitlement rows for asset type (no quota filter), then quality then quota. */
export async function assertSubscriberDownloadEntitlementForRequest(
  db: DrizzleClient,
  authUserId: string,
  assetTypeRaw: string,
  requestedQualityRank: number,
): Promise<{ entitlementId: string }> {
  const assetType = assetTypeRaw.trim().toUpperCase();
  const rows = await db
    .select({
      id: subscriberEntitlements.id,
      allowedDownloads: subscriberEntitlements.allowedDownloads,
      downloadsUsed: subscriberEntitlements.downloadsUsed,
      qualityAccess: subscriberEntitlements.qualityAccess,
    })
    .from(subscriberEntitlements)
    .where(
      and(
        eq(subscriberEntitlements.userId, authUserId),
        eq(subscriberEntitlements.status, "ACTIVE"),
        eq(subscriberEntitlements.assetType, assetType),
        or(isNull(subscriberEntitlements.validUntil), gt(subscriberEntitlements.validUntil, sql`now()`)),
        or(isNull(subscriberEntitlements.validFrom), lte(subscriberEntitlements.validFrom, sql`now()`)),
      ),
    );

  if (rows.length === 0) {
    throw new AppError(403, "ENTITLEMENT_REQUIRED", "entitlement_required");
  }

  const finite = rows.filter((r) => r.allowedDownloads !== null && r.allowedDownloads !== undefined);
  if (finite.length === 0) {
    throw new AppError(403, "ENTITLEMENT_REQUIRED", "entitlement_required");
  }

  const qualityOk = finite.filter((r) => qualityRank(r.qualityAccess) >= requestedQualityRank);
  if (qualityOk.length === 0) {
    throw new AppError(403, "QUALITY_NOT_ALLOWED", "quality_not_allowed");
  }

  const withRemaining = qualityOk.filter((r) => r.downloadsUsed < (r.allowedDownloads as number));
  if (withRemaining.length === 0) {
    const pick = qualityOk.reduce((best, r) => (r.downloadsUsed > best.downloadsUsed ? r : best), qualityOk[0]!);
    const allowed = pick.allowedDownloads as number;
    const used = pick.downloadsUsed;
    throw new AppError(403, "DOWNLOAD_LIMIT_EXCEEDED", "download_limit_exceeded", {
      allowedDownloads: allowed,
      downloadsUsed: used,
      remainingDownloads: Math.max(0, allowed - used),
    });
  }

  withRemaining.sort((a, b) => {
    const remA = (a.allowedDownloads as number) - a.downloadsUsed;
    const remB = (b.allowedDownloads as number) - b.downloadsUsed;
    if (remB !== remA) return remB - remA;
    return a.id.localeCompare(b.id);
  });

  return { entitlementId: withRemaining[0]!.id };
}

export async function incrementEntitlementDownloadsUsed(db: DrizzleClient, entitlementId: string, authUserId: string) {
  const result = await db.execute(sql`
    update subscriber_entitlements
    set downloads_used = downloads_used + 1, updated_at = now()
    where id = ${entitlementId}::uuid
      and user_id = ${authUserId}
      and status = 'ACTIVE'
      and (allowed_downloads is not null and downloads_used < allowed_downloads)
    returning id, allowed_downloads, downloads_used - 1 as quota_before, downloads_used as quota_after
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows;
  const row = rows?.[0] as { id: string; allowed_downloads: number; quota_before: number; quota_after: number } | undefined;
  return row ?? null;
}
