import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";

export interface AssetCategoryListItem {
  id: string;
  name: string;
}

export async function listAssetCategoriesForContributor(db: DrizzleClient): Promise<{
  ok: true;
  categories: AssetCategoryListItem[];
}> {
  const rows = await executeRows<AssetCategoryListItem>(
    db,
    sql`
      select id, name
      from asset_categories
      order by name asc
      limit 500
    `,
  );
  return { ok: true as const, categories: rows };
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
