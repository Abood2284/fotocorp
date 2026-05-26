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
    const { authUserId } = c.req.valid("query")
    return listBoardsService(c.env, authUserId)
  },
)

boardRoutes.post(
  "/api/v1/internal/fotobox/items/boards",
  zValidator("json", createBoardBodySchema),
  async (c) => {
    const { authUserId, name } = c.req.valid("json")
    return createBoardService(c.env, authUserId, name)
  },
)

boardRoutes.patch(
  "/api/v1/internal/fotobox/items/boards/:boardId",
  zValidator("param", boardIdParamSchema),
  zValidator("json", renameBoardBodySchema),
  async (c) => {
    const { boardId } = c.req.valid("param")
    const { authUserId, name } = c.req.valid("json")
    return renameBoardService(c.env, boardId, authUserId, name)
  },
)

boardRoutes.delete(
  "/api/v1/internal/fotobox/items/boards/:boardId",
  zValidator("param", boardIdParamSchema),
  zValidator("json", deleteBoardBodySchema),
  async (c) => {
    const { boardId } = c.req.valid("param")
    const { authUserId } = c.req.valid("json")
    return deleteBoardService(c.env, boardId, authUserId)
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
  zValidator("query", z.object({ authUserId: z.string().trim().min(1), assetId: z.uuid() })),
  async (c) => {
    const { authUserId, assetId } = c.req.valid("query")
    return getAssetBoardIdsService(c.env, authUserId, assetId)
  },
)
