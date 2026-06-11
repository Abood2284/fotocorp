import { z } from "zod"

export const AUDIT_LOG_SOURCES = ["staff", "asset", "user"] as const
export type AuditLogSource = (typeof AUDIT_LOG_SOURCES)[number]

export const listStaffAuditLogsQuerySchema = z.object({
  source: z.enum(AUDIT_LOG_SOURCES).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(512).optional(),
})

export interface StaffAuditLogCursor {
  createdAt: string
  source: AuditLogSource
  id: string
}

export function encodeStaffAuditLogCursor(cursor: StaffAuditLogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeStaffAuditLogCursor(raw: string): StaffAuditLogCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as StaffAuditLogCursor
    if (!parsed.createdAt || !parsed.source || !parsed.id) return null
    if (!AUDIT_LOG_SOURCES.includes(parsed.source)) return null
    return parsed
  } catch {
    return null
  }
}
