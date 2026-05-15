export type EmailTemplateId = "access_inquiry_received" | "entitlement_activated"

export interface IntendedEmailEvent {
  templateId: EmailTemplateId
  to: string
  subject: string
  payload: Record<string, unknown>
  createdAt: string
}
