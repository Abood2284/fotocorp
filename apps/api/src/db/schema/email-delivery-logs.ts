import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const EMAIL_DELIVERY_STATUSES = ["SENT", "FAILED", "SKIPPED"] as const;

export const emailDeliveryLogs = pgTable(
  "email_delivery_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientEmail: text("recipient_email").notNull(),
    templateKey: text("template_key").notNull(),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    relatedEntityType: text("related_entity_type").notNull(),
    relatedEntityId: text("related_entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    check("email_delivery_logs_status_check", sql`${table.status} in ('SENT','FAILED','SKIPPED')`),
    index("email_delivery_logs_recipient_created_idx").on(table.recipientEmail, table.createdAt),
    index("email_delivery_logs_related_entity_idx").on(table.relatedEntityType, table.relatedEntityId),
    uniqueIndex("email_delivery_logs_success_once_uidx")
      .on(table.relatedEntityType, table.relatedEntityId, table.templateKey)
      .where(sql`${table.status} = 'SENT'`),
  ],
);
