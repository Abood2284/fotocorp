// apps/api/src/lib/search/typesense-public-assets.ts
//  Builds Typesense URL (query_by, filter_by, facet_by) and search request.
//  Maps Typesense response to PublicAssetDto.
//  Maps Typesense facets to PublicAssetSearchResponse facets.
//  Maps Typesense search time to PublicAssetSearchResponse timing.
//  Maps Typesense search meta to PublicAssetSearchResponse meta.
//  Maps Typesense search hits to PublicAssetSearchResponse items.
//  Maps Typesense search total to PublicAssetSearchResponse total.
//  Maps Typesense search page to PublicAssetSearchResponse page.
//  Maps Typesense search perPage to PublicAssetSearchResponse perPage.
import type { Env } from "../../appTypes";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_SEARCH_TIMEOUT_MS = 2_500;
const QUERY_BY = "event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey";
// Live alias may predate the `city` facet field; use fields present on public_assets_current.
const FACET_BY = "category_name,event_title,source";
const DEFAULT_SORT_BY = "created_at_ts:desc";

export interface TypesensePublicAssetSearchQuery {
  q: string;
  category: string | null;
  event: string | null;
  city: string | null;
  eventId: string | null;
  categoryId: string | null;
  person: string | null;
  keyword: string | null;
  year: number | null;
  month: number | null;
  limit: number;
  page: number;
  sort: "newest" | "oldest" | "relevance";
}

interface TypesensePublicSearchConfig {
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

type PublicAssetSearchDocument = Record<string, unknown>;

interface PreviewDto {
  url: string;
  width: number;
  height: number;
}

interface PublicAssetDto {
  id: string | null;
  assetId: string | null;
  fotokey: string | null;
  headline: string | null;
  caption: string | null;
  whoIsInPicture: string | null;
  eventTitle: string | null;
  categoryName: string | null;
  city: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  keywords: string | null;
  imageDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: string | null;
  visibility: string | null;
  mediaType: string | null;
  source: string | null;
  category: { id: string | null; name: string | null } | null;
  event: { id: string | null; name: string | null; eventDate: string | null; location: string | null } | null;
  contributor: { id: string | null; displayName: string | null } | null;
  previews: {
    thumb: PreviewDto | null;
    card: PreviewDto | null;
    detail?: PreviewDto | null;
  };
}

export interface TypesensePublicAssetSearchResponse {
  items: PublicAssetDto[];
  total: number;
  totalCount: number;
  page: number;
  perPage: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  facets: {
    categories: Array<{ value: string; count: number; name: string; assetCount: number }>;
    events: Array<{ value: string; count: number; name: string; assetCount: number }>;
    cities: Array<{ value: string; count: number; name: string; assetCount: number }>;
    sources: Array<{ value: string; count: number; name: string; assetCount: number }>;
    people: Array<{ value: string; count: number; name: string; assetCount: number }>;
    keywords: Array<{ value: string; count: number; name: string; assetCount: number }>;
  };
  timing: {
    backend: "typesense";
    tookMs: number;
  };
  meta: {
    source: "typesense";
    searchTimeMs?: number;
    outOf?: number;
  };
}

export class TypesenseNotConfiguredError extends Error {
  constructor(message = "Typesense public search is not configured.") {
    super(message);
    this.name = "TypesenseNotConfiguredError";
  }
}

export class TypesenseSearchFailedError extends Error {
  constructor(
    message = "Typesense public search failed.",
    public readonly statusCode?: number,
    public readonly timedOut = false,
  ) {
    super(message);
    this.name = "TypesenseSearchFailedError";
  }
}

export class TypesenseSearchInputError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TypesenseSearchInputError";
  }
}

export function parseTypesensePublicAssetSearchQuery(
  searchParams: URLSearchParams,
): TypesensePublicAssetSearchQuery {
  const q = normalizeOptional(searchParams.get("q")) ?? "*";
  const limit = parseBoundedInteger(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT, "limit");
  const page = parseBoundedInteger(searchParams.get("page"), DEFAULT_PAGE, 1, 10_000, "page");
  const sort = parseSort(searchParams.get("sort"), q);

  return {
    q,
    category: normalizeOptional(searchParams.get("category")),
    event: normalizeOptional(searchParams.get("event")),
    city: normalizeOptional(searchParams.get("city")),
    eventId: normalizeOptional(searchParams.get("eventId")),
    categoryId: normalizeOptional(searchParams.get("categoryId")),
    person: normalizeOptional(searchParams.get("person")),
    keyword: normalizeOptional(searchParams.get("keyword")),
    year: parseYear(searchParams.get("year")),
    month: parseMonth(searchParams.get("month")),
    limit,
    page,
    sort,
  };
}

