import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../appTypes";
import type { AppRequestVariables } from "../../../db";
import { createHttpDb } from "../../../db";
import type { EmailTemplateData } from "../../../lib/email/types";
import { AppError } from "../../../lib/errors";
import {
  buildEntitlementChanges,
  sendEntitlementActivationEmail,
  sendEntitlementUpdateEmail,
} from "../../../lib/email/entitlement-email";
import { safeSendAccessInquiryEmail } from "../../../lib/email/email-service";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { STAFF_SESSION_COOKIE, requireStaffSession } from "../auth/service";
import {
  activateAllDraftEntitlementsForInquiry,
  activateSubscriberEntitlement,
  approveContributorApplicationInquiry,
  ensureEntitlementDraftsForInquiry,
  getAccessInquiryDetail,
  listAccessInquiriesWithProfiles,
  patchSubscriberEntitlement,
  suspendSubscriberEntitlement,
  closeAccessInquiry,
} from "./service";

const ACCESS_INQUIRY_ROLES = new Set(["SUPER_ADMIN", "SUPPORT", "FINANCE"]);

export const staffAccessInquiryRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}

async function requireAccessInquiryStaff(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const db = database(c.env);
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
  if (!ACCESS_INQUIRY_ROLES.has(session.staff.role)) {
    throw new AppError(403, "STAFF_FORBIDDEN", "You do not have access to customer access inquiries.");
  }
  return { db, staff: session.staff };
}

const inquiryIdParam = z.object({ inquiryId: z.string().uuid() });
const entitlementIdParam = z.object({ entitlementId: z.string().uuid() });

const patchEntitlementBody = z.object({
  allowedDownloads: z.number().int().min(0).nullable().optional(),
  qualityAccess: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
}).partial();

const activateEntitlementBody = z.object({
  validUntil: z.string().datetime().nullable().optional(),
}).partial();

const listInquiriesQuery = z.object({
  type: z.enum(["USER_ACCESS", "CONTRIBUTOR_APPLICATION"]).optional(),
  status: z.enum(["PENDING", "IN_REVIEW", "CLOSED", "ACCESS_GRANTED", "CONTRIBUTOR_APPROVED"]).optional(),
});

const closeInquiryBody = z.object({
  staffNotes: z.string().trim().max(2000).nullable().optional(),
});

const approveContributorBody = z.object({
  username: z.string().trim().min(3).max(30).optional(),
});

function serializeEntitlement(e: {
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  validFrom?: Date | string | null
  validUntil?: Date | string | null
  [key: string]: unknown
}) {
  return {
    ...e,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
    validFrom: e.validFrom ? (e.validFrom instanceof Date ? e.validFrom.toISOString() : e.validFrom) : null,
    validUntil: e.validUntil ? (e.validUntil instanceof Date ? e.validUntil.toISOString() : e.validUntil) : null,
  }
}

staffAccessInquiryRoutes.get("/api/v1/staff/access-inquiries", zValidator("query", listInquiriesQuery), async (c) => {
  const { db } = await requireAccessInquiryStaff(c);
  const query = c.req.valid("query");
  const rows = await listAccessInquiriesWithProfiles(db, {
    inquiryType: query.type,
    status: query.status,
  });
  return json({
    ok: true as const,
    items: rows.map((r) => {
      const isContributor = r.inquiryType === "CONTRIBUTOR_APPLICATION";
      const displayName = isContributor
        ? [r.applicantFirstName, r.applicantLastName].filter(Boolean).join(" ") || r.proposedUsername
        : r.companyName;
      const contactEmail = isContributor ? r.applicantEmail : r.companyEmail;
      const contactFirst = isContributor ? r.applicantFirstName : r.firstName;
      const contactLast = isContributor ? r.applicantLastName : r.lastName;
      return {
        inquiryId: r.inquiryId,
        inquiryType: r.inquiryType,
        status: r.status,
        userId: r.userId,
        contributorId: r.contributorId,
        proposedUsername: r.proposedUsername,
        interestedAssetTypes: r.interestedAssetTypes,
        imageQuantityRange: r.imageQuantityRange,
        imageQualityPreference: r.imageQualityPreference,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        companyName: displayName,
        companyEmail: contactEmail,
        firstName: contactFirst,
        lastName: contactLast,
      };
    }),
  });
});

staffAccessInquiryRoutes.all("/api/v1/staff/access-inquiries", () => methodNotAllowed());

