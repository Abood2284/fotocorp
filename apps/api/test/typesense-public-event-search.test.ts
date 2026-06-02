import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTypesensePublicEventSearchUrl,
  mapTypesensePublicEventSearchResponse,
  parseTypesensePublicEventSearchTimeoutMs,
} from "../src/lib/search/typesense-public-event-search";
import { parseTypesensePublicAssetSearchQuery } from "../src/lib/search/typesense-public-assets";

describe("Typesense public event search mapping", () => {
  it("builds grouped search URLs without expensive facet_by", () => {
    const query = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams("q=salman%20khan&page=2&limit=25&categoryId=a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    );

    const url = buildTypesensePublicEventSearchUrl(
      { host: "https://search.example.test", collection: "public_assets_current" },
      query,
    );

    assert.equal(url.pathname, "/collections/public_assets_current/documents/search");
    assert.equal(url.searchParams.get("q"), "salman khan");
    assert.equal(url.searchParams.get("group_by"), "event_id");
    assert.equal(url.searchParams.get("group_limit"), "1");
    assert.equal(url.searchParams.get("group_missing_values"), "false");
    assert.equal(url.searchParams.get("facet_by"), null);
    assert.equal(url.searchParams.get("max_facet_values"), null);
    assert.equal(url.searchParams.get("per_page"), "25");
    assert.equal(url.searchParams.get("page"), "2");
    assert.match(url.searchParams.get("filter_by") ?? "", /status:=ACTIVE && visibility:=PUBLIC/);
    assert.match(url.searchParams.get("filter_by") ?? "", /category_id:=/);
    assert.match(url.searchParams.get("filter_by") ?? "", /event_date_ts:>0/);
    assert.equal(url.searchParams.get("sort_by"), "event_date_ts:desc");
  });

  it("maps grouped hits into event result items with per-group found counts", () => {
    const eventId = "8a17b123-1a8c-4d6c-8d21-6468dd742e21";
    const assetId = "11111111-1111-4111-8111-111111111111";
    const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams("q=salman&page=1&limit=25"));

    const response = mapTypesensePublicEventSearchResponse(
      {
        found: 10,
        search_time_ms: 12,
        grouped_hits: [
          {
            found: 736,
            group_key: [eventId],
            hits: [
              {
                document: {
                  id: assetId,
                  event_id: eventId,
                  event_title: "Salman Khan at Filmfare",
                  event_date_ts: 1_704_067_200,
                  city: "Mumbai",
                  preview_card_url: "/api/media/assets/asset-1/preview/card",
                  preview_card_width: 612,
                  preview_card_height: 408,
                },
              },
            ],
          },
        ],
      },
      query,
    );

    assert.equal(response.foundEvents, 10);
    assert.equal(response.page, 1);
    assert.equal(response.limit, 25);
    assert.equal(response.items.length, 1);
    assert.deepEqual(response.items[0], {
      eventId,
      eventTitle: "Salman Khan at Filmfare",
      eventDate: "2024-01-01T00:00:00.000Z",
      eventLocation: "Mumbai",
      matchingAssetCount: 736,
      representativeAssetId: assetId,
      previewUrl: "/api/media/assets/asset-1/preview/card",
      previewWidth: 612,
      previewHeight: 408,
    });
  });

  it("skips grouped hits without an event id", () => {
    const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams("q=cricket"));
    const response = mapTypesensePublicEventSearchResponse(
      {
        found: 2,
        grouped_hits: [
          {
            found: 646,
            group_key: [],
            hits: [{ document: { id: "asset-null-event" } }],
          },
          {
            found: 4,
            group_key: ["11111111-1111-4111-8111-111111111111"],
            hits: [{
              document: {
                id: "22222222-2222-4222-8222-222222222222",
                event_id: "11111111-1111-4111-8111-111111111111",
                event_title: "Cricket Final",
              },
            }],
          },
        ],
      },
      query,
    );

    assert.equal(response.foundEvents, 1);
    assert.equal(response.items.length, 1);
    assert.equal(response.items[0]?.matchingAssetCount, 4);
  });

  it("sorts event results by event date for newest and oldest browsing", () => {
    const newest = parseTypesensePublicAssetSearchQuery(new URLSearchParams("sort=newest"));
    const oldest = parseTypesensePublicAssetSearchQuery(new URLSearchParams("sort=oldest"));
    const relevance = parseTypesensePublicAssetSearchQuery(new URLSearchParams("q=salman&sort=relevance"));

    assert.equal(
      buildTypesensePublicEventSearchUrl(
        { host: "https://search.example.test", collection: "public_assets_current" },
        newest,
      ).searchParams.get("sort_by"),
      "event_date_ts:desc",
    );
    assert.equal(
      buildTypesensePublicEventSearchUrl(
        { host: "https://search.example.test", collection: "public_assets_current" },
        oldest,
      ).searchParams.get("sort_by"),
      "event_date_ts:asc",
    );
    assert.equal(
      buildTypesensePublicEventSearchUrl(
        { host: "https://search.example.test", collection: "public_assets_current" },
        relevance,
      ).searchParams.get("sort_by"),
      "_text_match:desc,event_date_ts:desc",
    );
  });

  it("defaults event search timeout higher than asset search timeout", () => {
    assert.equal(parseTypesensePublicEventSearchTimeoutMs({}, 1_500), 8_000);
    assert.equal(
      parseTypesensePublicEventSearchTimeoutMs({ TYPESENSE_EVENT_SEARCH_TIMEOUT_MS: "12000" }, 1_500),
      12_000,
    );
  });
});
