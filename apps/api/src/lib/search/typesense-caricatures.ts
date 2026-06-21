import type { Env } from "../../appTypes";
import {
  sanitizeCaricatureSearchableStringList,
  sanitizeCaricatureSearchableText,
} from "./typesense-caricature-text";
import {
  TypesenseNotConfiguredError,
  TypesenseSearchFailedError,
  TypesenseSearchInputError,
  buildTypesenseRequestHeaders,
} from "./typesense-public-assets";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_SEARCH_TIMEOUT_MS = 2_500;
const DEFAULT_COLLECTION_ALIAS = "caricatures_current";

export const TYPESENSE_CARICATURE_QUERY_BY =
  "headline,keywords,depicted_subjects,description,visible_text,visible_text_translation_en,credit";
export const TYPESENSE_CARICATURE_QUERY_BY_WEIGHTS = "5,4,4,3,2,2,1";
export const TYPESENSE_CARICATURE_FACET_BY =
  "category_id,category_name,language,has_visible_text,credit,depicted_subjects";
const FACET_BY = TYPESENSE_CARICATURE_FACET_BY;
const DEFAULT_SORT_BY = "published_at_ts:desc";

export interface TypesenseCaricatureSearchQuery {
  q: string;
  category: string | null;
  categoryId: string | null;
  language: string | null;
  credit: string | null;
  hasVisibleText: boolean | null;
  depictedSubject: string | null;
  limit: number;
  page: number;
  sort: "newest" | "oldest" | "relevance" | "popular";
  includeFacets: boolean;
}

export interface TypesenseCaricatureRow {
  id: string;
  headline: string;
  description: string;
  credit: string;
  category_id: string;
  category_name: string;
  language: string;
  has_visible_text: boolean;
  visible_text: string | null;
  visible_text_translation_en: string | null;
  keywords: unknown;
  depicted_subjects: unknown;
  published_at: Date | string | null;
  created_at: Date | string | null;
  status: string;
  visibility: string;
  preview_card_url: string | null;
  preview_detail_url: string | null;
  preview_card_width: number | null;
  preview_card_height: number | null;
  preview_detail_width: number | null;
  preview_detail_height: number | null;
  download_count?: number | null;
  popularity_score?: number | null;
}

export type TypesenseCaricatureDocument = Record<string, string | number | boolean | string[]>;

export interface TypesenseCollectionField {
  name: string;
  type: string;
  facet?: boolean;
  optional?: boolean;
  sort?: boolean;
  index?: boolean;
}

export interface TypesenseCollectionSchema {
  name: string;
  fields: TypesenseCollectionField[];
  default_sorting_field?: string;
}

interface TypesenseCaricatureSearchConfig {
  host: string;
  apiKey: string;
  collection: string;
  timeoutMs: number;
  cloudflareAccess: {
    clientId: string;
    clientSecret: string;
  } | null;
}

interface TypesenseSearchHit {
  document?: unknown;
}

interface TypesenseFacetCount {
  field_name?: unknown;
  counts?: unknown;
}

interface TypesenseSearchResponse {
  found?: unknown;
  out_of?: unknown;
  search_time_ms?: unknown;
  hits?: unknown;
  facet_counts?: unknown;
}

type CaricatureSearchDocument = Record<string, unknown>;

interface CaricaturePreviewDto {
  url: string;
  width: number;
  height: number;
}

export interface CaricatureSearchDto {
  id: string | null;
  headline: string | null;
  description: string | null;
  credit: string | null;
  categoryId: string | null;
  categoryName: string | null;
  language: string | null;
  hasVisibleText: boolean | null;
  hasTranslation: boolean;
  keywords: string[];
  depictedSubjects: string[];
  publishedAt: string | null;
  createdAt: string | null;
  status: string | null;
  visibility: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  previews: {
    card: CaricaturePreviewDto | null;
    detail: CaricaturePreviewDto | null;
  };
  downloadCount: number | null;
  popularityScore: number | null;
}

