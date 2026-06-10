import { index, integer, pgTable, timestamp, uuid, text } from "drizzle-orm/pg-core";

export const fotoboxBoards = pgTable(
  "fotobox_boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fotobox_boards_user_id_idx").on(table.userId, table.sortOrder),
  ],
);

