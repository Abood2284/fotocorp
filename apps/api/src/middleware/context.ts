import type { MiddlewareHandler } from "hono";
import type { Env } from "../appTypes";
import type { AppRequestVariables } from "../db";
import { createHttpDb } from "../db";
import { FOTOCORP_REQUEST_ID_HEADER, resolveRequestId } from "../lib/latency-trace";

export const requestContextMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppRequestVariables;
}> = async (c, next) => {
  const requestId = resolveRequestId(c.req.raw.headers)
  c.set("requestId", requestId)
  c.set("requestIp", c.req.header("cf-connecting-ip")?.trim() ?? null)
  c.set("requestUserAgent", c.req.header("user-agent")?.trim() ?? null)

  if (c.env.DATABASE_URL) c.set("db", createHttpDb(c.env.DATABASE_URL))

  await next()
  c.header(FOTOCORP_REQUEST_ID_HEADER, requestId)
  c.header("x-request-id", requestId)
}
