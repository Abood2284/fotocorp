import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import type { Env } from "../appTypes";
import * as schema from "./schema";

export async function createHyperdrivePgDb(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: async () => {
      await client.end();
    },
  };
}

export type CoreDbConnection = Awaited<ReturnType<typeof createHyperdrivePgDb>>;
export type CoreDbClient = CoreDbConnection["db"];
export type PublicReadDbConnection = Awaited<ReturnType<typeof createPublicReadDb>>;
export type PublicReadDbClient = PublicReadDbConnection["db"];

export async function createCoreDb(env: Env) {
  const connectionString = env.CORE_HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("CORE_HYPERDRIVE or DATABASE_URL is required for core database access.");
  }

  return createHyperdrivePgDb(connectionString);
}

export async function withCoreDb<T>(env: Env, fn: (db: CoreDbClient) => Promise<T>): Promise<T> {
  const connection = await createCoreDb(env);
  try {
    return await fn(connection.db);
  } finally {
    await connection.close();
  }
}

export async function createPublicReadDb(env: Env) {
  const connectionString =
    env.PUBLIC_READ_HYPERDRIVE?.connectionString
    ?? env.CORE_HYPERDRIVE?.connectionString
    ?? env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("PUBLIC_READ_HYPERDRIVE, CORE_HYPERDRIVE, or DATABASE_URL is required for public-read database access.");
  }

  return createHyperdrivePgDb(connectionString);
}

export async function withPublicReadDb<T>(
  env: Env,
  fn: (db: PublicReadDbClient) => Promise<T>,
): Promise<T> {
  const connection = await createPublicReadDb(env);
  try {
    return await fn(connection.db);
  } finally {
    await connection.close();
  }
}
