import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";
import { listDownloadHistoryService } from "./service";
import { downloadHistoryQuerySchema } from "./validators";

export const internalAccountRoutes = new Hono<{ Bindings: Env }>();

internalAccountRoutes.use("/api/v1/internal/*", internalAuthMiddleware);

internalAccountRoutes.get(
  "/api/v1/internal/downloads/history",
  zValidator("query", downloadHistoryQuerySchema),
  async (c) => {
    return await listDownloadHistoryService(c.env, c.req.valid("query"));
  },
);

internalAccountRoutes.all("/api/v1/internal/downloads/history", () => {
  return methodNotAllowed();
});
