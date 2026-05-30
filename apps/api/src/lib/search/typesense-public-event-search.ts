import type { Env } from "../../appTypes";
import {
  buildTypesensePublicAssetFilterBy,
  buildTypesenseRequestHeaders,
  parseTypesensePublicSearchConfig,
  TYPESENSE_PUBLIC_ASSET_QUERY_BY,
  TypesenseNotConfiguredError,
  TypesenseSearchFailedError,
  type TypesensePublicAssetSearchQuery,
} from "./typesense-public-assets";

const EVENT_GROUP_BY = "event_id";
const EVENT_GROUP_LIMIT = 1;
const EVENT_REQUIRED_FILTER = "event_date_ts:>0";
const DEFAULT_EVENT_SEARCH_TIMEOUT_MS = 8_000;
const MIN_EVENT_SEARCH_TIMEOUT_MS = 500;
const MAX_EVENT_SEARCH_TIMEOUT_MS = 30_000;

export interface PublicSearchEventResultItem {
  eventId: string;
  eventTitle: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  matchingAssetCount: number;
  representativeAssetId: string;
  previewUrl: string | null;
  previewWidth: number | null;
  previewHeight: number | null;
}

export interface TypesensePublicEventSearchResponse {
  query: string;
  page: number;
  limit: number;
  foundEvents: number;
  totalPages: number;
  hasMore: boolean;
  items: PublicSearchEventResultItem[];
  timing: {
    backend: "typesense";
    tookMs: number;
  };
  meta: {
    source: "typesense";
    searchTimeMs?: number;
    matchingAssets?: number;
  };
}

interface TypesenseGroupedHit {
  found?: unknown;
  group_key?: unknown;
  hits?: unknown;
}

interface TypesenseSearchHit {
  document?: unknown;
}

interface TypesenseEventSearchResponse {
  found?: unknown;
  search_time_ms?: unknown;
  grouped_hits?: unknown;
}

export function parseTypesensePublicEventSearchTimeoutMs(
  env: Env,
  assetSearchTimeoutMs: number,
): number {
  const parsed = Number(env.TYPESENSE_EVENT_SEARCH_TIMEOUT_MS);
  if (Number.isInteger(parsed) && parsed >= MIN_EVENT_SEARCH_TIMEOUT_MS && parsed <= MAX_EVENT_SEARCH_TIMEOUT_MS) {
    return parsed;
  }

  return Math.min(
    MAX_EVENT_SEARCH_TIMEOUT_MS,
    Math.max(DEFAULT_EVENT_SEARCH_TIMEOUT_MS, assetSearchTimeoutMs * 4),
  );
}

export function buildTypesensePublicEventSearchUrl(
  config: Pick<ReturnType<typeof parseTypesensePublicSearchConfig>, "host" | "collection">,
  query: TypesensePublicAssetSearchQuery,
): URL {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/search`,
    `${normalizeTypesenseHost(config.host)}/`,
  );
  const params = new URLSearchParams();
  params.set("q", query.q);
  params.set("query_by", TYPESENSE_PUBLIC_ASSET_QUERY_BY);
  params.set("filter_by", buildTypesensePublicEventFilterBy(query));
  params.set("sort_by", buildTypesensePublicEventSortBy(query));
  params.set("group_by", EVENT_GROUP_BY);
  params.set("group_limit", String(EVENT_GROUP_LIMIT));
  params.set("group_missing_values", "false");
  params.set("per_page", String(query.limit));
  params.set("page", String(query.page));
  url.search = params.toString();
  return url;
}

export async function searchTypesensePublicEvents(
  env: Env,
  query: TypesensePublicAssetSearchQuery,
): Promise<TypesensePublicEventSearchResponse> {
  const config = parseTypesensePublicSearchConfig(env);
  const timeoutMs = parseTypesensePublicEventSearchTimeoutMs(env, config.timeoutMs);
  const url = buildTypesensePublicEventSearchUrl(config, query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("typesense_event_search_timeout"), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildTypesenseRequestHeaders(config),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TypesenseSearchFailedError(
        `Typesense event search returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const payload = (await response.json()) as TypesenseEventSearchResponse;
    return mapTypesensePublicEventSearchResponse(payload, query);
  } catch (error) {
    if (error instanceof TypesenseSearchFailedError) throw error;
    const timedOut =
      error instanceof Error
        ? error.name === "AbortError"
        : controller.signal.aborted;
    throw new TypesenseSearchFailedError("Typesense event search request failed.", undefined, timedOut);
  } finally {
    clearTimeout(timeout);
  }
}

