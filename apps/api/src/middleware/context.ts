import type { MiddlewareHandler } from "hono";
import type { Env } from "../appTypes";
import type { AppRequestVariables } from "../db";
import { createHttpDb } from "../db";

export const requestContextMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppRequestVariables;
}> = async (c, next) => {
  const requestId = c.req.header("x-request-id")?.trim() || crypto.randomUUID()
  c.set("requestId", requestId)
  c.set("requestIp", c.req.header("cf-connecting-ip")?.trim() ?? null)
  c.set("requestUserAgent", c.req.header("user-agent")?.trim() ?? null)

  if (c.env.DATABASE_URL) c.set("db", createHttpDb(c.env.DATABASE_URL))

  await next()
  c.header("x-request-id", requestId)
}
