import { z } from "zod"

export const staffProductivityQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

export type StaffProductivityQuery = z.infer<typeof staffProductivityQuerySchema>
