import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import { CONTRIBUTOR_UPLOAD_CATEGORY_NAMES } from "../../../lib/assets/contributor-upload-categories";

export interface AssetCategoryListItem {
  id: string;
  name: string;
}

function contributorUploadCategoryNameInList(): SQL {
  return sql`in (${sql.join(CONTRIBUTOR_UPLOAD_CATEGORY_NAMES.map((name) => sql`${name}`), sql`, `)})`;
}

function contributorUploadCategoryOrderSql(): SQL {
  const orderCases = CONTRIBUTOR_UPLOAD_CATEGORY_NAMES.map(
    (name, index) => sql`when ${name} then ${index + 1}`,
  );
  return sql`case name ${sql.join(orderCases, sql` `)} else 999 end`;
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
      where name ${contributorUploadCategoryNameInList()}
      order by ${contributorUploadCategoryOrderSql()}
    `,
  );
  return { ok: true as const, categories: rows };
}

export async function assertContributorUploadCategoryExists(db: DrizzleClient, categoryId: string) {
  const rows = await executeRows<{ id: string }>(
    db,
    sql`
      select id
      from asset_categories
      where id = ${categoryId}::uuid
        and name ${contributorUploadCategoryNameInList()}
      limit 1
    `,
  );
  if (rows.length === 0) {
    throw new AppError(400, "EVENT_CATEGORY_INVALID", "Category was not found or is not allowed for uploads.");
  }
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
