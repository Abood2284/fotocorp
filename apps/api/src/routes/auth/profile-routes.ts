import { getCookie } from "hono/cookie"
import { Hono } from "hono"
import type { Env } from "../../appTypes"
import { createHttpDb } from "../../db"
import { AppError } from "../../lib/errors"
import { errorResponse, json } from "../../lib/http"
import { FOTOCORP_SESSION_COOKIE } from "../../lib/auth/platform-session"
import { getPlatformSession } from "../platform-auth/service"
import {
  findLatestInquiryForUser,
  getFotocorpUserProfileByUserId,
  toFotocorpUserProfileDto,
} from "./services/fotocorp-registration-profile"

export const authProfileRoutes = new Hono<{ Bindings: Env }>()

authProfileRoutes.get("/api/v1/auth/me", async (c) => {
  if (!c.env.DATABASE_URL) {
    return errorResponse(
      new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured."),
    )
  }

  const session = await getPlatformSession(createHttpDb(c.env.DATABASE_URL), getCookie(c, FOTOCORP_SESSION_COOKIE))
  if (!session?.user || session.ownerType !== "USER") {
    return errorResponse(new AppError(401, "AUTH_REQUIRED", "Authentication is required."))
  }

  const db = createHttpDb(c.env.DATABASE_URL)
  const profile = await getFotocorpUserProfileByUserId(db, session.user.id)

  if (!profile) {
    return errorResponse(
      new AppError(404, "PROFILE_NOT_FOUND", "Registration profile was not found."),
    )
  }

  const latestInquiry = await findLatestInquiryForUser(db, session.user.id)

  return json({
    ok: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.displayName,
      username: session.user.username ?? profile.username,
    },
    profile: toFotocorpUserProfileDto(profile),
    accessInquiry: latestInquiry
      ? {
          id: latestInquiry.id,
          status: latestInquiry.status,
          createdAt:
            latestInquiry.createdAt instanceof Date
              ? latestInquiry.createdAt.toISOString()
              : latestInquiry.createdAt,
        }
      : null,
  })
})

authProfileRoutes.all("/api/v1/auth/me", () => {
  return errorResponse(
    new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route."),
  )
})
