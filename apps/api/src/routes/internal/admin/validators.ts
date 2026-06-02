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
  whoIsInPicture: z.string().trim().max(2048).nullable().optional(),
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

export const adminUserRoleSchema = z.object({
  role: z.enum(["USER", "PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"]),
})

export const adminUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
})

export const adminUserSubscriptionDetailSchema = z.object({
  subscriptionPlanId: z.string().trim().max(255).nullable().optional(),
  subscriptionEndsAt: z.string().trim().nullable().optional(),
  downloadQuotaLimit: z.number().int().min(0).nullable().optional(),
})

export const adminBulkEditorialSchema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(500),
  categoryId: z.uuid().nullable().optional(),
  eventId: z.uuid().nullable().optional(),
})

export const adminBulkPublishStateSchema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(500),
  status: z.enum(["APPROVED", "REVIEW", "REJECTED"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
})
