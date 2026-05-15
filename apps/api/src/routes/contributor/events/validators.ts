import { z } from "zod";

export const photographerEventsListQuerySchema = z.object({
  scope: z
    .enum(["mine", "available"])
    .optional()
    .transform((v) => v ?? "mine"),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type PhotographerEventsListQuery = z.infer<typeof photographerEventsListQuerySchema>;

const optionalDateString = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "eventDate must be YYYY-MM-DD" });

const optionalNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const keywordsField = z.union([
  z.string().trim().max(4000),
  z.array(z.string().trim().max(500)).max(200),
]);

export const photographerEventCreateBodySchema = z.object({
  name: z.string().trim().min(2).max(180),
  categoryId: z.string().uuid(),
  targetContributorId: z.string().uuid().optional(),
  eventDate: optionalDateString,
  eventTime: optionalNullableString(64),
  country: optionalNullableString(120),
  stateRegion: optionalNullableString(120),
  city: optionalNullableString(120),
  location: optionalNullableString(500),
  keywords: keywordsField.optional().transform((v) => {
    if (v === undefined) return undefined;
    if (Array.isArray(v)) return v.filter(Boolean).join(", ");
    return v === "" ? undefined : v;
  }),
  description: optionalNullableString(8000),
});

export const photographerEventPatchBodySchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    categoryId: z.string().uuid().optional(),
    eventDate: optionalDateString.optional(),
    eventTime: optionalNullableString(64).optional(),
    country: optionalNullableString(120).optional(),
    stateRegion: optionalNullableString(120).optional(),
    city: optionalNullableString(120).optional(),
    location: optionalNullableString(500).optional(),
    keywords: keywordsField.optional().transform((v) => {
      if (v === undefined) return undefined;
      if (Array.isArray(v)) return v.filter(Boolean).join(", ");
      return v === "" ? undefined : v;
    }),
    description: optionalNullableString(8000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required." });

export const photographerEventIdParamSchema = z.object({
  eventId: z.uuid(),
});

export type PhotographerEventCreateBody = z.infer<typeof photographerEventCreateBodySchema>;
export type PhotographerEventPatchBody = z.infer<typeof photographerEventPatchBodySchema>;
