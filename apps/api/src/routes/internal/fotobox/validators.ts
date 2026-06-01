import { z } from "zod"

export const fotoboxListQuerySchema = z.object({
  userId: z.string().uuid(),
  limit: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
  boardId: z.string().uuid().optional(),
})

export const addFotoboxBodySchema = z.object({
  userId: z.string().uuid(),
  assetId: z.uuid(),
  boardId: z.uuid(),
})

export const removeFotoboxBodySchema = z.object({
  userId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
})

export const fotoboxAssetParamSchema = z.object({
  assetId: z.uuid(),
})
