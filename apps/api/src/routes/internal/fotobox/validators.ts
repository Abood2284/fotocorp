import { z } from "zod"

export const fotoboxListQuerySchema = z.object({
  authUserId: z.string().trim().min(1),
  limit: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
})

export const addFotoboxBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  assetId: z.uuid(),
})

export const removeFotoboxBodySchema = z.object({
  authUserId: z.string().trim().min(1),
})

export const fotoboxAssetParamSchema = z.object({
  assetId: z.uuid(),
})