export function parseTypesensePublicSearchConfig(env: Env): TypesensePublicSearchConfig {
  const host = normalizeOptional(env.TYPESENSE_HOST ?? null);
  const apiKey = normalizeOptional(env.TYPESENSE_API_KEY ?? null);
  const collection = normalizeOptional(env.TYPESENSE_COLLECTION_ALIAS ?? null);
  const accessClientId = normalizeOptional(env.TYPESENSE_CF_ACCESS_CLIENT_ID ?? null);
  const accessClientSecret = normalizeOptional(env.TYPESENSE_CF_ACCESS_CLIENT_SECRET ?? null);

  if (!host || !apiKey || !collection) {
    throw new TypesenseNotConfiguredError();
  }

  if ((accessClientId && !accessClientSecret) || (!accessClientId && accessClientSecret)) {
    throw new TypesenseNotConfiguredError("Typesense Cloudflare Access service token config is incomplete.");
  }

  const timeoutMs = parseTimeout(env.TYPESENSE_SEARCH_TIMEOUT_MS);

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

export function buildTypesenseRequestHeaders(config: Pick<TypesensePublicSearchConfig, "apiKey" | "cloudflareAccess">): Record<string, string> {
  return {
    Accept: "application/json",
    "X-TYPESENSE-API-KEY": config.apiKey,
    ...(config.cloudflareAccess
      ? {
          "CF-Access-Client-Id": config.cloudflareAccess.clientId,
          "CF-Access-Client-Secret": config.cloudflareAccess.clientSecret,
        }
      : {}),
  };
}

export function buildTypesensePublicAssetSearchUrl(
  config: Pick<TypesensePublicSearchConfig, "host" | "collection">,
  query: TypesensePublicAssetSearchQuery,
): URL {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/search`,
    `${normalizeTypesenseHost(config.host)}/`,
  );
  const params = new URLSearchParams();
  params.set("q", query.q);
  params.set("query_by", QUERY_BY);
  params.set("filter_by", buildFilterBy(query));
  params.set("sort_by", buildSortBy(query));
  params.set("facet_by", FACET_BY);
  params.set("per_page", String(query.limit));
  params.set("page", String(query.page));
  url.search = params.toString();
  return url;
}

export async function searchTypesensePublicAssets(
  env: Env,
  query: TypesensePublicAssetSearchQuery,
): Promise<TypesensePublicAssetSearchResponse> {
  const config = parseTypesensePublicSearchConfig(env);
  const url = buildTypesensePublicAssetSearchUrl(config, query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("typesense_search_timeout"), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildTypesenseRequestHeaders(config),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TypesenseSearchFailedError(
        `Typesense search returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const payload = (await response.json()) as TypesenseSearchResponse;
    return mapTypesensePublicAssetSearchResponse(payload, query);
  } catch (error) {
    if (error instanceof TypesenseSearchFailedError) throw error;
    const timedOut =
      error instanceof Error
        ? error.name === "AbortError"
        : controller.signal.aborted;
    throw new TypesenseSearchFailedError("Typesense search request failed.", undefined, timedOut);
  } finally {
    clearTimeout(timeout);
  }
}

export function mapTypesensePublicAssetSearchResponse(
  payload: TypesenseSearchResponse,
  query: TypesensePublicAssetSearchQuery,
): TypesensePublicAssetSearchResponse {
  const totalCount = toInteger(payload.found) ?? 0;
  const outOf = toInteger(payload.out_of);
  const searchTimeMs = toSearchTimeMs(payload.search_time_ms);
  const totalPages = query.limit > 0 ? Math.ceil(totalCount / query.limit) : 0;
  const hits = Array.isArray(payload.hits) ? payload.hits : [];
  const items = hits
    .map((hit): unknown => (isRecord(hit) ? (hit as TypesenseSearchHit).document : null))
    .filter(isRecord)
    .map((document) => mapPublicAssetDocument(document));

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
      ...(searchTimeMs !== null ? { searchTimeMs } : {}),
      ...(outOf !== null ? { outOf } : {}),
    },
  };
}

