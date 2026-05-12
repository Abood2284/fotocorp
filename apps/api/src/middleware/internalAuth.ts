import type { MiddlewareHandler } from "hono";
import type { Env } from "../appTypes";
import { requireInternalApiSecret } from "../lib/internal-auth";

export const internalAuthMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  requireInternalApiSecret(c.req.raw, c.env);
  await next();
};
