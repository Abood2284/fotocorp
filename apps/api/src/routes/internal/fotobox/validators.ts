import { z } from "zod"

export const fotoboxListQuerySchema = z.object({
  authUserId: z.string().trim().min(1),
  limit: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
  boardId: z.string().uuid().optional(),
})

export const addFotoboxBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  assetId: z.uuid(),
  boardId: z.uuid(),
})

export const removeFotoboxBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  boardId: z.string().uuid().optional(),
})

export const fotoboxAssetParamSchema = z.object({
  assetId: z.uuid(),
})
