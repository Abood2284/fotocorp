import { Pool } from "pg"

declare global {
  var fotocorpPgPool: Pool | undefined
}

const PG_SSL_MODES_NEEDING_VERIFY_FULL = new Set(["require", "prefer", "verify-ca"])

/** pg v8 warns on require/prefer/verify-ca; Neon expects verify-full for current behavior. */
function normalizeDatabaseUrlForPg(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString

  const queryIndex = connectionString.indexOf("?")
  if (queryIndex === -1) return connectionString

  const base = connectionString.slice(0, queryIndex)
  const params = new URLSearchParams(connectionString.slice(queryIndex + 1))
  const sslMode = params.get("sslmode")
  if (!sslMode || !PG_SSL_MODES_NEEDING_VERIFY_FULL.has(sslMode)) return connectionString

  params.set("sslmode", "verify-full")
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function getPgPool() {
  if (!globalThis.fotocorpPgPool) {
    globalThis.fotocorpPgPool = new Pool({
      connectionString: normalizeDatabaseUrlForPg(process.env.DATABASE_URL),
    })
  }

  return globalThis.fotocorpPgPool
}
