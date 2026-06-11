import type { RequestAuditContext } from "@/lib/server/request-audit-context"

export type SubscriberDownloadSize = "web" | "medium" | "large"

export type SubscriberDownloadRequestAudit = Partial<RequestAuditContext>

export function buildSubscriberDownloadRequestBody(input: {
  authUserId: string
  size: SubscriberDownloadSize
  userAgent?: string | null
  requestIp?: string | null
  requestAudit?: SubscriberDownloadRequestAudit | null
}) {
  const requestAudit = input.requestAudit ?? null

  return {
    authUserId: input.authUserId,
    size: input.size,
    userAgent: requestAudit?.userAgent ?? input.userAgent ?? undefined,
    requestIp: requestAudit?.ipAddress ?? input.requestIp ?? undefined,
    requestAudit: requestAudit ?? undefined,
  }
}
