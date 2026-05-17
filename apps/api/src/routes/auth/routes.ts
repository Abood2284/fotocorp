import { Hono } from "hono";
import type { Env } from "../../appTypes";
import type { AppRequestVariables } from "../../db";
import { getAuth } from "../../auth/auth";
import { createTimingTracker, formatServerTiming, logLatencyTrace } from "../../lib/latency-trace";

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

authRoutes.all("/api/auth/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const isGetSession = pathname.endsWith("/get-session");
  if (!isGetSession) return getAuth(c.env).handler(c.req.raw);

  const requestId = c.get("requestId");
  const tracker = createTimingTracker();
  const response = await getAuth(c.env).handler(c.req.raw);
  tracker.mark("handler");
  const durationMs = tracker.total();
  const timings = { handler: tracker.elapsed("handler"), total: durationMs };

  logLatencyTrace({
    event: "latency_trace",
    requestId,
    layer: "api",
    route: "/api/auth/get-session",
    status: response.ok ? "ok" : "error",
    statusCode: response.status,
    durationMs,
    timings,
    cache: { mode: "auth", hit: false, cacheControl: response.headers.get("cache-control") },
  });

  const headers = new Headers(response.headers);
  headers.set("Server-Timing", formatServerTiming(timings, durationMs));
  return new Response(response.body, { status: response.status, headers });
});
