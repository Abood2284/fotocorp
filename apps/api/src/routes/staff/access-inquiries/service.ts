import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { authIdentityClaims, assetCategories, contributors, customerAccessInquiries, imageAssets, subscriberEntitlements, users } from "../../../db/schema";
import {
  type AccessInterestAssetType,
  normalizeAccessInterestAssetType,
} from "../../../lib/access/access-interest-asset-types";
import { approveContributorApplication } from "../../../lib/access-inquiries/contributor-application";
import { PUBLIC_ROYALTY_FREE_CATEGORY_NAME } from "../../../lib/assets/public-assets";
import { AppError } from "../../../lib/errors";
import { qualityRank } from "../../../lib/subscriber-download-quality";
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

export async function listAccessInquiriesWithProfiles(
  db: DrizzleClient,
  options: {
    inquiryType?: "USER_ACCESS" | "CONTRIBUTOR_APPLICATION";
    status?: (typeof customerAccessInquiries.$inferSelect)["status"];
  } = {},
) {
  const filters = []
  if (options.inquiryType) filters.push(eq(customerAccessInquiries.inquiryType, options.inquiryType))
  if (options.status) filters.push(eq(customerAccessInquiries.status, options.status))
  const conditions = filters.length > 1 ? and(...filters) : filters[0]

  return db
    .select({
      inquiryId: customerAccessInquiries.id,
      inquiryType: customerAccessInquiries.inquiryType,
      status: customerAccessInquiries.status,
      userId: customerAccessInquiries.userId,
      contributorId: customerAccessInquiries.contributorId,
      interestedAssetTypes: customerAccessInquiries.interestedAssetTypes,
      imageQuantityRange: customerAccessInquiries.imageQuantityRange,
      imageQualityPreference: customerAccessInquiries.imageQualityPreference,
      royaltyFreeQuantityRange: customerAccessInquiries.royaltyFreeQuantityRange,
      royaltyFreeQualityPreference: customerAccessInquiries.royaltyFreeQualityPreference,
      videoQuantityRange: customerAccessInquiries.videoQuantityRange,
      caricatureQuantityRange: customerAccessInquiries.caricatureQuantityRange,
      proposedUsername: customerAccessInquiries.proposedUsername,
      createdAt: customerAccessInquiries.createdAt,
      companyName: users.companyName,
      companyEmail: users.companyEmail,
      firstName: users.firstName,
      lastName: users.lastName,
      applicantFirstName: customerAccessInquiries.applicantFirstName,
      applicantLastName: customerAccessInquiries.applicantLastName,
      applicantEmail: customerAccessInquiries.applicantEmail,
    })
    .from(customerAccessInquiries)
    .leftJoin(users, eq(customerAccessInquiries.userId, users.id))
    .where(conditions)
    .orderBy(desc(customerAccessInquiries.createdAt))
    .limit(200);
}

export async function getAccessInquiryDetail(db: DrizzleClient, inquiryId: string) {
  const rows = await db
    .select({
      inquiry: customerAccessInquiries,
      companyName: users.companyName,
      companyEmail: users.companyEmail,
      firstName: users.firstName,
      lastName: users.lastName,
      jobTitle: users.jobTitle,
      customJobTitle: users.customJobTitle,
      companyType: users.companyType,
      email: users.email,
      username: users.username,
      phoneCountryCode: users.phoneCountryCode,
      phoneNumber: users.phoneNumber,
      companyEmailDomain: users.companyEmailDomain,
      emailValidationDecision: users.emailValidationDecision,
      subscriberIsSubscriber: users.isSubscriber,
      subscriberSubscriptionStatus: users.subscriptionStatus,
      contributorDisplayName: contributors.displayName,
      contributorStatus: contributors.status,
      contributorEmail: contributors.email,
    })
    .from(customerAccessInquiries)
    .leftJoin(users, eq(customerAccessInquiries.userId, users.id))
    .leftJoin(contributors, eq(customerAccessInquiries.contributorId, contributors.id))
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const entitlements =
    row.inquiry.inquiryType === "USER_ACCESS"
      ? await db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.sourceInquiryId, inquiryId))
      : [];

  const pendingClaims =
    row.inquiry.inquiryType === "CONTRIBUTOR_APPLICATION" && row.inquiry.contributorId
      ? await db
          .select({
            claimType: authIdentityClaims.claimType,
            normalizedValue: authIdentityClaims.normalizedValue,
            status: authIdentityClaims.status,
          })
          .from(authIdentityClaims)
          .where(
            and(
              eq(authIdentityClaims.ownerType, "CONTRIBUTOR"),
              eq(authIdentityClaims.ownerId, row.inquiry.contributorId),
              eq(authIdentityClaims.status, "PENDING"),
            ),
          )
      : [];

  return {
    inquiry: row.inquiry,
    companyName: row.companyName,
    companyEmail: row.companyEmail,
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    customJobTitle: row.customJobTitle,
    companyType: row.companyType,
    email: row.email,
    username: row.username,
    phoneCountryCode: row.phoneCountryCode,
    phoneNumber: row.phoneNumber,
    companyEmailDomain: row.companyEmailDomain,
    emailValidationDecision: row.emailValidationDecision,
    subscriberAccess: {
      isSubscriber: Boolean(row.subscriberIsSubscriber),
      subscriptionStatus: row.subscriberSubscriptionStatus ?? "NONE",
    },
    contributorProfile: row.inquiry.contributorId
      ? {
          id: row.inquiry.contributorId,
          displayName: row.contributorDisplayName,
          status: row.contributorStatus,
          email: row.contributorEmail,
        }
      : null,
    pendingClaims,
    entitlements,
  };
}