export function isTypesenseNotConfiguredError(error: unknown): error is TypesenseNotConfiguredError {
  return error instanceof TypesenseNotConfiguredError;
}

export function isTypesenseSearchFailedError(error: unknown): error is TypesenseSearchFailedError {
  return error instanceof TypesenseSearchFailedError;
}

export function isTypesenseSearchInputError(error: unknown): error is TypesenseSearchInputError {
  return error instanceof TypesenseSearchInputError;
}

export function buildTypesensePublicAssetFilterSummary(query: TypesensePublicAssetSearchQuery): string {
  return buildFilterBy(query);
}

function buildFilterBy(query: TypesensePublicAssetSearchQuery): string {
  const filters = ["status:=ACTIVE", "visibility:=PUBLIC"];

  const resolvedEventId = uuidFrom(query.eventId) ?? uuidFrom(query.event);
  const resolvedCategoryId = uuidFrom(query.categoryId) ?? uuidFrom(query.category);
  const eventTitle = query.event && !uuidFrom(query.event) ? query.event : null;
  const categoryName = query.category && !uuidFrom(query.category) ? query.category : null;

  if (resolvedEventId) filters.push(`event_id:=${quoteFilterValue(resolvedEventId)}`);
  if (resolvedCategoryId) filters.push(`category_id:=${quoteFilterValue(resolvedCategoryId)}`);
  if (categoryName) filters.push(`category_name:=${quoteFilterValue(categoryName)}`);
  if (eventTitle) filters.push(`event_title:=${quoteFilterValue(eventTitle)}`);
  if (query.city) filters.push(`event_location:=${quoteFilterValue(query.city)}`);
  if (query.person) filters.push(`people:=${quoteFilterValue(query.person)}`);
  if (query.keyword) filters.push(`keywords:=${quoteFilterValue(query.keyword)}`);

  const dateRange = buildImageDateRange(query.year, query.month);
  if (dateRange) {
    filters.push(`image_date_ts:>=${dateRange.start}`);
    filters.push(`image_date_ts:<${dateRange.end}`);
  }

  return filters.join(" && ");
}

function buildSortBy(query: TypesensePublicAssetSearchQuery): string {
  if (query.sort === "oldest") return "created_at_ts:asc";
  if (query.sort === "relevance" && query.q !== "*") {
    return "_text_match:desc,created_at_ts:desc";
  }
  return DEFAULT_SORT_BY;
}

function buildImageDateRange(year: number | null, month: number | null): { start: number; end: number } | null {
  if (!year && !month) return null;
  if (!year && month) {
    throw new TypesenseSearchInputError("Month filter requires a year.", "month_requires_year");
  }

  const y = year as number;
  const startMonth = month ? month - 1 : 0;
  const endYear = month === 12 ? y + 1 : y;
  const endMonth = month ? (month === 12 ? 0 : month) : 0;
  const start = Date.UTC(y, startMonth, 1, 0, 0, 0);
  const end = month
    ? Date.UTC(endYear, endMonth, 1, 0, 0, 0)
    : Date.UTC(y + 1, 0, 1, 0, 0, 0);

  return {
    start: Math.floor(start / 1_000),
    end: Math.floor(end / 1_000),
  };
}

