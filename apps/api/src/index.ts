import type { Env } from "./appTypes";
import { honoApp } from "./honoApp";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await honoApp.fetch(request, env);
  }
};
