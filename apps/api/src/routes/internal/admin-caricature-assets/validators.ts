import { z } from "zod"

import {
  CARICATURE_ASSET_STATUSES,
  CARICATURE_LANGUAGES,
} from "../../../db/schema/caricature-assets"

export const adminCaricatureAssetParamSchema = z.object({
  assetId: z.string().uuid(),
})

export const adminCaricatureAssetListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(CARICATURE_ASSET_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export const adminCaricatureAssetMetadataSchema = z.object({
  headline: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(5000),
  credit: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  language: z.enum(CARICATURE_LANGUAGES),
  languageOther: z.string().trim().max(200).nullable().optional(),
  visibleText: z.string().trim().max(5000).nullable().optional(),
  visibleTextTranslationEn: z.string().trim().max(5000).nullable().optional(),
  keywords: z.union([z.array(z.string()), z.string()]),
  depictedSubjects: z.union([z.array(z.string()), z.string()]),
  publishedAt: z.string().datetime(),
  status: z.enum(CARICATURE_ASSET_STATUSES),
})

export const caricatureUploadShellSchema = z.object({
  credit: z.string().trim().min(1).max(500),
  fileName: z.string().trim().max(500).optional(),
})

export const caricatureOriginalPresignSchema = z.object({
  fileName: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
})

export const caricatureOriginalCompleteSchema = z.object({
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  checksum: z.string().trim().max(128).optional().nullable(),
})
