import { and, eq, ilike, isNull, or, sql } from "drizzle-orm"

import type { DrizzleClient } from "../../db"
import { caricatureAssets } from "../../db/schema/caricature-assets"
import { caricatureCategories } from "../../db/schema/caricature-categories"
import { AppError } from "../errors"
import {
  normalizeCaricatureMetadataInput,
  type CaricatureMetadataInput,
} from "./caricature-asset-metadata"
import { hasReadyCaricaturePreviewDerivatives } from "./caricature-preview-generation"

export interface AdminCaricatureAssetListFilters {
  q?: string
  status?: string
  categoryId?: string
  page: number
  limit: number
}

export interface AdminCaricatureAssetListItem {
  id: string
  headline: string
  credit: string
  categoryId: string
  categoryName: string
  language: string
  status: string
  hasVisibleText: boolean
  hasOriginalFile: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface AdminCaricatureAssetDetail extends AdminCaricatureAssetListItem {
  description: string
  languageOther: string | null
  visibleText: string | null
  visibleTextTranslationEn: string | null
  keywords: string[]
  depictedSubjects: string[]
  visibility: string
  hasReadyPreviewDerivatives: boolean
}

export async function listAdminCaricatureAssets(
  db: DrizzleClient,
  filters: AdminCaricatureAssetListFilters,
): Promise<{
  items: AdminCaricatureAssetListItem[]
  total: number
  page: number
  limit: number
}> {
  const conditions = [isNull(caricatureAssets.deletedAt)]

  if (filters.q) {
    const pattern = `%${filters.q}%`
    conditions.push(
      or(
        ilike(caricatureAssets.headline, pattern),
        ilike(caricatureAssets.credit, pattern),
        ilike(caricatureAssets.description, pattern),
      )!,
    )
  }

  if (filters.status) {
    conditions.push(eq(caricatureAssets.status, filters.status.trim().toUpperCase()))
  }

  if (filters.categoryId) {
    conditions.push(eq(caricatureAssets.categoryId, filters.categoryId))
  }

  const whereClause = and(...conditions)
  const offset = (filters.page - 1) * filters.limit

  const rows = await db
    .select({
      asset: caricatureAssets,
      categoryName: caricatureCategories.name,
    })
    .from(caricatureAssets)
    .innerJoin(caricatureCategories, eq(caricatureAssets.categoryId, caricatureCategories.id))
    .where(whereClause)
    .orderBy(sql`${caricatureAssets.updatedAt} DESC`)
    .limit(filters.limit)
    .offset(offset)

  const countQuery = await db
    .select({ count: sql<number>`count(*)` })
    .from(caricatureAssets)
    .where(whereClause)

  return {
    items: rows.map(({ asset, categoryName }) => mapListItem(asset, categoryName)),
    total: Number(countQuery[0]?.count ?? 0),
    page: filters.page,
    limit: filters.limit,
  }
}

export async function getAdminCaricatureAssetById(
  db: DrizzleClient,
  assetId: string,
): Promise<AdminCaricatureAssetDetail | null> {
  const rows = await db
    .select({
      asset: caricatureAssets,
      categoryName: caricatureCategories.name,
    })
    .from(caricatureAssets)
    .innerJoin(caricatureCategories, eq(caricatureAssets.categoryId, caricatureCategories.id))
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  const detail = mapDetail(row.asset, row.categoryName)
  detail.hasReadyPreviewDerivatives = await hasReadyCaricaturePreviewDerivatives(db, assetId)
  return detail
}

export async function createAdminCaricatureAsset(
  db: DrizzleClient,
  input: CaricatureMetadataInput,
  actorStaffId: string | null,
): Promise<AdminCaricatureAssetDetail> {
  const metadata = normalizeCaricatureMetadataInput(input, { hasOriginalFile: false })
  await assertActiveCategory(db, metadata.categoryId)

  const [created] = await db
    .insert(caricatureAssets)
    .values({
      headline: metadata.headline,
      description: metadata.description,
      credit: metadata.credit,
      categoryId: metadata.categoryId,
      language: metadata.language,
      languageOther: metadata.languageOther,
      visibleText: metadata.visibleText,
      visibleTextTranslationEn: metadata.visibleTextTranslationEn,
      hasVisibleText: metadata.hasVisibleText,
      keywords: metadata.keywords,
      depictedSubjects: metadata.depictedSubjects,
      publishedAt: metadata.publishedAt,
      status: metadata.status,
      visibility: metadata.status === "PUBLISHED" ? "PUBLIC" : "PRIVATE",
      createdByStaffId: actorStaffId,
      updatedByStaffId: actorStaffId,
      publishedByStaffId: metadata.status === "PUBLISHED" ? actorStaffId : null,
      publishedRecordAt: metadata.status === "PUBLISHED" ? new Date() : null,
    })
    .returning({ id: caricatureAssets.id })

  const detail = await getAdminCaricatureAssetById(db, created.id)
  if (!detail) {
    throw new AppError(500, "CARICATURE_CREATE_FAILED", "Failed to load created caricature.")
  }
  return detail
}

export async function updateAdminCaricatureAsset(
  db: DrizzleClient,
  assetId: string,
  input: CaricatureMetadataInput,
  actorStaffId: string | null,
): Promise<AdminCaricatureAssetDetail> {
  const existing = await db
    .select()
    .from(caricatureAssets)
    .where(and(eq(caricatureAssets.id, assetId), isNull(caricatureAssets.deletedAt)))
    .limit(1)

  const row = existing[0]
  if (!row) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }

