import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

export const publicHomepageHeroSets = pgTable(
  "public_homepage_hero_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setKey: text("set_key").notNull(),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
    activeUntil: timestamp("active_until", { withTimezone: true }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    generationRunId: uuid("generation_run_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_homepage_hero_sets_set_key_uidx").on(table.setKey),
    index("public_homepage_hero_sets_active_window_idx").on(table.activeFrom, table.activeUntil),
    check("public_homepage_hero_sets_active_window_check", sql`${table.activeUntil} > ${table.activeFrom}`),
  ],
)
