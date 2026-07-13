import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import type { Env } from "../../../appTypes"
import type { AppRequestVariables } from "../../../db"
import { createHttpDb } from "../../../db"
import { submitContributorApplication } from "../../../lib/access-inquiries/contributor-application"
import { getRequestAuditContext } from "../../../lib/request-audit-context"
import { safeSendAccessInquiryEmail, safeSendStaffInquiryEmail } from "../../../lib/email/email-service"
import { buildStaffContributorApplicationEmailData } from "../../../lib/email/staff-inquiry-email-data"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"

const submitBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  proposedUsername: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(320),
  phoneCountryCode: z.string().trim().min(1).max(8),
  phoneNumber: z.string().trim().min(1).max(32),
  applicationNotes: z.string().trim().max(4000).optional(),
})

export const publicContributorApplicationRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

publicContributorApplicationRoutes.post(
  "/api/v1/public/contributor-applications",
  zValidator("json", submitBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    const requestAudit = getRequestAuditContext(c.req.raw, {
      ipHashSecret: c.env.IP_HASH_SECRET ?? null,
    })
    const db = database(c.env)
    const result = await submitContributorApplication(db, {
      firstName: body.firstName,
      lastName: body.lastName,
      proposedUsername: body.proposedUsername,
      email: body.email,
      phoneCountryCode: body.phoneCountryCode,
      phoneNumber: body.phoneNumber,
      applicationNotes: body.applicationNotes ?? null,
      requestAudit,
    })
    await safeSendAccessInquiryEmail(db, c.env, {
      templateKey: "CONTRIBUTOR_APPLICATION_RECEIVED",
      recipient: {
        email: body.email,
        firstName: body.firstName,
        displayName: `${body.firstName} ${body.lastName}`.trim(),
      },
      relatedEntity: { type: "customer_access_inquiry", id: result.inquiryId },
    })

    await safeSendStaffInquiryEmail(db, c.env, {
      templateKey: "STAFF_NEW_CONTRIBUTOR_APPLICATION",
      relatedEntity: { type: "customer_access_inquiry", id: result.inquiryId },
      data: buildStaffContributorApplicationEmailData({
        firstName: body.firstName,
        lastName: body.lastName,
        proposedUsername: body.proposedUsername,
        email: body.email,
        phoneCountryCode: body.phoneCountryCode,
        phoneNumber: body.phoneNumber,
        applicationNotes: body.applicationNotes ?? null,
        requestAudit,
        submittedAt: result.createdAt,
      }),
    })

    return json({
      ok: true as const,
      inquiryId: result.inquiryId,
      status: result.status,
      createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
    })
  },
)

publicContributorApplicationRoutes.all("/api/v1/public/contributor-applications", () => methodNotAllowed())
