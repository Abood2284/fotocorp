import { z } from "zod"

export const listBoardsQuerySchema = z.object({
  authUserId: z.string().trim().min(1),
})

export const createBoardBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(100),
})

export const renameBoardBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(100),
})

export const deleteBoardBodySchema = z.object({
  authUserId: z.string().trim().min(1),
})

export const boardIdParamSchema = z.object({
  boardId: z.uuid(),
})

export const migrateAnonBodySchema = z.object({
  authUserId: z.string().trim().min(1),
  appUserProfileId: z.string().trim().min(1),
  boards: z.array(
    z.object({
      name: z.string().trim().min(1).max(100),
      items: z.array(z.uuid()),
    }),
  ),
})