staffAccessInquiryRoutes.get("/api/v1/staff/access-inquiries/:inquiryId", zValidator("param", inquiryIdParam), async (c) => {
  const { db } = await requireAccessInquiryStaff(c);
  const { inquiryId } = c.req.valid("param");
  const detail = await getAccessInquiryDetail(db, inquiryId);
  if (!detail) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.");
  const inquiry = detail.inquiry;
  const isContributor = inquiry.inquiryType === "CONTRIBUTOR_APPLICATION";
  return json({
    ok: true as const,
    inquiry: {
      ...inquiry,
      createdAt: inquiry.createdAt?.toISOString?.() ?? inquiry.createdAt,
      updatedAt: inquiry.updatedAt?.toISOString?.() ?? inquiry.updatedAt,
    },
    companyName: isContributor
      ? [inquiry.applicantFirstName, inquiry.applicantLastName].filter(Boolean).join(" ") || inquiry.proposedUsername
      : detail.companyName,
    companyEmail: isContributor ? inquiry.applicantEmail : detail.companyEmail,
    firstName: isContributor ? inquiry.applicantFirstName : detail.firstName,
    lastName: isContributor ? inquiry.applicantLastName : detail.lastName,
    jobTitle: isContributor ? null : detail.jobTitle,
    companyType: isContributor ? null : detail.companyType,
    subscriberAccess: detail.subscriberAccess,
    contributorProfile: detail.contributorProfile,
    pendingClaims: detail.pendingClaims,
    entitlements: detail.entitlements.map((e) => ({
      ...e,
      createdAt: e.createdAt?.toISOString?.() ?? e.createdAt,
      updatedAt: e.updatedAt?.toISOString?.() ?? e.updatedAt,
      validFrom: e.validFrom ? (e.validFrom instanceof Date ? e.validFrom.toISOString() : e.validFrom) : null,
      validUntil: e.validUntil ? (e.validUntil instanceof Date ? e.validUntil.toISOString() : e.validUntil) : null,
    })),
  });
});

