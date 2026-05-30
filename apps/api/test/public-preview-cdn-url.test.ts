import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildEventCategoryBrowseResponse,
  buildLatestEventsResponse,
  parseEventCategoryBrowseQuery,
  parseLatestEventsQuery,
} from "../src/lib/assets/public-homepage"
import {
  buildPublicPreviewCdnUrl,
  resolvePublicStablePreviewUrl,
} from "../src/lib/media/public-preview-cdn-url"

const SAMPLE_ASSET_ID = "11111111-1111-4111-8111-111111111111"

describe("buildPublicPreviewCdnUrl", () => {
  it("builds CDN URL from derivative storage key", () => {
    const url = buildPublicPreviewCdnUrl({
      baseUrl: "https://media.fotocorp.com",
      version: "v1",
      storageKey: "previews/v1/card/abc.webp",
      assetId: SAMPLE_ASSET_ID,
      variant: "card",
    })

    assert.equal(url, "https://media.fotocorp.com/previews/v1/card/abc.webp")
  })

  it("strips duplicate slashes from base URL and storage key", () => {
    const url = buildPublicPreviewCdnUrl({
      baseUrl: "https://media.fotocorp.com/",
      storageKey: "/previews/v1/card/abc.webp",
      variant: "card",
    })

    assert.equal(url, "https://media.fotocorp.com/previews/v1/card/abc.webp")
  })

  it("returns null when base URL is missing", () => {
    const url = buildPublicPreviewCdnUrl({
      baseUrl: "",
      storageKey: "previews/v1/card/abc.webp",
      variant: "card",
    })

    assert.equal(url, null)
  })

  it("falls back to deterministic path when storage key is unavailable", () => {
    const url = buildPublicPreviewCdnUrl({
      baseUrl: "https://media.fotocorp.com",
      version: "v1",
      assetId: SAMPLE_ASSET_ID,
      variant: "detail",
    })

    assert.equal(
      url,
      `https://media.fotocorp.com/previews/v1/detail/${SAMPLE_ASSET_ID}.webp`,
    )
  })
})

describe("resolvePublicStablePreviewUrl", () => {
  it("prefers CDN URL and falls back to stable API preview path", () => {
    const cdn = { baseUrl: "https://media.fotocorp.com", version: "v1" }

    assert.equal(
      resolvePublicStablePreviewUrl(cdn, {
        storageKey: "previews/v1/card/abc.webp",
        assetId: SAMPLE_ASSET_ID,
        variant: "card",
      }),
      "https://media.fotocorp.com/previews/v1/card/abc.webp",
    )

    assert.equal(
      resolvePublicStablePreviewUrl({ baseUrl: null, version: null }, {
        storageKey: "previews/v1/card/abc.webp",
        assetId: SAMPLE_ASSET_ID,
        variant: "card",
      }),
      `/api/media/assets/${encodeURIComponent(SAMPLE_ASSET_ID)}/preview/card`,
    )
  })
})