function mapPublicAssetDocument(document: PublicAssetSearchDocument): PublicAssetDto {
  const thumb = preview(document, "thumb");
  const card = preview(document, "card");
  const detail = preview(document, "detail");
  const id = stringOrNull(document.id) ?? stringOrNull(document.asset_id);
  const eventTitle = stringOrNull(document.event_title);
  const categoryName = stringOrNull(document.category_name);
  const city = stringOrNull(document.city) ?? stringOrNull(document.event_location);

  return {
    id,
    assetId: id,
    fotokey: stringOrNull(document.fotokey),
    headline: stringOrNull(document.headline),
    caption: stringOrNull(document.caption),
    whoIsInPicture: stringOrNull(document.who_is_in_picture),
    eventTitle,
    categoryName,
    city,
    previewUrl: card?.url ?? thumb?.url ?? detail?.url ?? null,
    width: card?.width ?? thumb?.width ?? detail?.width ?? null,
    height: card?.height ?? thumb?.height ?? detail?.height ?? null,
    keywords: joinKeywords(document.keywords),
    imageDate: isoFromUnixSeconds(document.image_date_ts),
    createdAt: isoFromUnixSeconds(document.created_at_ts),
    updatedAt: isoFromUnixSeconds(document.updated_at_ts),
    status: stringOrNull(document.status),
    visibility: stringOrNull(document.visibility),
    mediaType: stringOrNull(document.media_type),
    source: stringOrNull(document.source),
    category: stringOrNull(document.category_id) || stringOrNull(document.category_name)
      ? {
          id: stringOrNull(document.category_id),
          name: stringOrNull(document.category_name),
        }
      : null,
    event: stringOrNull(document.event_id) || stringOrNull(document.event_title)
      ? {
          id: stringOrNull(document.event_id),
          name: eventTitle,
          eventDate: isoFromUnixSeconds(document.event_date_ts),
          location: city,
        }
      : null,
    contributor: stringOrNull(document.contributor_id) || stringOrNull(document.contributor_display_name)
      ? {
          id: stringOrNull(document.contributor_id),
          displayName: stringOrNull(document.contributor_display_name),
        }
      : null,
    previews: {
      thumb,
      card,
      ...(detail ? { detail } : {}),
    },
  };
}

function preview(document: PublicAssetSearchDocument, variant: "thumb" | "card" | "detail"): PreviewDto | null {
  const url = stringOrNull(document[`preview_${variant}_url`]);
  const width = toInteger(document[`preview_${variant}_width`]);
  const height = toInteger(document[`preview_${variant}_height`]);
  if (!url || width === null || height === null) return null;
  return { url, width, height };
}

function mapFacets(value: unknown): TypesensePublicAssetSearchResponse["facets"] {
  const facetCounts = Array.isArray(value) ? value.filter(isRecord) : [];
  return {
    categories: mapFacetField(facetCounts, "category_name"),
    events: mapFacetField(facetCounts, "event_title"),
    cities: mapFacetField(facetCounts, "event_location"),
    sources: mapFacetField(facetCounts, "source"),
    people: [],
    keywords: [],
  };
}

function mapFacetField(
  facetCounts: TypesenseFacetCount[],
  fieldName: string,
): Array<{ value: string; count: number; name: string; assetCount: number }> {
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

function normalizeTypesenseHost(host: string): string {
  return host.trim().replace(/\/+$/, "").replace(/\/collections\/?$/, "");
}

function quoteFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  return `\`${escaped}\``;
}

function parseSort(value: string | null, q: string): TypesensePublicAssetSearchQuery["sort"] {
  const normalized = normalizeOptional(value);
  if (!normalized) return "newest";
  if (normalized === "newest" || normalized === "oldest") return normalized;
  if (normalized === "relevance" && q !== "*") return normalized;
  throw new TypesenseSearchInputError("Sort is invalid for this request.", "invalid_sort");
}

function parseYear(value: string | null): number | null {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw new TypesenseSearchInputError("Year filter is invalid.", "invalid_year");
  }
  return parsed;
}

function parseMonth(value: string | null): number | null {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new TypesenseSearchInputError("Month filter is invalid.", "invalid_month");
  }
  return parsed;
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
  name: string,
): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypesenseSearchInputError(
      `${name} must be an integer between ${min} and ${max}.`,
      `invalid_${name}`,
    );
  }
  return parsed;
}

function joinKeywords(value: unknown): string | null {
  const keywords = stringArray(value);
  if (keywords.length > 0) return keywords.join(", ");
  return stringOrNull(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => stringOrNull(item))
      .filter((item): item is string => Boolean(item));
  }
  const scalar = stringOrNull(value);
  return scalar ? [scalar] : [];
}

function isoFromUnixSeconds(value: unknown): string | null {
  const seconds = toInteger(value);
  if (seconds === null) return null;
  const date = new Date(seconds * 1_000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toSearchTimeMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptional(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function uuidFrom(value: string | null): string | null {
  if (!value || !isUuid(value)) return null;
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