staffAccessInquiryRoutes.post(
  "/api/v1/staff/access-inquiries/:inquiryId/approve-contributor",
  zValidator("param", inquiryIdParam),
  zValidator("json", approveContributorBody),
  async (c) => {
    const { db } = await requireAccessInquiryStaff(c);
    const { inquiryId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await approveContributorApplicationInquiry(db, inquiryId, { username: body.username ?? null });
    await sendInquiryStatusEmail(c.env, db, inquiryId, "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS", {
      contributorUsername: result.username,
      temporaryPassword: result.temporaryPassword,
      passwordChangeSupported: true,
    });
    return json({
      ok: true as const,
      contributorId: result.contributorId,
      username: result.username,
      temporaryPassword: result.temporaryPassword,
      inquiryId: result.inquiryId,
    });
  },
);

staffAccessInquiryRoutes.post(
  "/api/v1/staff/access-inquiries/:inquiryId/close",
  zValidator("param", inquiryIdParam),
  zValidator("json", closeInquiryBody),
  async (c) => {
    const { db } = await requireAccessInquiryStaff(c);
    const { inquiryId } = c.req.valid("param");
    const body = c.req.valid("json");
    const inquiry = await closeAccessInquiry(db, inquiryId, { staffNotes: body.staffNotes ?? null });
    await sendInquiryStatusEmail(c.env, db, inquiryId);
    return json({
      ok: true as const,
      inquiry: {
        ...inquiry,
        createdAt: inquiry.createdAt?.toISOString?.() ?? inquiry.createdAt,
        updatedAt: inquiry.updatedAt?.toISOString?.() ?? inquiry.updatedAt,
      },
    });
  },
);

staffAccessInquiryRoutes.post(
  "/api/v1/staff/access-inquiries/:inquiryId/entitlement-draft",
  zValidator("param", inquiryIdParam),
  async (c) => {
    const { db, staff } = await requireAccessInquiryStaff(c);
    const { inquiryId } = c.req.valid("param");
    const rows = await ensureEntitlementDraftsForInquiry(db, inquiryId, staff);
    return json({
      ok: true as const,
      entitlements: rows.map((e) => ({
        ...e,
        createdAt: e.createdAt?.toISOString?.() ?? e.createdAt,
        updatedAt: e.updatedAt?.toISOString?.() ?? e.updatedAt,
        validFrom: e.validFrom ? (e.validFrom instanceof Date ? e.validFrom.toISOString() : e.validFrom) : null,
        validUntil: e.validUntil ? (e.validUntil instanceof Date ? e.validUntil.toISOString() : e.validUntil) : null,
      })),
    });
  },
);

staffAccessInquiryRoutes.post(
  "/api/v1/staff/access-inquiries/:inquiryId/activate-entitlements",
  zValidator("param", inquiryIdParam),
  zValidator("json", activateEntitlementBody),
  async (c) => {
    const { db, staff } = await requireAccessInquiryStaff(c);
    const { inquiryId } = c.req.valid("param");
    const body = c.req.valid("json");
    const activated = await activateAllDraftEntitlementsForInquiry(db, inquiryId, staff, {
      validUntil: body.validUntil === undefined ? undefined : body.validUntil === null ? null : new Date(body.validUntil),
    });
    const batchId = `${inquiryId}:${activated.map((row) => row.id).sort().join(",")}`;
    await sendEntitlementActivationEmail(c.env, db, inquiryId, activated, { batchId });
    return json({
      ok: true as const,
      entitlements: activated.map(serializeEntitlement),
    });
  },
);

staffAccessInquiryRoutes.patch(
  "/api/v1/staff/subscriber-entitlements/:entitlementId",
  zValidator("param", entitlementIdParam),
  zValidator("json", patchEntitlementBody),
  async (c) => {
    const { db } = await requireAccessInquiryStaff(c);
    const { entitlementId } = c.req.valid("param");
    const body = c.req.valid("json");
    const patchResult = await patchSubscriberEntitlement(db, entitlementId, {
      allowedDownloads: body.allowedDownloads,
      qualityAccess: body.qualityAccess,
      validFrom: body.validFrom === undefined ? undefined : body.validFrom === null ? null : new Date(body.validFrom),
      validUntil: body.validUntil === undefined ? undefined : body.validUntil === null ? null : new Date(body.validUntil),
    });
    const updated = patchResult?.updated ?? null;

    if (patchResult && patchResult.previous.status === "ACTIVE" && updated?.sourceInquiryId) {
      const changes = buildEntitlementChanges(patchResult.previous, updated);
      const updatedAt = updated.updatedAt instanceof Date ? updated.updatedAt : new Date(String(updated.updatedAt));
      if (changes.length) {
        await sendEntitlementUpdateEmail(c.env, db, updated.sourceInquiryId, entitlementId, changes, updatedAt);
      }
    }

    return json({
      ok: true as const,
      entitlement: updated ? serializeEntitlement(updated) : null,
    });
  },
);

staffAccessInquiryRoutes.post(
  "/api/v1/staff/subscriber-entitlements/:entitlementId/activate",
  zValidator("param", entitlementIdParam),
  zValidator("json", activateEntitlementBody),
  async (c) => {
    const { db, staff } = await requireAccessInquiryStaff(c);
    const { entitlementId } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await activateSubscriberEntitlement(db, entitlementId, staff, {
      validUntil: body.validUntil === undefined ? undefined : body.validUntil === null ? null : new Date(body.validUntil),
    });
    if (updated?.sourceInquiryId) {
      await sendEntitlementActivationEmail(c.env, db, updated.sourceInquiryId, [updated]);
    }
    return json({
      ok: true as const,
      entitlement: updated ? serializeEntitlement(updated) : null,
    });
  },
);

async function sendInquiryStatusEmail(
  env: Env,
  db: ReturnType<typeof database>,
  inquiryId: string,
  explicitTemplateKey?: "CUSTOMER_ACCESS_APPROVED" | "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS",
  data?: EmailTemplateData,
) {
  const detail = await getAccessInquiryDetail(db, inquiryId);
  if (!detail) return;

  const inquiry = detail.inquiry;
  const isContributor = inquiry.inquiryType === "CONTRIBUTOR_APPLICATION";
  const email = isContributor ? inquiry.applicantEmail : detail.companyEmail;
  if (!email) {
    console.info("email_delivery_skipped", {
      reason: "recipient_email_missing",
      templateKey: explicitTemplateKey ?? (isContributor ? "CONTRIBUTOR_APPLICATION_REJECTED" : "CUSTOMER_ACCESS_REJECTED"),
      relatedEntityType: "customer_access_inquiry",
      relatedEntityId: inquiryId,
    });
    return;
  }

  const templateKey = explicitTemplateKey ?? (isContributor ? "CONTRIBUTOR_APPLICATION_REJECTED" : "CUSTOMER_ACCESS_REJECTED");
  await safeSendAccessInquiryEmail(db, env, {
    templateKey,
    recipient: {
      email,
      firstName: isContributor ? inquiry.applicantFirstName : detail.firstName,
      displayName: isContributor
        ? [inquiry.applicantFirstName, inquiry.applicantLastName].filter(Boolean).join(" ")
        : detail.companyName,
    },
    relatedEntity: { type: "customer_access_inquiry", id: inquiryId },
    data,
  });
}

staffAccessInquiryRoutes.post(
  "/api/v1/staff/subscriber-entitlements/:entitlementId/suspend",
  zValidator("param", entitlementIdParam),
  async (c) => {
    const { db } = await requireAccessInquiryStaff(c);
    const { entitlementId } = c.req.valid("param");
    const updated = await suspendSubscriberEntitlement(db, entitlementId);
    return json({
      ok: true as const,
      entitlement: updated
        ? {
            ...updated,
            createdAt: updated.createdAt?.toISOString?.() ?? updated.createdAt,
            updatedAt: updated.updatedAt?.toISOString?.() ?? updated.updatedAt,
            validFrom: updated.validFrom ? (updated.validFrom instanceof Date ? updated.validFrom.toISOString() : updated.validFrom) : null,
            validUntil: updated.validUntil
              ? updated.validUntil instanceof Date
                ? updated.validUntil.toISOString()
                : updated.validUntil
              : null,
          }
        : null,
    });
  },
);
