import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../appTypes";
import type { AppRequestVariables } from "../../../db";
import { createHttpDb } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { STAFF_SESSION_COOKIE, requireStaffSession } from "../auth/service";
import {
  activateSubscriberEntitlement,
  ensureEntitlementDraftsForInquiry,
  getAccessInquiryDetail,
  listAccessInquiriesWithProfiles,
  patchSubscriberEntitlement,
  suspendSubscriberEntitlement,
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

staffAccessInquiryRoutes.get("/api/v1/staff/access-inquiries", async (c) => {
  const { db } = await requireAccessInquiryStaff(c);
  const rows = await listAccessInquiriesWithProfiles(db);
  return json({
    ok: true as const,
    items: rows.map((r) => ({
      inquiryId: r.inquiryId,
      status: r.status,
      authUserId: r.authUserId,
      interestedAssetTypes: r.interestedAssetTypes,
      imageQuantityRange: r.imageQuantityRange,
      imageQualityPreference: r.imageQualityPreference,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      companyName: r.companyName,
      companyEmail: r.companyEmail,
      firstName: r.firstName,
      lastName: r.lastName,
    })),
  });
});

staffAccessInquiryRoutes.all("/api/v1/staff/access-inquiries", () => methodNotAllowed());

staffAccessInquiryRoutes.get("/api/v1/staff/access-inquiries/:inquiryId", zValidator("param", inquiryIdParam), async (c) => {
  const { db } = await requireAccessInquiryStaff(c);
  const { inquiryId } = c.req.valid("param");
  const detail = await getAccessInquiryDetail(db, inquiryId);
  if (!detail) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.");
  return json({
    ok: true as const,
    inquiry: {
      ...detail.inquiry,
      createdAt: detail.inquiry.createdAt?.toISOString?.() ?? detail.inquiry.createdAt,
      updatedAt: detail.inquiry.updatedAt?.toISOString?.() ?? detail.inquiry.updatedAt,
    },
    companyName: detail.companyName,
    companyEmail: detail.companyEmail,
    firstName: detail.firstName,
    lastName: detail.lastName,
    jobTitle: detail.jobTitle,
    companyType: detail.companyType,
    subscriberAccess: detail.subscriberAccess,
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

staffAccessInquiryRoutes.patch(
  "/api/v1/staff/subscriber-entitlements/:entitlementId",
  zValidator("param", entitlementIdParam),
  zValidator("json", patchEntitlementBody),
  async (c) => {
    const { db } = await requireAccessInquiryStaff(c);
    const { entitlementId } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await patchSubscriberEntitlement(db, entitlementId, {
      allowedDownloads: body.allowedDownloads,
      qualityAccess: body.qualityAccess,
      validFrom: body.validFrom === undefined ? undefined : body.validFrom === null ? null : new Date(body.validFrom),
      validUntil: body.validUntil === undefined ? undefined : body.validUntil === null ? null : new Date(body.validUntil),
    });
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
