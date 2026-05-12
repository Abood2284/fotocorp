import { z } from "zod";

export const adminContributorUploadStatusFilter = z.enum([
  "SUBMITTED",
  "APPROVED",
  "ACTIVE",
  "all",
]);

export const adminContributorUploadListQuerySchema = z.object({
  status: adminContributorUploadStatusFilter.optional(),
  assetType: z.enum(["IMAGE", "VIDEO", "CARICATURE", "all"]).optional(),
  eventId: z.uuid().optional(),
  contributorId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be yyyy-mm-dd")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be yyyy-mm-dd")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AdminContributorUploadListQuery = z.infer<typeof adminContributorUploadListQuerySchema>;

export const adminContributorUploadParamSchema = z.object({
  imageAssetId: z.uuid(),
});

export const adminContributorUploadBatchParamSchema = z.object({
  batchId: z.uuid(),
});

export const adminContributorUploadApproveBodySchema = z.object({
  imageAssetIds: z
    .array(z.uuid())
    .min(1, "imageAssetIds must not be empty")
    .max(100, "imageAssetIds may not exceed 100 ids per request"),
});

export type AdminContributorUploadApproveBody = z.infer<typeof adminContributorUploadApproveBodySchema>;
