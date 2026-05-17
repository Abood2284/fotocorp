import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import type { Context } from "hono";
import type { Env } from "../appTypes";
import * as schema from "./schema";
import { createHttpDb, type DrizzleClient } from "./http";

export { createHttpDb, type DrizzleClient };

export interface AppRequestVariables {
  requestId: string;
  requestIp: string | null;
  requestUserAgent: string | null;
  db?: DrizzleClient;
}

type AppContext = Context<{ Bindings: Env; Variables: AppRequestVariables }>;

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

export type TransactionalDrizzleClient = ReturnType<
  typeof createTransactionalDb
>["db"];
