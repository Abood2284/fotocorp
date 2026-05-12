import { Pool } from "pg"

declare global {
  var fotocorpPgPool: Pool | undefined
}

export function getPgPool() {
  if (!globalThis.fotocorpPgPool) {
    globalThis.fotocorpPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }

  return globalThis.fotocorpPgPool
}
