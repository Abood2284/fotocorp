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
