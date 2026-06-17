import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { withCoreDb } from "../../../db";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";

export const hyperdriveCoreHealthRoutes = new Hono<{ Bindings: Env }>();

hyperdriveCoreHealthRoutes.use("/api/v1/internal/health/hyperdrive-core", internalAuthMiddleware);

hyperdriveCoreHealthRoutes.get("/api/v1/internal/health/hyperdrive-core", async (c) => {
  await withCoreDb(c.env, async (db) => {
    await db.execute(sql`select 1 as ok`);
  });

  return json({
    ok: true,
    dbPath: "core",
    provider: "hyperdrive-or-fallback",
  });
});

hyperdriveCoreHealthRoutes.all("/api/v1/internal/health/hyperdrive-core", () => methodNotAllowed());
