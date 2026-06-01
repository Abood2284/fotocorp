import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import type { Env } from "../../../../appTypes"
import {
  listBoardsService,
  createBoardService,
  renameBoardService,
  deleteBoardService,
  migrateAnonService,
  getAssetBoardIdsService,
} from "./service"
import {
  listBoardsQuerySchema,
  createBoardBodySchema,
  renameBoardBodySchema,
  deleteBoardBodySchema,
  boardIdParamSchema,
  migrateAnonBodySchema,
} from "./validators"

export const boardRoutes = new Hono<{ Bindings: Env }>()

boardRoutes.get(
  "/api/v1/internal/fotobox/items/boards",
  zValidator("query", listBoardsQuerySchema),
  async (c) => {
    const { userId } = c.req.valid("query")
    return listBoardsService(c.env, userId)
  },
)

boardRoutes.post(
  "/api/v1/internal/fotobox/items/boards",
  zValidator("json", createBoardBodySchema),
  async (c) => {
    const { userId, name } = c.req.valid("json")
    return createBoardService(c.env, userId, name)
  },
)

boardRoutes.patch(
  "/api/v1/internal/fotobox/items/boards/:boardId",
  zValidator("param", boardIdParamSchema),
  zValidator("json", renameBoardBodySchema),
  async (c) => {
    const { boardId } = c.req.valid("param")
    const { userId, name } = c.req.valid("json")
    return renameBoardService(c.env, boardId, userId, name)
  },
)

boardRoutes.delete(
  "/api/v1/internal/fotobox/items/boards/:boardId",
  zValidator("param", boardIdParamSchema),
  zValidator("json", deleteBoardBodySchema),
  async (c) => {
    const { boardId } = c.req.valid("param")
    const { userId } = c.req.valid("json")
    return deleteBoardService(c.env, boardId, userId)
  },
)

boardRoutes.post(
  "/api/v1/internal/fotobox/items/migrate-anon",
  zValidator("json", migrateAnonBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return migrateAnonService(c.env, body)
  },
)

boardRoutes.get(
  "/api/v1/internal/fotobox/items/asset-board-ids",
  zValidator("query", z.object({ userId: z.string().trim().min(1), assetId: z.uuid() })),
  async (c) => {
    const { userId, assetId } = c.req.valid("query")
    return getAssetBoardIdsService(c.env, userId, assetId)
  },
)
