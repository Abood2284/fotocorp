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
  sort: z.enum(["submitted", "contributor", "event"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
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

export const adminContributorUploadRejectBodySchema = z.object({
  imageAssetIds: z
    .array(z.uuid())
    .min(1, "imageAssetIds must not be empty")
    .max(100, "imageAssetIds may not exceed 100 ids per request"),
});

export type AdminContributorUploadRejectBody = z.infer<typeof adminContributorUploadRejectBodySchema>;

const keywordsField = z.union([
  z.string().trim().max(8000),
  z.array(z.string().trim().max(200)).max(80),
]);

export const adminContributorUploadMetadataPatchBodySchema = z
  .object({
    expectedUpdatedAt: z.string().trim().min(1).max(64),
    title: z.string().trim().max(2048).nullable().optional(),
    caption: z.string().trim().max(8000).nullable().optional(),
    keywords: keywordsField.nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.caption !== undefined || v.keywords !== undefined, {
    message: "At least one of title, caption, or keywords is required.",
  });

export type AdminContributorUploadMetadataPatchBody = z.infer<typeof adminContributorUploadMetadataPatchBodySchema>;

export const adminContributorUploadReplacePresignBodySchema = z.object({
  contentType: z.string().trim().min(1).max(200),
});

export type AdminContributorUploadReplacePresignBody = z.infer<typeof adminContributorUploadReplacePresignBodySchema>;

export const adminContributorUploadReplaceCompleteBodySchema = z.object({
  expectedUpdatedAt: z.string().trim().min(1).max(64),
  mimeType: z.string().trim().min(1).max(200).optional(),
  sizeBytes: z.coerce.number().int().min(0).max(5_000_000_000).optional(),
  originalFileName: z.string().trim().min(1).max(512).optional(),
});

export type AdminContributorUploadReplaceCompleteBody = z.infer<typeof adminContributorUploadReplaceCompleteBodySchema>;
