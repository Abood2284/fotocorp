import { z } from "zod";
import { createUploadBatchBodySchema } from "../../contributor/uploads/validators";

export const staffUploadWizardContributorsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export const staffUploadWizardEventBodySchema = z.object({
  name: z.string().trim().min(2).max(180),
  categoryId: z.string().uuid(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate must be YYYY-MM-DD"),
  targetContributorId: z.string().uuid(),
});

export const staffUploadWizardBatchBodySchema = createUploadBatchBodySchema.extend({
  targetContributorId: z.string().uuid(),
});

export type StaffUploadWizardEventBody = z.infer<typeof staffUploadWizardEventBodySchema>;
export type StaffUploadWizardBatchBody = z.infer<typeof staffUploadWizardBatchBodySchema>;
