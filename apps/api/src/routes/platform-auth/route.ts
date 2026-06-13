import { zValidator } from "@hono/zod-validator"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { Hono } from "hono"
import type { Env } from "../../appTypes"
import { createHttpDb, type AppRequestVariables } from "../../db"
import {
  RegistrationProfileValidationError,
  validateRegistrationProfileBody,
} from "../auth/services/fotocorp-registration-profile"
import { AppError } from "../../lib/errors"
import { zodValidationHook } from "../../lib/zod-validation-hook"
import { methodNotAllowed } from "../../lib/route-errors"
import { FOTOCORP_SESSION_COOKIE, isSecureAuthCookie } from "../../lib/auth/platform-session"
import { getRequestAuditContext } from "../../lib/request-audit-context"
import {
  changePlatformUserPassword,
  getPlatformSession,
  loginPlatformAuth,
  logoutPlatformAuth,
  signUpPlatformUser,
} from "./service"
import {
  completePlatformPasswordReset,
  requestPlatformPasswordReset,
  validatePlatformPasswordResetToken,
} from "./password-reset"
import {
  platformChangePasswordSchema,
  platformForgotPasswordSchema,
  platformLoginSchema,
  platformResetPasswordSchema,
  platformSignUpSchema,
} from "./validators"
import {
  resolveStaffAccessInquiryNotifyEmail,
  resolveStaffInquiryReviewUrl,
  safeSendAccessInquiryEmail,
} from "../../lib/email/email-service"
import { isSubscriberAccessInquiryApproved } from "../../lib/access/platform-user-access"
import { findLatestInquiryForPlatformUser } from "../../lib/users/platform-user"

export const platformAuthRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

platformAuthRoutes.post(
  "/api/v1/auth/login",
  zValidator("json", platformLoginSchema, zodValidationHook),
  async (c) => {
  const body = c.req.valid("json")
  const ownerTypes =
    body.scope === "USER"
      ? (["USER"] as const)
      : body.scope === "CONTRIBUTOR"
        ? (["CONTRIBUTOR"] as const)
        : (["USER", "CONTRIBUTOR"] as const)
  const result = await loginPlatformAuth(
    db(c.env),
    { identifier: body.identifier, password: body.password },
    requestMeta(c),
    { ownerTypes: [...ownerTypes] },
  )

  setSessionCookie(c, result.rawSessionToken, result.sessionExpiresAt, result.cookieMaxAgeSeconds)

  const accessInquiry =
    result.ownerType === "USER" && result.user?.id
      ? await findLatestInquiryForPlatformUser(db(c.env), result.user.id)
      : null

  return c.json({
    ok: true,
    ownerType: result.ownerType,
    user: result.user,
    contributor: result.contributor,
    accessInquiry: accessInquiry
      ? {
          id: accessInquiry.id,
          status: accessInquiry.status,
          isApproved: isSubscriberAccessInquiryApproved(accessInquiry.status),
        }
      : null,
  })
})

platformAuthRoutes.all("/api/v1/auth/login", () => methodNotAllowed())

platformAuthRoutes.post("/api/v1/auth/logout", async (c) => {
  await logoutPlatformAuth(db(c.env), getCookie(c, FOTOCORP_SESSION_COOKIE))
  deleteSessionCookie(c)
  return c.json({ ok: true })
})

platformAuthRoutes.all("/api/v1/auth/logout", () => methodNotAllowed())

platformAuthRoutes.get("/api/v1/auth/session", async (c) => {
  const session = await getPlatformSession(db(c.env), getCookie(c, FOTOCORP_SESSION_COOKIE))
  if (!session) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")
  }

  return c.json({
    ok: true,
    ownerType: session.ownerType,
    user: session.user,
    contributor: session.contributor,
  })
})

platformAuthRoutes.all("/api/v1/auth/session", () => methodNotAllowed())

