import { index, pgTable, timestamp, unique, uuid, text } from "drizzle-orm/pg-core";
import { assets } from "./legacy";

export const assetFotoboxItems = pgTable(
  "asset_fotobox_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").notNull(),
    appUserProfileId: text("app_user_profile_id"),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("asset_fotobox_items_auth_user_id_asset_id_unique").on(table.authUserId, table.assetId),
    index("asset_fotobox_items_auth_user_id_created_at_idx").on(table.authUserId, table.createdAt),
    index("asset_fotobox_items_asset_id_idx").on(table.assetId),
    index("asset_fotobox_items_app_user_profile_id_idx").on(table.appUserProfileId),
  ],
);
