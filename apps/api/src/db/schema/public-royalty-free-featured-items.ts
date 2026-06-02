import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { imageAssets } from "./image-assets"

export const publicRoyaltyFreeFeaturedItems = pgTable(
  "public_royalty_free_featured_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    rank: integer("rank").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("public_royalty_free_featured_items_period_key_check", sql`${table.periodKey} ~ '^[0-9]{4}-[0-9]{2}$'`),
    check("public_royalty_free_featured_items_rank_check", sql`${table.rank} > 0`),
    check("public_royalty_free_featured_items_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE')`),
    uniqueIndex("public_royalty_free_featured_items_period_rank_uidx").on(table.periodKey, table.rank),
    uniqueIndex("public_royalty_free_featured_items_period_asset_uidx").on(table.periodKey, table.assetId),
    index("public_royalty_free_featured_items_active_period_rank_idx")
      .on(table.periodKey, table.rank)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
)

/** @deprecated Use {@link publicRoyaltyFreeFeaturedItems}. */
export const publicCreativeFeaturedItems = publicRoyaltyFreeFeaturedItems
