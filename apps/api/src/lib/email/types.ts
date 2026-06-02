import type { Env } from "../../appTypes"

export const EMAIL_TEMPLATE_KEYS = [
  "CUSTOMER_ACCESS_REQUEST_RECEIVED",
  "CUSTOMER_ACCESS_APPROVED",
  "CUSTOMER_ENTITLEMENT_UPDATED",
  "CUSTOMER_ACCESS_REJECTED",
  "CONTRIBUTOR_APPLICATION_RECEIVED",
  "CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS",
  "CONTRIBUTOR_APPLICATION_REJECTED",
] as const

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]
export type EmailDeliveryStatus = "SENT" | "FAILED" | "SKIPPED"

export interface EmailRecipient {
  email: string
  firstName?: string | null
  displayName?: string | null
}

export interface RenderedEmail {
  templateKey: EmailTemplateKey
  displayName: string
  subject: string
  html: string
  text: string
}

export interface EmailEnvelope extends RenderedEmail {
  from: string
  to: string
  replyTo: string
  idempotencyKey?: string | null
}

export interface EmailSendResult {
  status: EmailDeliveryStatus
  provider: string
  providerMessageId: string | null
  errorMessage: string | null
}

export interface EmailProvider {
  readonly name: string
  send(email: EmailEnvelope): Promise<EmailSendResult>
}

export type EmailEnv = Pick<
  Env,
  "RESEND_API_KEY" | "EMAIL_PROVIDER" | "EMAIL_FROM_NAME" | "EMAIL_FROM_ADDRESS" | "EMAIL_REPLY_TO" | "PUBLIC_WEB_ORIGIN"
>

export interface EmailRelatedEntity {
  type: string
  id: string
}

export interface EntitlementEmailLine {
  assetType: "IMAGE" | "VIDEO" | "CARICATURE"
  assetLabel: string
  allowedDownloads: number
  qualityAccess: "LOW" | "MEDIUM" | "HIGH"
  qualityLabel: string
}

export interface EntitlementChangeLine {
  assetLabel: string
  fieldLabel: string
  previousValue: string
  newValue: string
}

export interface EmailTemplateData {
  contributorUsername?: string | null
  temporaryPassword?: string | null
  contributorLoginUrl?: string | null
  passwordChangeSupported?: boolean
  entitlements?: EntitlementEmailLine[]
  entitlementChanges?: EntitlementChangeLine[]
}