export async function approveContributorApplicationInquiry(
  db: DrizzleClient,
  inquiryId: string,
  input: { username?: string | null },
) {
  return approveContributorApplication(db, inquiryId, input);
}

function buildDraftEntitlementInsertRow(
  inquiry: typeof customerAccessInquiries.$inferSelect,
  userId: string,
  assetType: AccessInterestAssetType,
  staffId: string,
) {
  if (assetType === "EDITORIAL" || assetType === "ROYALTY_FREE") {
    const quantityRange = assetType === "EDITORIAL" ? inquiry.imageQuantityRange : inquiry.royaltyFreeQuantityRange;
    const qualityPref = assetType === "EDITORIAL" ? inquiry.imageQualityPreference : inquiry.royaltyFreeQualityPreference;
    const allowed = suggestedImageDownloadsForRange(quantityRange ?? null);
    const quality = (qualityPref ?? "MEDIUM").toUpperCase();
    return {
      userId,
      sourceInquiryId: inquiry.id,
      assetType,
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
  if (assetType === "VIDEO" || assetType === "CARICATURE") {
    const quantityRange = assetType === "VIDEO" ? inquiry.videoQuantityRange : inquiry.caricatureQuantityRange;
    return {
      userId,
      sourceInquiryId: inquiry.id,
      assetType,
      allowedDownloads: suggestedImageDownloadsForRange(quantityRange ?? null),
      downloadsUsed: 0,
      qualityAccess: "HIGH" as const,
      status: "DRAFT" as const,
      validFrom: null,
      validUntil: null,
      createdByStaffId: staffId,
      approvedByStaffId: null,
    };
  }
  return {
    userId,
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
  if (detail.inquiry.inquiryType !== "USER_ACCESS") {
    throw new AppError(400, "INQUIRY_TYPE_INVALID", "Entitlement drafts apply only to customer access inquiries.");
  }

  const inquiry = detail.inquiry;
  if (!inquiry.userId) {
    throw new AppError(400, "INQUIRY_USER_MISSING", "Customer access inquiry is missing a linked user.");
  }
  const inquiryUserId = inquiry.userId;
  const typesRaw = inquiry.interestedAssetTypes ?? [];
  const uniqueAssetTypes = [
    ...new Set(
      typesRaw
        .map((t) => normalizeAccessInterestAssetType(String(t)))
        .filter((t): t is AccessInterestAssetType => t !== null),
    ),
  ];

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

    await db.insert(subscriberEntitlements).values(buildDraftEntitlementInsertRow(inquiry, inquiryUserId, upper, staffId));
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
  const updatedRow = updated[0] ?? null;
  return updatedRow ? { previous: row, updated: updatedRow } : null;
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
    .update(users)
    .set({
      isSubscriber: true,
      subscriptionStatus: "ACTIVE",
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.userId));

  if (row.sourceInquiryId) {
    await db
      .update(customerAccessInquiries)
      .set({ status: "ACCESS_GRANTED", updatedAt: new Date() })
      .where(eq(customerAccessInquiries.id, row.sourceInquiryId));
  }

  return db.select().from(subscriberEntitlements).where(eq(subscriberEntitlements.id, entitlementId)).limit(1).then((r) => r[0] ?? null);
}

/** Activate DRAFT entitlements for an inquiry (all drafts or a selected subset). */
export async function activateAllDraftEntitlementsForInquiry(
  db: DrizzleClient,
  inquiryId: string,
  staff: StaffPublicProfile,
  options: { validUntil?: Date | null; entitlementIds?: string[] } = {},
) {
  const detail = await getAccessInquiryDetail(db, inquiryId);
  if (!detail) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.");
  if (detail.inquiry.inquiryType !== "USER_ACCESS") {
    throw new AppError(400, "INQUIRY_TYPE_INVALID", "Entitlement activation applies only to customer access inquiries.");
  }

  const allDrafts = detail.entitlements.filter((e) => String(e.status).toUpperCase() === "DRAFT");
  if (!allDrafts.length) {
    throw new AppError(409, "NO_DRAFT_ENTITLEMENTS", "No draft entitlements are available to activate.");
  }

  let drafts = allDrafts;
  if (options.entitlementIds !== undefined) {
    if (!options.entitlementIds.length) {
      throw new AppError(400, "ENTITLEMENT_IDS_EMPTY", "Select at least one draft entitlement to activate.");
    }
    const draftById = new Map(allDrafts.map((e) => [e.id, e]));
    const missing = options.entitlementIds.filter((id) => !draftById.has(id));
    if (missing.length) {
      throw new AppError(
        400,
        "ENTITLEMENT_IDS_INVALID",
        "One or more entitlements are not draft rows on this inquiry.",
      );
    }
    drafts = options.entitlementIds.map((id) => draftById.get(id)!);
  }

  const invalid = drafts.filter((e) => e.allowedDownloads === null || e.allowedDownloads === undefined || e.allowedDownloads < 1);
  if (invalid.length) {
    const labels = invalid.map((e) => String(e.assetType)).join(", ");
    throw new AppError(
      400,
      "ENTITLEMENT_DRAFTS_INCOMPLETE",
      `Set a positive allowed download count on selected draft entitlements before activation (${labels}).`,
    );
  }

  const activated: (typeof subscriberEntitlements.$inferSelect)[] = [];
  for (const draft of drafts) {
    const row = await activateSubscriberEntitlement(db, draft.id, staff, options);
    if (row) activated.push(row);
  }

  return activated;
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

/** Maps catalog asset to sales/access entitlement asset_type (not raw media_type). */
export async function resolveEntitlementAssetTypeForDownload(
  db: DrizzleClient,
  assetId: string,
): Promise<AccessInterestAssetType | null> {
  const rows = await db
    .select({
      mediaType: imageAssets.mediaType,
      categoryName: assetCategories.name,
    })
    .from(imageAssets)
    .leftJoin(assetCategories, eq(imageAssets.categoryId, assetCategories.id))
    .where(eq(imageAssets.id, assetId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.categoryName === PUBLIC_ROYALTY_FREE_CATEGORY_NAME) return "ROYALTY_FREE";
  const media = String(row.mediaType ?? "").toUpperCase();
  if (media === "IMAGE") return "EDITORIAL";
  return normalizeAccessInterestAssetType(media);
}

/** Authorize subscriber download: ACTIVE entitlement rows for asset type (no quota filter), then quality then quota. */
export async function assertSubscriberDownloadEntitlementForRequest(
  db: DrizzleClient,
  userId: string,
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
        eq(subscriberEntitlements.userId, userId),
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

export async function incrementEntitlementDownloadsUsed(db: DrizzleClient, entitlementId: string, userId: string) {
  const result = await db.execute(sql`
    update subscriber_entitlements
    set downloads_used = downloads_used + 1, updated_at = now()
    where id = ${entitlementId}::uuid
      and user_id = ${userId}::uuid
      and status = 'ACTIVE'
      and (allowed_downloads is not null and downloads_used < allowed_downloads)
    returning id, allowed_downloads, downloads_used - 1 as quota_before, downloads_used as quota_after
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows;
  const row = rows?.[0] as { id: string; allowed_downloads: number; quota_before: number; quota_after: number } | undefined;
  return row ?? null;
}

/** Close a pending or in-review inquiry without granting access. */
export async function closeAccessInquiry(
  db: DrizzleClient,
  inquiryId: string,
  input: { staffNotes?: string | null } = {},
) {
  const rows = await db
    .select({ id: customerAccessInquiries.id, status: customerAccessInquiries.status })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.")

  const status = String(row.status ?? "").toUpperCase()
  if (status === "CLOSED") {
    throw new AppError(409, "INQUIRY_ALREADY_CLOSED", "This inquiry is already closed.")
  }
  if (status === "ACCESS_GRANTED" || status === "CONTRIBUTOR_APPROVED") {
    throw new AppError(409, "INQUIRY_ALREADY_RESOLVED", "Cannot close an inquiry that already granted access.")
  }

  await db
    .update(customerAccessInquiries)
    .set({
      status: "CLOSED",
      staffNotes: input.staffNotes?.trim() ? input.staffNotes.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(customerAccessInquiries.id, inquiryId))

  const updated = await db
    .select()
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1)
  return updated[0] ?? null
}

/** Update staff notes on an inquiry without changing status. */
export async function updateInquiryNotes(
  db: DrizzleClient,
  inquiryId: string,
  input: { staffNotes?: string | null } = {},
) {
  const rows = await db
    .select({ id: customerAccessInquiries.id })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.")

  await db
    .update(customerAccessInquiries)
    .set({
      staffNotes: input.staffNotes?.trim() ? input.staffNotes.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(customerAccessInquiries.id, inquiryId))

  const updated = await db
    .select()
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1)
  return updated[0] ?? null
}
