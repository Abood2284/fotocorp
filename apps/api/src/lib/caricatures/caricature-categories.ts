import { asc, eq } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureCategories } from "../../db/schema/caricature-categories"

export interface CaricatureCategoryListItem {
  id: string
  name: string
  slug: string
  sortOrder: number | null
  isActive: boolean
}

export async function listCaricatureCategories(
  db: DrizzleClient,
  options: { activeOnly?: boolean } = {},
): Promise<{ ok: true; categories: CaricatureCategoryListItem[] }> {
  const activeOnly = options.activeOnly ?? true

  const rows = await db
    .select({
      id: caricatureCategories.id,
      name: caricatureCategories.name,
      slug: caricatureCategories.slug,
      sortOrder: caricatureCategories.sortOrder,
      isActive: caricatureCategories.isActive,
    })
    .from(caricatureCategories)
    .where(activeOnly ? eq(caricatureCategories.isActive, true) : undefined)
    .orderBy(asc(caricatureCategories.sortOrder), asc(caricatureCategories.name))

  return { ok: true as const, categories: rows }
}
