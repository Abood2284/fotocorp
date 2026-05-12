import { z } from "zod";

export const photographerImagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
});