platformAuthRoutes.post(
  "/api/v1/auth/sign-up",
  zValidator("json", platformSignUpSchema, zodValidationHook),
  async (c) => {
  if (!c.env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  }
  const database = db(c.env)

  let profile
  try {
    profile = await validateRegistrationProfileBody(c.req.valid("json"))
  } catch (error) {
    if (error instanceof RegistrationProfileValidationError) {
      throw new AppError(400, error.code, error.message)
    }
    throw error
  }

  const body = c.req.valid("json")
  const requestAudit = getRequestAuditContext(c.req.raw, {
    ipHashSecret: c.env.IP_HASH_SECRET ?? null,
  })
  const result = await signUpPlatformUser(database, {
    profile,
    email: body.email,
    password: body.password,
    displayName: body.name ?? `${body.firstName} ${body.lastName}`.trim(),
    requestAudit,
  })

  if (result.user.id) {
    const inquiry = await findLatestInquiryForPlatformUser(database, result.user.id)
    if (inquiry) {
      await safeSendAccessInquiryEmail(database, c.env, {
        templateKey: "CUSTOMER_ACCESS_REQUEST_RECEIVED",
        recipient: {
          email: profile.companyEmail,
          firstName: profile.firstName,
          displayName: `${profile.firstName} ${profile.lastName}`.trim(),
        },
        relatedEntity: { type: "customer_access_inquiry", id: inquiry.id },
      })

      const staffNotifyEmail = resolveStaffAccessInquiryNotifyEmail(c.env)
      if (staffNotifyEmail) {
        await safeSendAccessInquiryEmail(database, c.env, {
          templateKey: "STAFF_NEW_ACCESS_INQUIRY",
          recipient: {
            email: staffNotifyEmail,
            firstName: "Team",
            displayName: "Fotocorp Staff",
          },
          relatedEntity: { type: "customer_access_inquiry", id: inquiry.id },
          data: {
            inquiryApplicantName: `${profile.firstName} ${profile.lastName}`.trim(),
            inquiryCompanyName: profile.companyName,
            inquiryApplicantEmail: profile.companyEmail,
            staffInquiryReviewUrl: resolveStaffInquiryReviewUrl(c.env, inquiry.id),
          },
        })
      } else {
        console.info("email_delivery_skipped", {
          reason: "staff_notify_email_missing",
          templateKey: "STAFF_NEW_ACCESS_INQUIRY",
          relatedEntityType: "customer_access_inquiry",
          relatedEntityId: inquiry.id,
        })
      }
    }
  }

  return c.json({
    ok: true,
    ownerType: result.ownerType,
    user: result.user,
  })
})

platformAuthRoutes.all("/api/v1/auth/sign-up", () => methodNotAllowed())

platformAuthRoutes.post(
  "/api/v1/auth/change-password",
  zValidator("json", platformChangePasswordSchema, zodValidationHook),
  async (c) => {
    const session = await changePlatformUserPassword(
      db(c.env),
      getCookie(c, FOTOCORP_SESSION_COOKIE),
      c.req.valid("json"),
    )

    return c.json({
      ok: true,
      ownerType: session.ownerType,
      user: session.user,
      contributor: session.contributor,
    })
  },
)

platformAuthRoutes.all("/api/v1/auth/change-password", () => methodNotAllowed())

platformAuthRoutes.post(
  "/api/v1/auth/forgot-password",
  zValidator("json", platformForgotPasswordSchema, zodValidationHook),
  async (c) => {
    const result = await requestPlatformPasswordReset(db(c.env), c.env, c.req.valid("json"), requestMeta(c))
    return c.json({ ok: true, message: result.message })
  },
)

platformAuthRoutes.all("/api/v1/auth/forgot-password", () => methodNotAllowed())

platformAuthRoutes.get("/api/v1/auth/reset-password/validate", async (c) => {
  const token = c.req.query("token")
  await validatePlatformPasswordResetToken(db(c.env), token)
  return c.json({ ok: true })
})

platformAuthRoutes.all("/api/v1/auth/reset-password/validate", () => methodNotAllowed())

platformAuthRoutes.post(
  "/api/v1/auth/reset-password",
  zValidator("json", platformResetPasswordSchema, zodValidationHook),
  async (c) => {
    const result = await completePlatformPasswordReset(db(c.env), c.req.valid("json"))
    return c.json(result)
  },
)

platformAuthRoutes.all("/api/v1/auth/reset-password", () => methodNotAllowed())

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

function requestMeta(c: { get: (key: "requestIp" | "requestUserAgent") => string | null | undefined }) {
  return {
    ip: c.get("requestIp") ?? null,
    userAgent: c.get("requestUserAgent") ?? null,
  }
}

function setSessionCookie(
  c: Parameters<typeof setCookie>[0],
  token: string,
  expiresAt: Date,
  maxAge: number,
) {
  setCookie(c, FOTOCORP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureAuthCookie(c.req.raw),
    path: "/",
    maxAge,
    expires: expiresAt,
  })
}

function deleteSessionCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, FOTOCORP_SESSION_COOKIE, {
    path: "/",
    secure: isSecureAuthCookie(c.req.raw),
    sameSite: "Lax",
  })
}