export function mapTypesensePublicEventSearchResponse(
  payload: TypesenseEventSearchResponse,
  query: TypesensePublicAssetSearchQuery,
): TypesensePublicEventSearchResponse {
  const searchTimeMs = toSearchTimeMs(payload.search_time_ms);
  const groupedHits = Array.isArray(payload.grouped_hits) ? payload.grouped_hits : [];
  const items = groupedHits
    .map((group) => mapGroupedEventHit(group))
    .filter((item): item is PublicSearchEventResultItem => item !== null);
  const foundEvents = resolveFoundEvents(payload, groupedHits.length, items.length);
  const totalPages = query.limit > 0 ? Math.ceil(foundEvents / query.limit) : 0;

  return {
    query: query.q === "*" ? "" : query.q,
    page: query.page,
    limit: query.limit,
    foundEvents,
    totalPages,
    hasMore: query.page * query.limit < foundEvents,
    items,
    timing: {
      backend: "typesense",
      tookMs: searchTimeMs ?? 0,
    },
    meta: {
      source: "typesense",
      ...(searchTimeMs !== null ? { searchTimeMs } : {}),
      ...(typeof payload.found === "number" ? { matchingAssets: payload.found } : {}),
    },
  };
}

function buildTypesensePublicEventFilterBy(query: TypesensePublicAssetSearchQuery): string {
  return `${buildTypesensePublicAssetFilterBy(query)} && ${EVENT_REQUIRED_FILTER}`;
}

function buildTypesensePublicEventSortBy(query: TypesensePublicAssetSearchQuery): string {
  if (query.sort === "oldest") return "event_date_ts:asc";
  if (query.sort === "relevance" && query.q !== "*") return "_text_match:desc,event_date_ts:desc";
  return "event_date_ts:desc";
}

function mapGroupedEventHit(group: unknown): PublicSearchEventResultItem | null {
  if (!isRecord(group)) return null;

  const grouped = group as TypesenseGroupedHit;
  const eventId = resolveGroupEventId(grouped.group_key);
  if (!eventId) return null;

  const hits = Array.isArray(grouped.hits) ? grouped.hits : [];
  const firstHit = hits.find(isRecord) as TypesenseSearchHit | undefined;
  const document = isRecord(firstHit?.document) ? firstHit.document : null;
  if (!document) return null;

  const representativeAssetId = stringOrNull(document.id) ?? stringOrNull(document.asset_id);
  if (!representativeAssetId) return null;

  const preview = resolvePreview(document);
  const groupMatchCount = toInteger(grouped.found);

  return {
    eventId,
    eventTitle: stringOrNull(document.event_title),
    eventDate: isoFromUnixSeconds(document.event_date_ts),
    eventLocation: stringOrNull(document.city) ?? stringOrNull(document.event_location),
    matchingAssetCount: groupMatchCount ?? hits.length,
    representativeAssetId,
    previewUrl: preview?.url ?? null,
    previewWidth: preview?.width ?? null,
    previewHeight: preview?.height ?? null,
  };
}

function resolveFoundEvents(payload: TypesenseEventSearchResponse, groupedCount: number, itemCount: number): number {
  const found = toInteger(payload.found);

  if (groupedCount !== itemCount) return itemCount;
  if (found !== null && found > 0) return found;
  return itemCount;
}

function resolveGroupEventId(groupKey: unknown): string | null {
  if (Array.isArray(groupKey)) {
    return stringOrNull(groupKey[0]);
  }
  return stringOrNull(groupKey);
}

function resolvePreview(document: Record<string, unknown>): { url: string; width: number; height: number } | null {
  for (const variant of ["card", "thumb", "detail"] as const) {
    const url = stringOrNull(document[`preview_${variant}_url`]);
    const width = toInteger(document[`preview_${variant}_width`]);
    const height = toInteger(document[`preview_${variant}_height`]);
    if (url && width !== null && height !== null) {
      return { url, width, height };
    }
  }
  return null;
}

function normalizeTypesenseHost(host: string): string {
  return host.trim().replace(/\/+$/, "").replace(/\/collections\/?$/, "");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { TypesenseNotConfiguredError, TypesenseSearchFailedError };
