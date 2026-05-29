import type { Env } from "../../appTypes";

interface PublicAssetCacheInvalidationInput {
  assetId: string;
  eventId?: string | null;
  includeEventFeeds?: boolean;
}

const EVENT_FEED_PATHS = [
  "/api/public/events/latest",
  "/api/v1/public/events/latest",
];

export async function invalidatePublicAssetCache(
  env: Env,
  input: PublicAssetCacheInvalidationInput,
) {
  const relativePaths = buildPublicAssetInvalidationPaths(input);
  const origin = normalizeOrigin(env.PUBLIC_WEB_ORIGIN);
  const zoneId = env.CLOUDFLARE_CACHE_PURGE_ZONE_ID?.trim();
  const token = env.CLOUDFLARE_CACHE_PURGE_API_TOKEN?.trim();

  if (!origin || !zoneId || !token) {
    console.info(JSON.stringify({
      event: "public_cache_invalidation_skipped",
      reason: "cloudflare_purge_not_configured",
      assetId: input.assetId,
      eventId: input.eventId ?? null,
      paths: relativePaths,
      todo: "Configure PUBLIC_WEB_ORIGIN, CLOUDFLARE_CACHE_PURGE_ZONE_ID, and CLOUDFLARE_CACHE_PURGE_API_TOKEN to enable targeted public cache purge.",
    }));
    return;
  }

  const files = relativePaths.map((path) => `${origin}${path}`);
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(JSON.stringify({
      event: "public_cache_invalidation_failed",
      status: response.status,
      assetId: input.assetId,
      eventId: input.eventId ?? null,
      fileCount: files.length,
      body: body.slice(0, 500),
    }));
    return;
  }

  console.info(JSON.stringify({
    event: "public_cache_invalidation_purged",
    assetId: input.assetId,
    eventId: input.eventId ?? null,
    fileCount: files.length,
  }));
}

function buildPublicAssetInvalidationPaths(input: PublicAssetCacheInvalidationInput) {
  const paths = [
    `/assets/${input.assetId}`,
    `/api/public/assets/${input.assetId}`,
    `/api/v1/assets/${input.assetId}`,
  ];

  if (input.includeEventFeeds) {
    paths.push(...EVENT_FEED_PATHS);
    if (input.eventId) {
      paths.push(`/search?eventId=${input.eventId}`);
    }
  }

  return paths;
}

function normalizeOrigin(value: string | undefined) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}