describe("buildLatestEventsResponse", () => {
  it("returns CDN previewUrl for public event cards when configured", () => {
    const query = parseLatestEventsQuery({ windowDays: "30", limit: "15", cursor: null })
    const response = buildLatestEventsResponse(
      [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
          title: "Sample event",
          event_date: "2026-05-01T00:00:00.000Z",
          created_at: "2026-05-01T12:00:00.000Z",
          asset_count: 3,
          preview_asset_id: SAMPLE_ASSET_ID,
          preview_width: 612,
          preview_height: 408,
          preview_url: `/api/media/assets/${SAMPLE_ASSET_ID}/preview/card`,
          preview_storage_key: "previews/v1/card/abc.webp",
        },
      ],
      query,
      { baseUrl: "https://media.fotocorp.com", version: "v1" },
    )

    assert.equal(response.items[0]?.previewUrl, "https://media.fotocorp.com/previews/v1/card/abc.webp")
  })

  it("keeps stable preview path when CDN env is missing", () => {
    const query = parseLatestEventsQuery({ windowDays: "30", limit: "15", cursor: null })
    const stablePath = `/api/media/assets/${SAMPLE_ASSET_ID}/preview/card`
    const response = buildLatestEventsResponse(
      [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
          title: "Sample event",
          event_date: null,
          created_at: "2026-05-01T12:00:00.000Z",
          asset_count: 1,
          preview_asset_id: SAMPLE_ASSET_ID,
          preview_width: 612,
          preview_height: 408,
          preview_url: stablePath,
          preview_storage_key: "previews/v1/card/abc.webp",
        },
      ],
      query,
      { baseUrl: null, version: null },
    )

    assert.equal(response.items[0]?.previewUrl, stablePath)
  })

  it("builds pagination cursor from event_date", () => {
    const query = parseLatestEventsQuery({ windowDays: "30", limit: "1", cursor: null })
    const response = buildLatestEventsResponse(
      [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
          title: "Newest by event date",
          event_date: "2026-05-20T00:00:00.000Z",
          created_at: "2026-05-01T12:00:00.000Z",
          asset_count: 2,
          preview_asset_id: SAMPLE_ASSET_ID,
          preview_width: 612,
          preview_height: 408,
          preview_url: `/api/media/assets/${SAMPLE_ASSET_ID}/preview/card`,
          preview_storage_key: "previews/v1/card/newest.webp",
        },
        {
          event_id: "33333333-3333-4333-8333-333333333333",
          title: "Older by event date",
          event_date: "2026-05-10T00:00:00.000Z",
          created_at: "2026-05-25T12:00:00.000Z",
          asset_count: 1,
          preview_asset_id: SAMPLE_ASSET_ID,
          preview_width: 612,
          preview_height: 408,
          preview_url: `/api/media/assets/${SAMPLE_ASSET_ID}/preview/card`,
          preview_storage_key: "previews/v1/card/older.webp",
        },
      ],
      query,
      { baseUrl: null, version: null },
    )

    assert.equal(response.hasMore, true)
    assert.ok(response.nextCursor)

    const decoded = JSON.parse(
      Buffer.from(
        response.nextCursor.replaceAll("-", "+").replaceAll("_", "/"),
        "base64",
      ).toString("utf8"),
    ) as { eventDate?: string; createdAt?: string; id?: string }

    assert.equal(decoded.eventDate, "2026-05-20T00:00:00.000Z")
    assert.equal(decoded.createdAt, undefined)
    assert.equal(decoded.id, "22222222-2222-4222-8222-222222222222")
  })
})

describe("buildEventCategoryBrowseResponse", () => {
  it("defaults to 25, rejects latest, and omits total counts", () => {
    const query = parseEventCategoryBrowseQuery({ section: "news", limit: null, cursor: null })
    const response = buildEventCategoryBrowseResponse(
      [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
          title: "Archive news event",
          event_date: "2026-01-01T00:00:00.000Z",
          created_at: "2026-05-01T12:00:00.000Z",
          asset_count: 2,
          event_location: null,
          category_name: "News",
          preview_asset_id: SAMPLE_ASSET_ID,
          preview_width: 612,
          preview_height: 408,
          preview_url: `/api/media/assets/${SAMPLE_ASSET_ID}/preview/card`,
          preview_storage_key: "previews/v1/card/news.webp",
        },
      ],
      query,
      { baseUrl: null, version: null },
    )

    assert.equal(query.limit, 25)
    assert.equal(response.section, "news")
    assert.equal(response.limit, 25)
    assert.equal(response.items.length, 1)
    assert.equal(Object.hasOwn(response, "total"), false)
    assert.equal(Object.hasOwn(response, "totalCount"), false)
    assert.throws(
      () => parseEventCategoryBrowseQuery({ section: "latest", limit: "25", cursor: null }),
      /section must be news, sports, entertainment, or retro/,
    )
  })
})
