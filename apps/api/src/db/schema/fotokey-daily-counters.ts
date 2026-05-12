import { bigint, date, pgTable, timestamp } from "drizzle-orm/pg-core";

/**
 * One row per business approval date. Used to allocate Fotokey sequence numbers transactionally.
 *
 * Fotokey format: FC + DD + MM + YY + sequence (sequence padded to >=3 digits, may grow beyond 999).
 * Sequence is global across contributors/events for that approval date.
 */
export const fotokeyDailyCounters = pgTable("fotokey_daily_counters", {
  codeDate: date("code_date").primaryKey(),
  lastSequence: bigint("last_sequence", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
