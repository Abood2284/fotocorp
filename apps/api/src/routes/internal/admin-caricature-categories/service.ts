import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { listCaricatureCategories } from "../../../lib/caricatures/caricature-categories"

export async function listAdminCaricatureCategoriesService(
  env: Env,
  options: { activeOnly?: boolean } = {},
) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  }

  const db = createHttpDb(env.DATABASE_URL)
  return json(await listCaricatureCategories(db, options))
}
