import type { Env } from "./appTypes";
import { honoApp } from "./honoApp";
import { runPublicEventFeedCleanup } from "./lib/assets/public-event-feed-scheduled";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return await honoApp.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runPublicEventFeedCleanup(env);
  },
};
