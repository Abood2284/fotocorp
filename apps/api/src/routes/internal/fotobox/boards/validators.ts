import { z } from "zod"

export const listBoardsQuerySchema = z.object({
  userId: z.string().uuid(),
})

export const createBoardBodySchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
})

export const renameBoardBodySchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
})

export const deleteBoardBodySchema = z.object({
  userId: z.string().uuid(),
})

export const boardIdParamSchema = z.object({
  boardId: z.uuid(),
})

export const migrateAnonBodySchema = z.object({
  userId: z.string().uuid(),
  boards: z.array(
    z.object({
      name: z.string().trim().min(1).max(100),
      items: z.array(z.uuid()),
    }),
  ),
})
