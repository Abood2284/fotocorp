import { z } from "zod"
import { HOMEPAGE_HERO_POOL_SIZE } from "../../../db/schema/public-homepage-hero-pool-items"

export const homepageHeroPoolReplaceSchema = z.object({
  assetIds: z.array(z.uuid()).length(HOMEPAGE_HERO_POOL_SIZE),
})

export const homepageHeroPoolCandidatesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  cursor: z.string().trim().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
})
