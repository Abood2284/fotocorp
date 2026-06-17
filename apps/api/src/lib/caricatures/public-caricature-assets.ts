import { sql, type SQL } from "drizzle-orm"

import { AppError } from "../errors"
import {
  sanitizeCaricatureSearchableStringList,
  sanitizeCaricatureSearchableText,
} from "../search/typesense-caricature-text"
import type {
  CaricatureSearchDto,
  TypesenseCaricatureSearchQuery,
  TypesenseCaricatureSearchResponse,
} from "../search/typesense-caricatures"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PublicReadQueryClient = {
  execute(query: SQL): Promise<unknown>
}

export interface PublicCaricaturePreview {
  url: string
  width: number
  height: number
}

export interface PublicCaricatureDetail {
  id: string
  headline: string
  description: string
  credit: string
  categoryId: string
  categoryName: string
  language: string
  hasVisibleText: boolean
  visibleText: string | null
  visibleTextTranslationEn: string | null
  keywords: string[]
  depictedSubjects: string[]
  publishedAt: string
  previews: {
    card: PublicCaricaturePreview | null
    detail: PublicCaricaturePreview | null
  }
}

interface PublicCaricatureDetailRow {
  id: string
  headline: string
  description: string
  credit: string
  category_id: string
  category_name: string
  language: string
  has_visible_text: boolean
  visible_text: string | null
  visible_text_translation_en: string | null
  keywords: unknown
  depicted_subjects: unknown
  published_at: Date | string
  preview_card_url: string | null
  preview_card_width: number | null
  preview_card_height: number | null
  preview_detail_url: string | null
  preview_detail_width: number | null
  preview_detail_height: number | null
}

export async function getPublicCaricatureDetail(
  db: PublicReadQueryClient,
  assetId: string,
): Promise<{ caricature: PublicCaricatureDetail }> {
  if (!UUID_PATTERN.test(assetId)) {
    throw new AppError(400, "INVALID_CARICATURE_ID", "Caricature id is invalid.")
  }

  const rows = await executeRows<PublicCaricatureDetailRow>(
    db,
    sql`
      select
        ca.id::text as id,
        ca.headline,
        ca.description,
        ca.credit,
        ca.category_id::text as category_id,
        cc.name as category_name,
        ca.language,
        ca.has_visible_text,
        ca.visible_text,
        ca.visible_text_translation_en,
        ca.keywords,
        ca.depicted_subjects,
        ca.published_at,
        card.public_url as preview_card_url,
        card.width as preview_card_width,
        card.height as preview_card_height,
        detail.public_url as preview_detail_url,
        detail.width as preview_detail_width,
        detail.height as preview_detail_height
      from caricature_assets ca
      join caricature_categories cc on cc.id = ca.category_id
      join caricature_derivatives card
        on card.caricature_id = ca.id
       and card.derivative_type = 'BLURRED_CARD'
       and card.status = 'READY'
       and card.public_url is not null
      left join caricature_derivatives detail
        on detail.caricature_id = ca.id
       and detail.derivative_type = 'BLURRED_DETAIL'
       and detail.status = 'READY'
       and detail.public_url is not null
      where ca.id = ${assetId}::uuid
        and ca.status = 'PUBLISHED'
        and ca.visibility = 'PUBLIC'
        and ca.deleted_at is null
      limit 1
    `,
  )

  const row = rows[0]
  if (!row) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature was not found.")
  }

  const cardPreview = mapPreview(row.preview_card_url, row.preview_card_width, row.preview_card_height)
  if (!cardPreview) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature was not found.")
  }

  const visibleText = sanitizeCaricatureSearchableText(row.visible_text)
  const visibleTextTranslationEn = sanitizeCaricatureSearchableText(row.visible_text_translation_en)

  return {
    caricature: {
      id: row.id,
      headline: row.headline.trim(),
      description: row.description.trim(),
      credit: row.credit.trim(),
      categoryId: row.category_id,
      categoryName: row.category_name.trim(),
      language: row.language,
      hasVisibleText: row.has_visible_text,
      visibleText: visibleText ?? null,
      visibleTextTranslationEn: visibleTextTranslationEn ?? null,
      keywords: sanitizeCaricatureSearchableStringList(row.keywords),
      depictedSubjects: sanitizeCaricatureSearchableStringList(row.depicted_subjects),
      publishedAt: toIsoString(row.published_at),
      previews: {
        card: cardPreview,
        detail: mapPreview(row.preview_detail_url, row.preview_detail_width, row.preview_detail_height) ?? cardPreview,
      },
    },
  }
}

