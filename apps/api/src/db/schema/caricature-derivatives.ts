import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { caricatureAssets } from "./caricature-assets";

export const CARICATURE_DERIVATIVE_TYPES = ["BLURRED_CARD", "BLURRED_DETAIL"] as const;

export const CARICATURE_DERIVATIVE_STATUSES = ["QUEUED", "GENERATING", "READY", "FAILED"] as const;

export const caricatureDerivatives = pgTable(
  "caricature_derivatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caricatureId: uuid("caricature_id")
      .notNull()
      .references(() => caricatureAssets.id, { onDelete: "cascade" }),
    derivativeType: text("derivative_type").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    publicUrl: text("public_url"),
    format: text("format").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    blurVersion: text("blur_version"),
    watermarkVersion: text("watermark_version"),
    status: text("status").default("QUEUED").notNull(),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("caricature_derivatives_type_check", sql`${table.derivativeType} in ('BLURRED_CARD', 'BLURRED_DETAIL')`),
    check(
      "caricature_derivatives_status_check",
      sql`${table.status} in ('QUEUED', 'GENERATING', 'READY', 'FAILED')`,
    ),
    uniqueIndex("caricature_derivatives_caricature_id_type_uidx").on(table.caricatureId, table.derivativeType),
    index("caricature_derivatives_caricature_id_idx").on(table.caricatureId),
    index("caricature_derivatives_status_idx").on(table.status),
  ],
);
