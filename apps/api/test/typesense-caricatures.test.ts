import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCaricatureSearchPlaceholder,
  sanitizeCaricatureSearchableStringList,
  sanitizeCaricatureSearchableText,
} from "../src/lib/search/typesense-caricature-text";
import {
  TYPESENSE_CARICATURE_QUERY_BY,
  TYPESENSE_CARICATURE_QUERY_BY_WEIGHTS,
  buildCaricaturesCollectionSchema,
  buildEmptyTypesenseCaricatureSearchResponse,
  buildTypesenseCaricatureDocument,
  buildTypesenseCaricatureFilterSummary,
  buildTypesenseCaricatureSearchUrl,
  buildTypesenseCaricatureSortBy,
  mapTypesenseCaricatureSearchResponse,
  parseTypesenseCaricatureSearchQuery,
} from "../src/lib/search/typesense-caricatures";

describe("Typesense caricature text sanitization", () => {
  it("treats placeholder values as empty searchable text", () => {
    for (const value of ["N/A", "null", "none", "no text", "--", ""]) {
      assert.equal(isCaricatureSearchPlaceholder(value), true);
      assert.equal(sanitizeCaricatureSearchableText(value), null);
    }
  });

  it("keeps meaningful visible text and filters placeholder list entries", () => {
    assert.equal(sanitizeCaricatureSearchableText("  eating food  "), "eating food");
    assert.deepEqual(
      sanitizeCaricatureSearchableStringList(["politics", "N/A", "null", "satire"]),
      ["politics", "satire"],
    );
  });
});

describe("Typesense caricature document mapping", () => {
  it("omits null placeholder text fields from indexed documents", () => {
    const document = buildTypesenseCaricatureDocument({
      id: "caricature-1",
      headline: "Election satire",
      description: "A visual caricature without written text.",
      credit: "Artist Name",
      category_id: "category-1",
      category_name: "Politics",
      language: "NO_VISIBLE_TEXT",
      has_visible_text: false,
      visible_text: "N/A",
      visible_text_translation_en: "null",
      keywords: ["politics", "N/A"],
      depicted_subjects: ["politician", "none"],
      published_at: "2025-12-14T00:00:00.000Z",
      created_at: "2025-12-13T00:00:00.000Z",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      preview_card_url: "https://cdn.example.test/card.webp",
      preview_detail_url: null,
      preview_card_width: 612,
      preview_card_height: 408,
      preview_detail_width: null,
      preview_detail_height: null,
    });

    assert.equal(document.visible_text, undefined);
    assert.equal(document.visible_text_translation_en, undefined);
    assert.deepEqual(document.keywords, ["politics"]);
    assert.deepEqual(document.depicted_subjects, ["politician"]);
    assert.equal(document.preview_card_url, "https://cdn.example.test/card.webp");
    assert.equal(document.preview_detail_url, undefined);
  });

  it("defines the caricatures collection schema with preview display fields", () => {
    const schema = buildCaricaturesCollectionSchema("caricatures_current");
    assert.equal(schema.name, "caricatures_current");
    assert.equal(schema.default_sorting_field, "published_at_ts");
    assert.equal(
      schema.fields.some((field) => field.name === "preview_card_url" && field.index === false),
      true,
    );
  });
});

describe("Typesense caricature search mapping", () => {
  it("returns an empty search response when the collection is missing", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&page=1&limit=2"));
    const response = buildEmptyTypesenseCaricatureSearchResponse(query);
    assert.equal(response.total, 0);
    assert.equal(response.items.length, 0);
    assert.equal(response.hasMore, false);
  });

  it("maps frontend query params into Typesense filters, weights, and sorting", () => {
    const query = parseTypesenseCaricatureSearchQuery(
      new URLSearchParams(
        "q=eating+food&page=2&limit=25&category=Politics&language=MARATHI&hasVisibleText=true&sort=oldest",
      ),
    );

    const url = buildTypesenseCaricatureSearchUrl(
      { host: "https://search.example.test", collection: "caricatures_current" },
      query,
    );

    assert.equal(url.pathname, "/collections/caricatures_current/documents/search");
    assert.equal(url.searchParams.get("q"), "eating food");
    assert.equal(url.searchParams.get("query_by"), TYPESENSE_CARICATURE_QUERY_BY);
    assert.equal(url.searchParams.get("query_by_weights"), TYPESENSE_CARICATURE_QUERY_BY_WEIGHTS);
    assert.equal(url.searchParams.get("per_page"), "25");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(buildTypesenseCaricatureSortBy(query), "published_at_ts:asc");
    assert.equal(
      buildTypesenseCaricatureFilterSummary(query),
      "status:=PUBLISHED && visibility:=PUBLIC && category_name:=`Politics` && language:=`MARATHI` && has_visible_text:=true",
    );
  });

  it("maps category UUID params to category_id filters", () => {
    const categoryUuid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams(`categoryId=${categoryUuid}`));
    assert.equal(
      buildTypesenseCaricatureFilterSummary(query),
      `status:=PUBLISHED && visibility:=PUBLIC && category_id:=\`${categoryUuid}\``,
    );
  });

  it("maps Typesense hits into the caricature search response contract", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&page=1&limit=1"));
    const response = mapTypesenseCaricatureSearchResponse(
      {
        found: 1,
        search_time_ms: 12,
        hits: [
          {
            document: {
              id: "caricature-1",
              headline: "Election satire",
              description: "Description",
              credit: "Artist Name",
              category_id: "category-1",
              category_name: "Politics",
              language: "MARATHI",
              has_visible_text: true,
              keywords: ["politics"],
              depicted_subjects: ["politician"],
              published_at_ts: 1_765_670_400,
              preview_card_url: "https://cdn.example.test/card.webp",
              preview_card_width: 612,
              preview_card_height: 408,
            },
          },
        ],
        facet_counts: [
          { field_name: "category_name", counts: [{ value: "Politics", count: 1 }] },
          { field_name: "language", counts: [{ value: "MARATHI", count: 1 }] },
        ],
      },
      query,
    );

    assert.equal(response.total, 1);
    assert.equal(response.items[0]?.headline, "Election satire");
    assert.equal(response.items[0]?.previews.card?.url, "https://cdn.example.test/card.webp");
    assert.equal(response.facets.categories[0]?.value, "Politics");
    assert.equal(response.facets.languages[0]?.value, "MARATHI");
  });
});
