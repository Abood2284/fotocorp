import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service";
import {
  completePhotographerUploadItem,
  createPhotographerUploadBatch,
  getPhotographerUploadBatchDetail,
  listPhotographerUploadBatches,
  preparePhotographerUploadFiles,
  submitPhotographerUploadBatch,
} from "./service";
import {
  createUploadBatchBodySchema,
  prepareUploadFilesBodySchema,
  uploadBatchIdParamSchema,
  uploadBatchItemParamSchema,
  uploadBatchesListQuerySchema,
} from "./validators";

export const photographerUploadRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

photographerUploadRoutes.get(
  "/api/v1/contributor/upload-batches",
  zValidator("query", uploadBatchesListQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await listPhotographerUploadBatches(database, session, c.req.valid("query")));
  },
);

photographerUploadRoutes.post(
  "/api/v1/contributor/upload-batches",
  zValidator("json", createUploadBatchBodySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await createPhotographerUploadBatch(database, session, c.req.valid("json")), 201);
  },
);

photographerUploadRoutes.get(
  "/api/v1/contributor/upload-batches/:batchId",
  zValidator("param", uploadBatchIdParamSchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { batchId } = c.req.valid("param");
    return json(await getPhotographerUploadBatchDetail(database, session, batchId));
  },
);

photographerUploadRoutes.post(
  "/api/v1/contributor/upload-batches/:batchId/files",
  zValidator("param", uploadBatchIdParamSchema),
  zValidator("json", prepareUploadFilesBodySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { batchId } = c.req.valid("param");
    return json(await preparePhotographerUploadFiles(database, c.env, session, batchId, c.req.valid("json")), 201);
  },
);

photographerUploadRoutes.post(
  "/api/v1/contributor/upload-batches/:batchId/files/:itemId/complete",
  zValidator("param", uploadBatchItemParamSchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { batchId, itemId } = c.req.valid("param");
    return json(await completePhotographerUploadItem(database, c.env, session, batchId, itemId));
  },
);

photographerUploadRoutes.post(
  "/api/v1/contributor/upload-batches/:batchId/submit",
  zValidator("param", uploadBatchIdParamSchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { batchId } = c.req.valid("param");
    return json(await submitPhotographerUploadBatch(database, session, batchId));
  },
);

photographerUploadRoutes.all("/api/v1/contributor/upload-batches", () => methodNotAllowed());
photographerUploadRoutes.all("/api/v1/contributor/upload-batches/:batchId", () => methodNotAllowed());
photographerUploadRoutes.all("/api/v1/contributor/upload-batches/:batchId/files", () => methodNotAllowed());
photographerUploadRoutes.all("/api/v1/contributor/upload-batches/:batchId/files/:itemId/complete", () => methodNotAllowed());
photographerUploadRoutes.all("/api/v1/contributor/upload-batches/:batchId/submit", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