  const hasOriginalFile = Boolean(row.originalObjectKey?.trim())
  const hasReadyPreviewDerivatives = await hasReadyCaricaturePreviewDerivatives(db, assetId)
  const metadata = normalizeCaricatureMetadataInput(input, {
    hasOriginalFile,
    hasReadyPreviewDerivatives,
  })
  await assertActiveCategory(db, metadata.categoryId)

  const now = new Date()
  const becamePublished = row.status !== "PUBLISHED" && metadata.status === "PUBLISHED"

  await db
    .update(caricatureAssets)
    .set({
      headline: metadata.headline,
      description: metadata.description,
      credit: metadata.credit,
      categoryId: metadata.categoryId,
      language: metadata.language,
      languageOther: metadata.languageOther,
      visibleText: metadata.visibleText,
      visibleTextTranslationEn: metadata.visibleTextTranslationEn,
      hasVisibleText: metadata.hasVisibleText,
      keywords: metadata.keywords,
      depictedSubjects: metadata.depictedSubjects,
      publishedAt: metadata.publishedAt,
      status: metadata.status,
      visibility: metadata.status === "PUBLISHED" ? "PUBLIC" : "PRIVATE",
      updatedByStaffId: actorStaffId,
      updatedAt: now,
      publishedByStaffId:
        metadata.status === "PUBLISHED"
          ? (row.publishedByStaffId ?? actorStaffId)
          : row.publishedByStaffId,
      publishedRecordAt:
        metadata.status === "PUBLISHED"
          ? (row.publishedRecordAt ?? (becamePublished ? now : null))
          : row.publishedRecordAt,
    })
    .where(eq(caricatureAssets.id, assetId))

  const detail = await getAdminCaricatureAssetById(db, assetId)
  if (!detail) {
    throw new AppError(500, "CARICATURE_UPDATE_FAILED", "Failed to load updated caricature.")
  }
  return detail
}

async function assertActiveCategory(db: DrizzleClient, categoryId: string) {
  const rows = await db
    .select({ id: caricatureCategories.id, isActive: caricatureCategories.isActive })
    .from(caricatureCategories)
    .where(eq(caricatureCategories.id, categoryId))
    .limit(1)

  const category = rows[0]
  if (!category) {
    throw new AppError(404, "CARICATURE_CATEGORY_NOT_FOUND", "Category not found.")
  }
  if (!category.isActive) {
    throw new AppError(400, "CARICATURE_CATEGORY_INACTIVE", "Category is inactive.")
  }
}

function mapListItem(
  asset: typeof caricatureAssets.$inferSelect,
  categoryName: string,
): AdminCaricatureAssetListItem {
  return {
    id: asset.id,
    headline: asset.headline,
    credit: asset.credit,
    categoryId: asset.categoryId,
    categoryName,
    language: asset.language,
    status: asset.status,
    hasVisibleText: asset.hasVisibleText,
    hasOriginalFile: Boolean(asset.originalObjectKey?.trim()),
    publishedAt: asset.publishedAt.toISOString(),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

function mapDetail(
  asset: typeof caricatureAssets.$inferSelect,
  categoryName: string,
): AdminCaricatureAssetDetail {
  return {
    ...mapListItem(asset, categoryName),
    description: asset.description,
    languageOther: asset.languageOther,
    visibleText: asset.visibleText,
    visibleTextTranslationEn: asset.visibleTextTranslationEn,
    keywords: asset.keywords,
    depictedSubjects: asset.depictedSubjects,
    visibility: asset.visibility,
    hasReadyPreviewDerivatives: false,
  }
}
