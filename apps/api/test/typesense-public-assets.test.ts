import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTypesensePublicAssetFilterSummary,
  buildTypesensePublicAssetSearchUrl,
  mapTypesensePublicAssetSearchResponse,
  parseTypesensePublicAssetSearchQuery,
} from "../src/lib/search/typesense-public-assets";

describe("Typesense public asset search mapping", () => {
  it("maps frontend query params into Typesense filters and sorting", () => {
    const query = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams("q=salman&page=2&limit=25&category=Sports&event=IPL&city=Mumbai&sort=oldest"),
    );

    const url = buildTypesensePublicAssetSearchUrl(
      { host: "https://search.example.test", collection: "public_assets_current" },
      query,
    );

    assert.equal(url.pathname, "/collections/public_assets_current/documents/search");
    assert.equal(url.searchParams.get("q"), "salman");
    assert.equal(url.searchParams.get("per_page"), "25");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("sort_by"), "created_at_ts:asc");
    assert.equal(url.searchParams.get("facet_by"), "category_name,event_title,source");
    assert.equal(
      buildTypesensePublicAssetFilterSummary(query),
      "status:=ACTIVE && visibility:=PUBLIC && category_name:=`Sports` && event_title:=`IPL` && event_location:=`Mumbai`",
    );
  });

  it("can build search URLs without facets for result-only calls", () => {
    const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams("includeFacets=false"));
    const url = buildTypesensePublicAssetSearchUrl(
      { host: "https://search.example.test", collection: "public_assets_current" },
      query,
    );

    assert.equal(url.searchParams.get("facet_by"), null);
  });

  it("builds search URLs from the Typesense host origin even when host includes /collections", () => {
    const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams("q=test"));
    const url = buildTypesensePublicAssetSearchUrl(
      { host: "https://search.example.test/collections/", collection: "public_assets_current" },
      query,
    );

    assert.equal(url.href, "https://search.example.test/collections/public_assets_current/documents/search?q=test&query_by=event_title%2Ccaption%2Cwho_is_in_picture%2Cpeople%2Ckeywords%2Ccategory_name%2Cfotokey&filter_by=status%3A%3DACTIVE+%26%26+visibility%3A%3DPUBLIC&sort_by=created_at_ts%3Adesc&facet_by=category_name%2Cevent_title%2Csource&per_page=50&page=1");
  });

  it("maps event and category UUID params to id filters regardless of param name", () => {
    const eventUuid = "8a17b123-1a8c-4d6c-8d21-6468dd742e21";
    const categoryUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    const eventQuery = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams(`q=salman&event=${eventUuid}`),
    );
    assert.equal(
      buildTypesensePublicAssetFilterSummary(eventQuery),
      `status:=ACTIVE && visibility:=PUBLIC && event_id:=\`${eventUuid}\``,
    );

    const eventIdQuery = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams(`eventId=${eventUuid}`),
    );
    assert.equal(
      buildTypesensePublicAssetFilterSummary(eventIdQuery),
      `status:=ACTIVE && visibility:=PUBLIC && event_id:=\`${eventUuid}\``,
    );

    const categoryQuery = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams(`category=${categoryUuid}`),
    );
    assert.equal(
      buildTypesensePublicAssetFilterSummary(categoryQuery),
      `status:=ACTIVE && visibility:=PUBLIC && category_id:=\`${categoryUuid}\``,
    );

    const namedEventQuery = parseTypesensePublicAssetSearchQuery(
      new URLSearchParams("event=IPL"),
    );
    assert.equal(
      buildTypesensePublicAssetFilterSummary(namedEventQuery),
      "status:=ACTIVE && visibility:=PUBLIC && event_title:=`IPL`",
    );
  });

  it("returns the PR-5 response contract while keeping compatibility fields", () => {
    const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams("q=*&page=2&limit=2"));
    const response = mapTypesensePublicAssetSearchResponse(
      {
        found: 5,
        search_time_ms: 17,
        hits: [
          {
            document: {
              id: "asset-1",
              fotokey: "FC010126001",
              caption: "Caption",
              event_title: "Event",
              category_name: "Sports",
              city: "Mumbai",
              created_at_ts: 1_704_067_200,
              preview_card_url: "/api/media/assets/asset-1/preview/card",
              preview_card_width: 612,
              preview_card_height: 408,
            },
          },
        ],
        facet_counts: [
          { field_name: "category_name", counts: [{ value: "Sports", count: 3 }] },
          { field_name: "event_title", counts: [{ value: "Event", count: 2 }] },
          { field_name: "event_location", counts: [{ value: "Mumbai", count: 4 }] },
          { field_name: "source", counts: [{ value: "FOTOCORP", count: 5 }] },
        ],
      },
      query,
    );

    assert.equal(response.total, 5);
    assert.equal(response.totalCount, 5);
    assert.equal(response.page, 2);
    assert.equal(response.perPage, 2);
    assert.equal(response.limit, 2);
    assert.equal(response.totalPages, 3);
    assert.deepEqual(response.timing, { backend: "typesense", tookMs: 17 });
    assert.deepEqual(response.facets.categories[0], {
      value: "Sports",
      count: 3,
      name: "Sports",
      assetCount: 3,
    });
    assert.equal(response.items[0]?.assetId, "asset-1");
    assert.equal(response.items[0]?.eventTitle, "Event");
    assert.equal(response.items[0]?.previewUrl, "/api/media/assets/asset-1/preview/card");
  });
});
