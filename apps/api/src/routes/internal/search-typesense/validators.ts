import { z } from "zod"

export const typesenseSyncAssetBodySchema = z.object({
  assetId: z.string().uuid(),
  critical: z.boolean().optional(),
})

export const typesenseSyncEventBodySchema = z.object({
  eventId: z.string().uuid(),
  critical: z.boolean().optional(),
})

export const typesenseDeleteEventBodySchema = z.object({
  eventId: z.string().uuid(),
  critical: z.boolean().optional(),
})
