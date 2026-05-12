import { Pool, neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import type { Context } from "hono";
import type { Env } from "../appTypes";
import * as schema from "./schema";

export interface AppRequestVariables {
  requestId: string;
  requestIp: string | null;
  requestUserAgent: string | null;
  db?: DrizzleClient;
}

type AppContext = Context<{ Bindings: Env; Variables: AppRequestVariables }>;

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

export function createHttpDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzleHttp({ client: sql, schema });
}

export function createTransactionalDb(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzleServerless({ client: pool, schema });

  return {
    db,
    close: () => pool.end(),
  };
}

export function createDbFromUrl(databaseUrl: string) {
  const client = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzleServerless({ client, schema });

  return {
    db,
    close: () => client.end(),
  };
}

export function createDbForRequest(c: AppContext) {
  const requestDb = c.get("db");
  if (requestDb) {
    return {
      db: requestDb,
      close: async () => {},
    };
  }

  if (!c.env.DATABASE_URL) {
    throw new Error("DATABASE_URL binding is required for database access.");
  }

  return {
    db: createHttpDb(c.env.DATABASE_URL),
    close: async () => {},
  };
}

export type DrizzleClient = ReturnType<typeof createHttpDb>;
export type TransactionalDrizzleClient = ReturnType<
  typeof createTransactionalDb
>["db"];
