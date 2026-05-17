import { z } from "zod";

export const createUploadBatchBodySchema = z.object({
  eventId: z.uuid(),
  assetType: z.enum(["IMAGE", "VIDEO", "CARICATURE"]).optional().default("IMAGE"),
  commonTitle: z.string().trim().max(500).optional(),
  commonCaption: z.string().trim().max(8000).optional(),
  commonKeywords: z.string().trim().max(4000).optional(),
});

export const uploadBatchesListQuerySchema = z.object({
  status: z.enum(["OPEN", "SUBMITTED", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  eventId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const uploadBatchIdParamSchema = z.object({
  batchId: z.uuid(),
});

export const uploadBatchItemParamSchema = z.object({
  batchId: z.uuid(),
  itemId: z.uuid(),
});

const filePrepareSchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  mimeType: z.enum(["image/jpeg"]),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
});

export const prepareUploadFilesBodySchema = z.object({
  files: z.array(filePrepareSchema).min(1).max(100),
});

const keywordsField = z.union([
  z.string().trim().max(8000),
  z.array(z.string().trim().max(200)).max(80),
]);

export const patchUploadAssetMetadataBodySchema = z
  .object({
    expectedUpdatedAt: z.string().trim().min(1).max(64).optional(),
    whoIsInPicture: z.string().trim().max(2048).nullable().optional(),
    caption: z.string().trim().max(8000).nullable().optional(),
    keywords: keywordsField.nullable().optional(),
  })
  .refine((v) => v.whoIsInPicture !== undefined || v.caption !== undefined || v.keywords !== undefined, {
    message: "At least one of whoIsInPicture, caption, or keywords is required.",
  });

export const uploadBatchAssetParamSchema = z.object({
  batchId: z.uuid(),
  imageAssetId: z.uuid(),
});

export type CreateUploadBatchBody = z.infer<typeof createUploadBatchBodySchema>;
export type UploadBatchesListQuery = z.infer<typeof uploadBatchesListQuerySchema>;
export type PrepareUploadFilesBody = z.infer<typeof prepareUploadFilesBodySchema>;
export type PatchUploadAssetMetadataBody = z.infer<typeof patchUploadAssetMetadataBodySchema>;
