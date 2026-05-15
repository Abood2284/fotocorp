import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import type { ContributorSessionResult } from "../auth/service";

export interface PortalContributorListItem {
  id: string;
  displayName: string;
  email: string | null;
}

export async function listContributorsForPortalAdmin(
  db: DrizzleClient,
  session: ContributorSessionResult,
  query: { q?: string; limit: number },
): Promise<{ ok: true; contributors: PortalContributorListItem[] }> {
  if (session.account.portalRole !== "PORTAL_ADMIN") {
    throw new AppError(403, "CONTRIBUTOR_LIST_FORBIDDEN", "You do not have access to list photographers.");
  }
  const q = query.q?.trim();
  const searchClause = q
    ? sql`and (
        p.display_name ilike ${"%" + q + "%"}
        or coalesce(p.email, '') ilike ${"%" + q + "%"}
      )`
    : sql``;

  const rows = await executeRows<{ id: string; display_name: string; email: string | null }>(
    db,
    sql`
      select p.id, p.display_name, p.email
      from contributors p
      where p.status = 'ACTIVE'
      ${searchClause}
      order by p.display_name asc
      limit ${query.limit}
    `,
  );
  return {
    ok: true as const,
    contributors: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
    })),
  };
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
