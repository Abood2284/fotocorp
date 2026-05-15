import { z } from "zod"

export const adminEventParamSchema = z.object({
  eventId: z.string().uuid(),
})

export const adminEventListQuerySchema = z.object({
  q: z.string().trim().optional(),
  source: z.enum(["LEGACY_IMPORT", "MANUAL", "CONTRIBUTOR", "Fotocorp"]).optional(),
  hasAssets: z.enum(["true", "false"]).optional(),
  assetsMin: z.coerce.number().min(0).optional(),
  assetsMax: z.coerce.number().min(0).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export const adminEventUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  eventDate: z.string().datetime().nullable().optional(),
  eventTime: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  stateRegion: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

export const adminEventPurgeSchema = z.object({
  exactName: z.string().min(1),
  phrase: z.literal("PURGE EVENT"),
  password: z.string().min(1),
})
