import { z } from "zod"

export const staffProductivityQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

export type StaffProductivityQuery = z.infer<typeof staffProductivityQuerySchema>

export const staffProductivityMemberParamSchema = z.object({
  staffMemberId: z.string().uuid(),
})

export const staffProductivityActivityQuerySchema = staffProductivityQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional(),
})

export type StaffProductivityActivityQuery = z.infer<typeof staffProductivityActivityQuerySchema>

export const staffProductivityExportQuerySchema = staffProductivityQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(5000).default(5000),
})

export type StaffProductivityExportQuery = z.infer<typeof staffProductivityExportQuerySchema>

export interface StaffProductivityActivityCursor {
  createdAt: string
  id: string
}

export function encodeStaffProductivityActivityCursor(cursor: StaffProductivityActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeStaffProductivityActivityCursor(raw: string): StaffProductivityActivityCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<StaffProductivityActivityCursor>
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null
    if (!parsed.createdAt.trim() || !parsed.id.trim()) return null
    return { createdAt: parsed.createdAt, id: parsed.id }
  } catch {
    return null
  }
}
