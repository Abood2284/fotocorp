import { neon, neonConfig } from "@neondatabase/serverless"
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http"
import * as schema from "./schema"

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket
}

export function createHttpDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzleHttp({ client: sql, schema })
}

export type DrizzleClient = ReturnType<typeof createHttpDb>