export interface TypesenseCaricatureSearchResponse {
  items: CaricatureSearchDto[];
  total: number;
  totalCount: number;
  page: number;
  perPage: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  facets: CaricatureSearchFacets;
  timing: {
    backend: "typesense" | "postgres";
    tookMs: number;
  };
  meta: CaricatureSearchMeta;
}

export interface CaricatureSearchFacetItem {
  value: string;
  count: number;
  name: string;
  assetCount: number;
}

export interface CaricatureSearchFacets {
  categories: CaricatureSearchFacetItem[];
  languages: CaricatureSearchFacetItem[];
  credits: CaricatureSearchFacetItem[];
  hasVisibleText: CaricatureSearchFacetItem[];
  depictedSubjects: CaricatureSearchFacetItem[];
}

export interface CaricatureSearchMeta {
  source: "typesense" | "postgres";
  searchTimeMs?: number;
  outOf?: number;
  popularSortAvailable?: boolean;
}

export function buildEmptyCaricatureSearchFacets(): CaricatureSearchFacets {
  return {
    categories: [],
    languages: [],
    credits: [],
    hasVisibleText: [],
    depictedSubjects: [],
  };
}

export function buildCaricaturesCollectionSchema(collectionName: string): TypesenseCollectionSchema {
  return {
    name: collectionName,
    fields: [
      { name: "id", type: "string" },
      { name: "headline", type: "string" },
      { name: "description", type: "string", optional: true },
      { name: "credit", type: "string", facet: true, optional: true },
      { name: "category_id", type: "string", facet: true },
      { name: "category_name", type: "string", facet: true, optional: true },
      { name: "language", type: "string", facet: true },
      { name: "has_visible_text", type: "bool", facet: true },
      { name: "visible_text", type: "string", optional: true },
      { name: "visible_text_translation_en", type: "string", optional: true },
      { name: "keywords", type: "string[]", facet: true, optional: true },
      { name: "depicted_subjects", type: "string[]", facet: true, optional: true },
      { name: "published_at_ts", type: "int64", facet: true, sort: true },
      { name: "created_at_ts", type: "int64", facet: true, sort: true },
      { name: "status", type: "string", facet: true },
      { name: "visibility", type: "string", facet: true },
      { name: "preview_card_url", type: "string", optional: true, index: false },
      { name: "preview_detail_url", type: "string", optional: true, index: false },
      { name: "preview_card_width", type: "int32", optional: true, index: false },
      { name: "preview_card_height", type: "int32", optional: true, index: false },
      { name: "preview_detail_width", type: "int32", optional: true, index: false },
      { name: "preview_detail_height", type: "int32", optional: true, index: false },
      { name: "download_count", type: "int32", facet: true, optional: true, sort: true },
      { name: "popularity_score", type: "float", facet: true, optional: true, sort: true },
    ],
    default_sorting_field: "published_at_ts",
  };
}

export function buildTypesenseCaricatureDocument(row: TypesenseCaricatureRow): TypesenseCaricatureDocument {
  const keywords = sanitizeCaricatureSearchableStringList(row.keywords);
  const depictedSubjects = sanitizeCaricatureSearchableStringList(row.depicted_subjects);
  const visibleText = sanitizeCaricatureSearchableText(row.visible_text);
  const visibleTextTranslationEn = sanitizeCaricatureSearchableText(row.visible_text_translation_en);
  const downloadCount = toInteger(row.download_count);
  const popularityScore = toFloat(row.popularity_score);

  return dropUndefined({
    id: row.id,
    headline: sanitizeCaricatureSearchableText(row.headline) ?? row.headline.trim(),
    description: sanitizeCaricatureSearchableText(row.description) ?? row.description.trim(),
    credit: sanitizeCaricatureSearchableText(row.credit) ?? row.credit.trim(),
    category_id: row.category_id,
    category_name: sanitizeCaricatureSearchableText(row.category_name) ?? row.category_name.trim(),
    language: row.language,
    has_visible_text: row.has_visible_text,
    visible_text: visibleText ?? undefined,
    visible_text_translation_en: visibleTextTranslationEn ?? undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    depicted_subjects: depictedSubjects.length > 0 ? depictedSubjects : undefined,
    published_at_ts: toUnixSeconds(row.published_at),
    created_at_ts: toUnixSeconds(row.created_at),
    status: row.status,
    visibility: row.visibility,
    preview_card_url: normalizeOptional(row.preview_card_url) ?? undefined,
    preview_detail_url: normalizeOptional(row.preview_detail_url) ?? undefined,
    preview_card_width: row.preview_card_width ?? undefined,
    preview_card_height: row.preview_card_height ?? undefined,
    preview_detail_width: row.preview_detail_width ?? undefined,
    preview_detail_height: row.preview_detail_height ?? undefined,
    download_count: downloadCount ?? undefined,
    popularity_score: popularityScore ?? undefined,
  });
}

