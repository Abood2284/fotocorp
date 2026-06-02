import { sql } from "drizzle-orm"
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { imageAssets } from "./image-assets"
import { photoEvents } from "./photo-events"

export const publicEventFeedItems = pgTable(
  "public_event_feed_items",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => photoEvents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    assetCount: integer("asset_count").default(0).notNull(),
    previewAssetId: uuid("preview_asset_id").references(() => imageAssets.id, { onDelete: "set null" }),
    previewWidth: integer("preview_width"),
    previewHeight: integer("preview_height"),
    previewUrl: text("preview_url").notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("public_event_feed_items_public_created_idx")
      .on(table.createdAt, table.eventId)
      .where(sql`${table.isPublic} = true`),
    index("public_event_feed_items_public_event_date_idx")
      .on(table.eventDate, table.eventId)
      .where(sql`${table.isPublic} = true and ${table.eventDate} is not null`),
  ],
)
