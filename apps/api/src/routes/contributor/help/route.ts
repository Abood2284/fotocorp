import { zValidator } from "@hono/zod-validator"
import { getCookie } from "hono/cookie"
import { Hono } from "hono"
import type { Env } from "../../../appTypes"
import { createHttpDb, type AppRequestVariables } from "../../../db"
import { AppError } from "../../../lib/errors"
import { getPublishedContributorHelpArticle } from "../../../lib/help-center/contributor-help-service"
import { getContributorHelpMediaDeliveryResponse } from "../../../lib/help-center/help-media-service"
import { json } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service"
import {
  contributorHelpArticleSlugParamSchema,
  contributorHelpMediaIdParamSchema,
} from "./validators"

export const contributorHelpRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

const articlesBase = "/api/v1/contributor/help/articles"
const mediaBase = "/api/v1/contributor/help/media"

contributorHelpRoutes.get(
  `${articlesBase}/:slug`,
  zValidator("param", contributorHelpArticleSlugParamSchema),
  async (c) => {
    const database = db(c.env)
    await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { slug } = c.req.valid("param")
    const article = await getPublishedContributorHelpArticle(database, slug)
    return json({ ok: true as const, article })
  },
)

contributorHelpRoutes.all(`${articlesBase}/:slug`, () => methodNotAllowed())

contributorHelpRoutes.get(
  `${mediaBase}/:mediaId`,
  zValidator("param", contributorHelpMediaIdParamSchema),
  async (c) => {
    const database = db(c.env)
    await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { mediaId } = c.req.valid("param")
    return getContributorHelpMediaDeliveryResponse(database, c.env, mediaId, c.req.header("range") ?? null)
  },
)

contributorHelpRoutes.all(`${mediaBase}/:mediaId`, () => methodNotAllowed())

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}