export function parseTypesenseCaricatureSearchQuery(
  searchParams: URLSearchParams,
): TypesenseCaricatureSearchQuery {
  const q = normalizeOptional(searchParams.get("q")) ?? "*";
  const limit = parseBoundedInteger(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT, "limit");
  const page = parseBoundedInteger(searchParams.get("page"), DEFAULT_PAGE, 1, 10_000, "page");
  const sort = parseSort(searchParams.get("sort"), q);
  const includeFacets = parseBooleanParam(searchParams.get("includeFacets"), true);

  return {
    q,
    category: normalizeOptional(searchParams.get("category")),
    categoryId: normalizeOptional(searchParams.get("categoryId")),
    language: normalizeOptional(searchParams.get("language")),
    credit: normalizeOptional(searchParams.get("credit")),
    hasVisibleText: parseOptionalBoolean(searchParams.get("hasVisibleText")),
    depictedSubject: normalizeOptional(searchParams.get("depictedSubject")),
    limit,
    page,
    sort,
    includeFacets,
  };
}

export function parseTypesenseCaricatureSearchConfig(env: Env): TypesenseCaricatureSearchConfig {
  const host = normalizeOptional(env.TYPESENSE_HOST ?? null);
  const apiKey = normalizeOptional(env.TYPESENSE_API_KEY ?? null);
  const collection =
    normalizeOptional(env.TYPESENSE_CARICATURE_COLLECTION_ALIAS ?? null) ?? DEFAULT_COLLECTION_ALIAS;
  const accessClientId = normalizeOptional(env.TYPESENSE_CF_ACCESS_CLIENT_ID ?? null);
  const accessClientSecret = normalizeOptional(env.TYPESENSE_CF_ACCESS_CLIENT_SECRET ?? null);

  if (!host || !apiKey) {
    throw new TypesenseNotConfiguredError("Typesense caricature search is not configured.");
  }

  if ((accessClientId && !accessClientSecret) || (!accessClientId && accessClientSecret)) {
    throw new TypesenseNotConfiguredError("Typesense Cloudflare Access service token config is incomplete.");
  }

  const timeoutMs = parseTimeout(env.TYPESENSE_CARICATURE_SEARCH_TIMEOUT_MS ?? env.TYPESENSE_SEARCH_TIMEOUT_MS);

  return {
    host: normalizeTypesenseHost(host),
    apiKey,
    collection,
    timeoutMs,
    cloudflareAccess: accessClientId && accessClientSecret
      ? { clientId: accessClientId, clientSecret: accessClientSecret }
      : null,
  };
}

