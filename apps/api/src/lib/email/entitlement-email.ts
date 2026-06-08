import type { DrizzleClient } from "../../db"
import type { subscriberEntitlements } from "../../db/schema"
import type { Env } from "../../appTypes"
import { formatAccessInterestAssetLabel } from "../access/access-interest-asset-types"
import { safeSendAccessInquiryEmail } from "./email-service"
import type { EntitlementChangeLine, EntitlementEmailLine, EmailTemplateData } from "./types"
import { getAccessInquiryDetail } from "../../routes/staff/access-inquiries/service"

type EntitlementRow = typeof subscriberEntitlements.$inferSelect

const QUALITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}

export function formatAssetLabel(assetType: string): string {
  return formatAccessInterestAssetLabel(assetType)
}

export function formatQualityLabel(quality: string): string {
  return QUALITY_LABELS[String(quality).toUpperCase()] ?? quality
}

export function entitlementRowToEmailLine(row: EntitlementRow): EntitlementEmailLine {
  const assetType = String(row.assetType).toUpperCase() as EntitlementEmailLine["assetType"]
  const qualityAccess = String(row.qualityAccess ?? "MEDIUM").toUpperCase() as EntitlementEmailLine["qualityAccess"]
  return {
    assetType,
    assetLabel: formatAssetLabel(assetType),
    allowedDownloads: row.allowedDownloads ?? 0,
    qualityAccess,
    qualityLabel: formatQualityLabel(qualityAccess),
  }
}

export function buildEntitlementChanges(
  previous: EntitlementRow,
  updated: EntitlementRow,
): EntitlementChangeLine[] {
  const assetLabel = formatAssetLabel(String(previous.assetType))
  const changes: EntitlementChangeLine[] = []

  if (
    previous.allowedDownloads !== updated.allowedDownloads &&
    updated.allowedDownloads !== null &&
    updated.allowedDownloads !== undefined
  ) {
    changes.push({
      assetLabel,
      fieldLabel: "Download limit",
      previousValue: String(previous.allowedDownloads ?? "—"),
      newValue: String(updated.allowedDownloads),
    })
  }

  if (previous.qualityAccess !== updated.qualityAccess) {
    changes.push({
      assetLabel,
      fieldLabel: "Quality cap",
      previousValue: formatQualityLabel(String(previous.qualityAccess ?? "MEDIUM")),
      newValue: formatQualityLabel(String(updated.qualityAccess ?? "MEDIUM")),
    })
  }

  return changes
}

function resolveCustomerRecipient(detail: NonNullable<Awaited<ReturnType<typeof getAccessInquiryDetail>>>) {
  const inquiry = detail.inquiry
  return {
    email: detail.companyEmail,
    firstName: detail.firstName,
    displayName: detail.companyName,
    inquiryId: inquiry.id,
  }
}

export async function sendEntitlementActivationEmail(
  env: Env,
  db: DrizzleClient,
  inquiryId: string,
  activatedRows: EntitlementRow[],
  options: { batchId?: string } = {},
) {
  if (!activatedRows.length) return

  const detail = await getAccessInquiryDetail(db, inquiryId)
  if (!detail) return

  const recipient = resolveCustomerRecipient(detail)
  if (!recipient.email) {
    console.info("email_delivery_skipped", {
      reason: "recipient_email_missing",
      templateKey: "CUSTOMER_ACCESS_APPROVED",
      relatedEntityType: "subscriber_entitlement",
      relatedEntityId: activatedRows[0]?.id,
    })
    return
  }

  const entitlements = activatedRows.map(entitlementRowToEmailLine)
  const data: EmailTemplateData = { entitlements }

  const isBatch = activatedRows.length > 1 || options.batchId
  const relatedEntity = isBatch
    ? {
        type: "entitlement_batch",
        id: options.batchId ?? `${inquiryId}:${activatedRows.map((r) => r.id).sort().join(",")}`,
      }
    : {
        type: "subscriber_entitlement",
        id: activatedRows[0]!.id,
      }

  await safeSendAccessInquiryEmail(db, env, {
    templateKey: "CUSTOMER_ACCESS_APPROVED",
    recipient: {
      email: recipient.email,
      firstName: recipient.firstName,
      displayName: recipient.displayName,
    },
    relatedEntity,
    data,
  })
}

export async function sendEntitlementUpdateEmail(
  env: Env,
  db: DrizzleClient,
  inquiryId: string,
  entitlementId: string,
  changes: EntitlementChangeLine[],
  updatedAt: Date,
) {
  if (!changes.length) return

  const detail = await getAccessInquiryDetail(db, inquiryId)
  if (!detail) return

  const recipient = resolveCustomerRecipient(detail)
  if (!recipient.email) {
    console.info("email_delivery_skipped", {
      reason: "recipient_email_missing",
      templateKey: "CUSTOMER_ENTITLEMENT_UPDATED",
      relatedEntityType: "subscriber_entitlement_update",
      relatedEntityId: entitlementId,
    })
    return
  }

  await safeSendAccessInquiryEmail(db, env, {
    templateKey: "CUSTOMER_ENTITLEMENT_UPDATED",
    recipient: {
      email: recipient.email,
      firstName: recipient.firstName,
      displayName: recipient.displayName,
    },
    relatedEntity: {
      type: "subscriber_entitlement_update",
      id: `${entitlementId}:${updatedAt.toISOString()}`,
    },
    data: { entitlementChanges: changes },
  })
}
