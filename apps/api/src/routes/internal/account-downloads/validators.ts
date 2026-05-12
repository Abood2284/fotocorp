import { z } from "zod"

export const downloadHistoryQuerySchema = z.object({
  authUserId: z.string().trim().min(1),
  year: z.string().trim().optional(),
  month: z.string().trim().optional(),
  limit: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
})
