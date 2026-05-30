import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { imageAssets } from "./image-assets"
import { publicHomepageHeroSets } from "./public-homepage-hero-sets"

export const publicHomepageHeroSetItems = pgTable(
  "public_homepage_hero_set_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: uuid("set_id")
      .notNull()
      .references(() => publicHomepageHeroSets.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    previewUrl: text("preview_url").notNull(),
    title: text("title").notNull(),
    eventId: uuid("event_id"),
    eventName: text("event_name"),
    fotokey: text("fotokey"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_homepage_hero_set_items_set_slot_uidx").on(table.setId, table.slot),
    index("public_homepage_hero_set_items_set_slot_idx").on(table.setId, table.slot),
    check("public_homepage_hero_set_items_slot_check", sql`${table.slot} > 0`),
  ],
)
