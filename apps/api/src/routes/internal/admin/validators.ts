import { z } from "zod"

export const adminAssetParamSchema = z.object({
  assetId: z.uuid(),
})

export const adminUserParamSchema = z.object({
  authUserId: z.string().trim().min(1),
})

export const adminPreviewQuerySchema = z.object({
  variant: z.enum(["thumb", "card", "detail"]),
})

export const adminAssetUpdateSchema = z.object({
  caption: z.string().trim().max(5000).nullable().optional(),
  headline: z.string().trim().max(1024).nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  eventId: z.uuid().nullable().optional(),
  contributorId: z.uuid().nullable().optional(),
})

export const adminPublishStateSchema = z.object({
  status: z.enum(["APPROVED", "REVIEW", "REJECTED"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
})

export const adminUserSubscriptionSchema = z.object({
  isSubscriber: z.boolean(),
})
