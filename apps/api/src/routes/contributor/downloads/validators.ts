import { z } from "zod";

export const contributorDownloadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["top", "recent"]).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be yyyy-mm-dd")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be yyyy-mm-dd")
    .optional(),
});

export type ContributorDownloadsQuery = z.infer<typeof contributorDownloadsQuerySchema>;
