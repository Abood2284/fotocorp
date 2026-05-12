import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { getAuth } from "../../auth/auth";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.all("/api/auth/*", async (c) => {
  return getAuth(c.env).handler(c.req.raw);
});
