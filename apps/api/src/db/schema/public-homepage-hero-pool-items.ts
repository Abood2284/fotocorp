import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { imageAssets } from "./image-assets"
import { staffMembers } from "./staff-members"

export const HOMEPAGE_HERO_POOL_SIZE = 25

export const publicHomepageHeroPoolItems = pgTable(
  "public_homepage_hero_pool_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    selectedByStaffMemberId: uuid("selected_by_staff_member_id").references(() => staffMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("public_homepage_hero_pool_items_position_check", sql`${table.position} >= 1 and ${table.position} <= 25`),
    uniqueIndex("public_homepage_hero_pool_items_asset_uidx").on(table.assetId),
    uniqueIndex("public_homepage_hero_pool_items_position_uidx").on(table.position),
    index("public_homepage_hero_pool_items_position_idx").on(table.position),
  ],
)