export function buildTypesenseCaricatureSearchUrl(
  config: Pick<TypesenseCaricatureSearchConfig, "host" | "collection">,
  query: TypesenseCaricatureSearchQuery,
): URL {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/search`,
    `${normalizeTypesenseHost(config.host)}/`,
  );
  const params = new URLSearchParams();
  params.set("q", query.q);
  params.set("query_by", TYPESENSE_CARICATURE_QUERY_BY);
  params.set("query_by_weights", TYPESENSE_CARICATURE_QUERY_BY_WEIGHTS);
  params.set("filter_by", buildTypesenseCaricatureFilterBy(query));
  params.set("sort_by", buildTypesenseCaricatureSortBy(query));
  if (query.includeFacets) params.set("facet_by", FACET_BY);
  params.set("per_page", String(query.limit));
  params.set("page", String(query.page));
  url.search = params.toString();
  return url;
}

export function buildEmptyTypesenseCaricatureSearchResponse(
  query: TypesenseCaricatureSearchQuery,
): TypesenseCaricatureSearchResponse {
  return {
    items: [],
    total: 0,
    totalCount: 0,
    page: query.page,
    perPage: query.limit,
    limit: query.limit,
    totalPages: 0,
    hasMore: false,
    facets: buildEmptyCaricatureSearchFacets(),
    timing: {
      backend: "typesense",
      tookMs: 0,
    },
    meta: {
      source: "typesense",
      popularSortAvailable: false,
    },
  };
}

export async function searchTypesenseCaricatures(
  env: Env,
  query: TypesenseCaricatureSearchQuery,
): Promise<TypesenseCaricatureSearchResponse> {
  const config = parseTypesenseCaricatureSearchConfig(env);
  const url = buildTypesenseCaricatureSearchUrl(config, query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("typesense_search_timeout"), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildTypesenseRequestHeaders(config),
      signal: controller.signal,
    });

    if (response.status === 404) {
      return buildEmptyTypesenseCaricatureSearchResponse(query);
    }

    if (!response.ok) {
      throw new TypesenseSearchFailedError(
        `Typesense caricature search returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const payload = (await response.json()) as TypesenseSearchResponse;
    return mapTypesenseCaricatureSearchResponse(payload, query);
  } catch (error) {
    if (error instanceof TypesenseSearchFailedError) throw error;
    const timedOut =
      error instanceof Error
        ? error.name === "AbortError"
        : controller.signal.aborted;
    throw new TypesenseSearchFailedError("Typesense caricature search request failed.", undefined, timedOut);
  } finally {
    clearTimeout(timeout);
  }
}

export function mapTypesenseCaricatureSearchResponse(
  payload: TypesenseSearchResponse,
  query: TypesenseCaricatureSearchQuery,
): TypesenseCaricatureSearchResponse {
  const totalCount = toInteger(payload.found) ?? 0;
  const outOf = toInteger(payload.out_of);
  const searchTimeMs = toSearchTimeMs(payload.search_time_ms);
  const totalPages = query.limit > 0 ? Math.ceil(totalCount / query.limit) : 0;
  const hits = Array.isArray(payload.hits) ? payload.hits : [];
  const items = hits
    .map((hit): unknown => (isRecord(hit) ? (hit as TypesenseSearchHit).document : null))
    .filter(isRecord)
    .map((document) => mapCaricatureDocument(document));

  return {
    items,
    total: totalCount,
    totalCount,
    page: query.page,
    perPage: query.limit,
    limit: query.limit,
    totalPages,
    hasMore: query.page * query.limit < totalCount,
    facets: mapFacets(payload.facet_counts),
    timing: {
      backend: "typesense",
      tookMs: searchTimeMs ?? 0,
    },
    meta: {
      source: "typesense",
      popularSortAvailable: resolvePopularSortAvailable(items, payload.facet_counts),
      ...(searchTimeMs !== null ? { searchTimeMs } : {}),
      ...(outOf !== null ? { outOf } : {}),
    },
  };
}

export function buildTypesenseCaricatureFilterSummary(query: TypesenseCaricatureSearchQuery): string {
  return buildTypesenseCaricatureFilterBy(query);
}