function mapPreview(
  url: string | null,
  width: number | null,
  height: number | null,
): PublicCaricaturePreview | null {
  if (!url?.trim()) return null
  if (width == null || height == null || width <= 0 || height <= 0) return null
  return {
    url: url.trim(),
    width,
    height,
  }
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

async function executeRows<T>(db: PublicReadQueryClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (!result || typeof result !== "object" || !("rows" in result)) return []
  const rows = (result as { rows?: unknown }).rows
  return Array.isArray(rows) ? (rows as T[]) : []
}

interface PublicCaricatureSearchRow extends PublicCaricatureDetailRow {
  status: string
  visibility: string
  created_at: Date | string
}

export function shouldTryCaricatureSqlFallback(
  query: TypesenseCaricatureSearchQuery,
  typesenseTotal: number,
): boolean {
  if (typesenseTotal > 0) return false
  if (query.q !== "*") return false
  if (query.categoryId || query.category) return false
  if (query.language) return false
  if (query.credit) return false
  if (query.hasVisibleText !== null) return false
  if (query.depictedSubject) return false
  return true
}

export async function listPublicCaricatures(
  db: PublicReadQueryClient,
  query: TypesenseCaricatureSearchQuery,
): Promise<TypesenseCaricatureSearchResponse> {
  const startedAt = Date.now()
  const filters = buildPublicCaricatureSearchFilters(query)
  const orderBy = buildPublicCaricatureSearchOrderBy(query)
  const offset = (query.page - 1) * query.limit

  const countRows = await executeRows<{ count: string }>(
    db,
    sql`
      select count(*)::text as count
      from caricature_assets ca
      join caricature_categories cc on cc.id = ca.category_id
      join caricature_derivatives card
        on card.caricature_id = ca.id
       and card.derivative_type = 'BLURRED_CARD'
       and card.status = 'READY'
       and card.public_url is not null
      where ca.status = 'PUBLISHED'
        and ca.visibility = 'PUBLIC'
        and ca.deleted_at is null
        ${filters}
    `,
  )

  const total = Number.parseInt(countRows[0]?.count ?? "0", 10)
  const rows = total === 0
    ? []
    : await executeRows<PublicCaricatureSearchRow>(
      db,
      sql`
        select
          ca.id::text as id,
          ca.headline,
          ca.description,
          ca.credit,
          ca.category_id::text as category_id,
          cc.name as category_name,
          ca.language,
          ca.has_visible_text,
          ca.visible_text,
          ca.visible_text_translation_en,
          ca.keywords,
          ca.depicted_subjects,
          ca.published_at,
          ca.created_at,
          ca.status,
          ca.visibility,
          card.public_url as preview_card_url,
          card.width as preview_card_width,
          card.height as preview_card_height,
          detail.public_url as preview_detail_url,
          detail.width as preview_detail_width,
          detail.height as preview_detail_height
        from caricature_assets ca
        join caricature_categories cc on cc.id = ca.category_id
        join caricature_derivatives card
          on card.caricature_id = ca.id
         and card.derivative_type = 'BLURRED_CARD'
         and card.status = 'READY'
         and card.public_url is not null
        left join caricature_derivatives detail
          on detail.caricature_id = ca.id
         and detail.derivative_type = 'BLURRED_DETAIL'
         and detail.status = 'READY'
         and detail.public_url is not null
        where ca.status = 'PUBLISHED'
          and ca.visibility = 'PUBLIC'
          and ca.deleted_at is null
          ${filters}
        order by ${orderBy}
        limit ${query.limit}
        offset ${offset}
      `,
    )

  const items = rows.map(mapPublicCaricatureSearchRow)
  const totalPages = query.limit > 0 ? Math.ceil(total / query.limit) : 0
  const durationMs = Date.now() - startedAt

  return {
    items,
    total,
    totalCount: total,
    page: query.page,
    perPage: query.limit,
    limit: query.limit,
    totalPages,
    hasMore: query.page * query.limit < total,
    facets: {
      categories: [],
      languages: [],
      credits: [],
      hasVisibleText: [],
    },
    timing: {
      backend: "postgres",
      tookMs: durationMs,
    },
    meta: {
      source: "postgres",
    },
  }
}

function buildPublicCaricatureSearchFilters(query: TypesenseCaricatureSearchQuery): SQL {
  const clauses: SQL[] = []

  if (query.q !== "*") {
    const pattern = `%${escapeIlikePattern(query.q)}%`
    clauses.push(sql`
      and (
        ca.headline ilike ${pattern}
        or ca.description ilike ${pattern}
        or ca.credit ilike ${pattern}
        or coalesce(ca.visible_text, '') ilike ${pattern}
        or coalesce(ca.visible_text_translation_en, '') ilike ${pattern}
        or exists (
          select 1
          from unnest(ca.keywords) as keyword
          where keyword ilike ${pattern}
        )
        or exists (
          select 1
          from unnest(ca.depicted_subjects) as subject
          where subject ilike ${pattern}
        )
      )
    `)
  }

  const categoryId = uuidFrom(query.categoryId) ?? uuidFrom(query.category)
  if (categoryId) {
    clauses.push(sql`and ca.category_id = ${categoryId}::uuid`)
  } else if (query.category) {
    clauses.push(sql`and cc.name ilike ${query.category}`)
  }

  if (query.language) {
    clauses.push(sql`and ca.language = ${query.language}`)
  }

  if (query.credit) {
    clauses.push(sql`and ca.credit ilike ${`%${escapeIlikePattern(query.credit)}%`}`)
  }

  if (query.hasVisibleText !== null) {
    clauses.push(sql`and ca.has_visible_text = ${query.hasVisibleText}`)
  }

  if (query.depictedSubject) {
    clauses.push(sql`and ${query.depictedSubject} = any(ca.depicted_subjects)`)
  }

  if (clauses.length === 0) return sql``

  return sql.join(clauses, sql` `)
}

function buildPublicCaricatureSearchOrderBy(query: TypesenseCaricatureSearchQuery): SQL {
  if (query.sort === "oldest") return sql`ca.published_at asc, ca.id asc`
  if (query.sort === "popular") return sql`ca.published_at desc, ca.id desc`
  return sql`ca.published_at desc, ca.id desc`
}

function mapPublicCaricatureSearchRow(row: PublicCaricatureSearchRow): CaricatureSearchDto {
  const cardPreview = mapPreview(row.preview_card_url, row.preview_card_width, row.preview_card_height)
  const detailPreview = mapPreview(row.preview_detail_url, row.preview_detail_width, row.preview_detail_height)

  return {
    id: row.id,
    headline: row.headline.trim(),
    description: row.description.trim(),
    credit: row.credit.trim(),
    categoryId: row.category_id,
    categoryName: row.category_name.trim(),
    language: row.language,
    hasVisibleText: row.has_visible_text,
    keywords: sanitizeCaricatureSearchableStringList(row.keywords),
    depictedSubjects: sanitizeCaricatureSearchableStringList(row.depicted_subjects),
    publishedAt: toIsoString(row.published_at),
    createdAt: toIsoString(row.created_at),
    status: row.status,
    visibility: row.visibility,
    previewUrl: cardPreview?.url ?? detailPreview?.url ?? null,
    width: cardPreview?.width ?? detailPreview?.width ?? null,
    height: cardPreview?.height ?? detailPreview?.height ?? null,
    previews: {
      card: cardPreview,
      detail: detailPreview ?? cardPreview,
    },
    downloadCount: null,
    popularityScore: null,
  }
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

function uuidFrom(value: string | null): string | null {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}
