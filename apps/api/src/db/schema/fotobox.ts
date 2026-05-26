import { index, integer, pgTable, timestamp, unique, uuid, text, foreignKey } from "drizzle-orm/pg-core";
import { assets } from "./legacy";

export const fotoboxBoards = pgTable(
  "fotobox_boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").notNull(),
    appUserProfileId: text("app_user_profile_id"),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fotobox_boards_auth_user_id_idx").on(table.authUserId, table.sortOrder),
  ],
);

export const assetFotoboxItems = pgTable(
  "asset_fotobox_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").notNull(),
    appUserProfileId: text("app_user_profile_id"),
    boardId: uuid("board_id").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("asset_fotobox_items_board_asset_unique").on(table.boardId, table.assetId),
    index("asset_fotobox_items_board_id_created_at_idx").on(table.boardId, table.createdAt),
    index("asset_fotobox_items_auth_user_id_idx").on(table.authUserId),
    index("asset_fotobox_items_asset_id_idx").on(table.assetId),
    index("asset_fotobox_items_app_user_profile_id_idx").on(table.appUserProfileId),
  ],
);