export function buildTypesenseCaricatureFilterBy(query: TypesenseCaricatureSearchQuery): string {
  const filters = ["status:=PUBLISHED", "visibility:=PUBLIC"];

  const resolvedCategoryId = uuidFrom(query.categoryId) ?? uuidFrom(query.category);
  const categoryName = query.category && !uuidFrom(query.category) ? query.category : null;

  if (resolvedCategoryId) filters.push(`category_id:=${quoteFilterValue(resolvedCategoryId)}`);
  if (categoryName) filters.push(`category_name:=${quoteFilterValue(categoryName)}`);
  if (query.language) filters.push(`language:=${quoteFilterValue(query.language)}`);
  if (query.credit) filters.push(`credit:=${quoteFilterValue(query.credit)}`);
  if (query.hasVisibleText !== null) filters.push(`has_visible_text:=${query.hasVisibleText}`);
  if (query.depictedSubject) filters.push(`depicted_subjects:=${quoteFilterValue(query.depictedSubject)}`);

  return filters.join(" && ");
}

export function buildTypesenseCaricatureSortBy(query: TypesenseCaricatureSearchQuery): string {
  if (query.sort === "oldest") return "published_at_ts:asc";
  if (query.sort === "popular") return "popularity_score:desc,published_at_ts:desc";
  if (query.sort === "relevance" && query.q !== "*") {
    return "_text_match:desc,published_at_ts:desc";
  }
  return DEFAULT_SORT_BY;
}

function mapCaricatureDocument(document: CaricatureSearchDocument): CaricatureSearchDto {
  const card = preview(document, "card");
  const detail = preview(document, "detail");

  return {
    id: stringOrNull(document.id),
    headline: stringOrNull(document.headline),
    description: stringOrNull(document.description),
    credit: stringOrNull(document.credit),
    categoryId: stringOrNull(document.category_id),
    categoryName: stringOrNull(document.category_name),
    language: stringOrNull(document.language),
    hasVisibleText: toBoolean(document.has_visible_text),
    hasTranslation: Boolean(stringOrNull(document.visible_text_translation_en)),
    keywords: stringArray(document.keywords),
    depictedSubjects: stringArray(document.depicted_subjects),
    publishedAt: isoFromUnixSeconds(document.published_at_ts),
    createdAt: isoFromUnixSeconds(document.created_at_ts),
    status: stringOrNull(document.status),
    visibility: stringOrNull(document.visibility),
    previewUrl: card?.url ?? detail?.url ?? null,
    width: card?.width ?? detail?.width ?? null,
    height: card?.height ?? detail?.height ?? null,
    previews: {
      card,
      detail,
    },
    downloadCount: toInteger(document.download_count),
    popularityScore: toFloat(document.popularity_score),
  };
}

function preview(document: CaricatureSearchDocument, variant: "card" | "detail"): CaricaturePreviewDto | null {
  const url = stringOrNull(document[`preview_${variant}_url`]);
  const width = toInteger(document[`preview_${variant}_width`]);
  const height = toInteger(document[`preview_${variant}_height`]);
  if (!url || width === null || height === null) return null;
  return { url, width, height };
}

function mapFacets(value: unknown): CaricatureSearchFacets {
  const facetCounts = Array.isArray(value) ? value.filter(isRecord) as TypesenseFacetCount[] : [];
  return {
    categories: mapCategoryFacets(facetCounts),
    languages: filterLanguageFacets(mapFacetField(facetCounts, "language")),
    credits: mapFacetField(facetCounts, "credit"),
    hasVisibleText: mapFacetField(facetCounts, "has_visible_text"),
    depictedSubjects: mapFacetField(facetCounts, "depicted_subjects"),
  };
}

export function filterLanguageFacets(
  languages: CaricatureSearchFacetItem[],
): CaricatureSearchFacetItem[] {
  return languages.filter((language) => language.value !== "NO_VISIBLE_TEXT");
}

export function mapCategoryFacets(facetCounts: TypesenseFacetCount[]): CaricatureSearchFacetItem[] {
  const idFacets = mapFacetField(facetCounts, "category_id");
  if (idFacets.length === 0) {
    return mapFacetField(facetCounts, "category_name");
  }

  const nameFacets = mapFacetField(facetCounts, "category_name");
  const usedNames = new Set<string>();

  return idFacets.map((idFacet) => {
    const matches = nameFacets.filter(
      (nameFacet) => nameFacet.count === idFacet.count && !usedNames.has(nameFacet.value),
    );
    const resolvedName = matches.length === 1
      ? matches[0].name
      : nameFacets.find((nameFacet) => nameFacet.count === idFacet.count)?.name ?? idFacet.value;

    if (matches.length === 1) usedNames.add(matches[0].value);

    return {
      ...idFacet,
      name: resolvedName,
    };
  });
}

function mapFacetField(
  facetCounts: TypesenseFacetCount[],
  fieldName: string,
): CaricatureSearchFacetItem[] {
  const field = facetCounts.find((facet) => facet.field_name === fieldName);
  const counts = Array.isArray(field?.counts) ? field.counts.filter(isRecord) : [];
  return counts
    .map((count) => ({
      value: stringOrNull(count.value) ?? "",
      count: toInteger(count.count) ?? 0,
    }))
    .filter((count) => count.value.length > 0)
    .map((count) => ({
      ...count,
      name: count.value,
      assetCount: count.count,
    }));
}

function resolvePopularSortAvailable(
  items: CaricatureSearchDto[],
  facetCounts: unknown,
): boolean {
  if (items.some((item) => (item.popularityScore ?? 0) > 0 || (item.downloadCount ?? 0) > 0)) {
    return true;
  }

  const facetList = Array.isArray(facetCounts) ? facetCounts.filter(isRecord) as TypesenseFacetCount[] : [];
  const popularityFacets = mapFacetField(facetList, "popularity_score");
  const downloadFacets = mapFacetField(facetList, "download_count");

  return popularityFacets.some((facet) => facet.count > 0)
    || downloadFacets.some((facet) => {
      const parsed = Number(facet.value);
      return Number.isFinite(parsed) && parsed > 0;
    });
}

function dropUndefined(input: Record<string, unknown>): TypesenseCaricatureDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as TypesenseCaricatureDocument;
}

function normalizeTypesenseHost(host: string): string {
  return host.trim().replace(/\/+$/, "").replace(/\/collections\/?$/, "");
}

function quoteFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  return `\`${escaped}\``;
}

function parseSort(value: string | null, q: string): TypesenseCaricatureSearchQuery["sort"] {
  const normalized = normalizeOptional(value);
  if (!normalized) return "newest";
  if (normalized === "newest" || normalized === "oldest" || normalized === "popular") return normalized;
  if (normalized === "relevance" && q !== "*") return normalized;
  throw new TypesenseSearchInputError("Sort is invalid for this request.", "invalid_sort");
}

function parseBooleanParam(value: string | null, defaultValue: boolean): boolean {
  const normalized = normalizeOptional(value);
  if (!normalized) return defaultValue;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new TypesenseSearchInputError("includeFacets must be true or false.", "invalid_include_facets");
}

function parseOptionalBoolean(value: string | null): boolean | null {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new TypesenseSearchInputError("hasVisibleText must be true or false.", "invalid_has_visible_text");
}

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 250 || parsed > 30_000) {
    return DEFAULT_SEARCH_TIMEOUT_MS;
  }
  return parsed;
}

function parseBoundedInteger(
  value: string | null,
  defaultValue: number,
  min: number,
  max: number,
  field: string,
): number {
  const normalized = normalizeOptional(value);
  if (!normalized) return defaultValue;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypesenseSearchInputError(`${field} is invalid.`, `invalid_${field}`);
  }
  return parsed;
}

function uuidFrom(value: string | null): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toUnixSeconds(value: Date | string | null): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / 1_000);
}

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function toFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function toSearchTimeMs(value: unknown): number | null {
  const parsed = toInteger(value);
  return parsed === null ? null : parsed;
}

function isoFromUnixSeconds(value: unknown): string | null {
  const seconds = toInteger(value);
  if (seconds === null) return null;
  return new Date(seconds * 1_000).toISOString();
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => stringOrNull(entry))
    .filter((entry): entry is string => entry !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
