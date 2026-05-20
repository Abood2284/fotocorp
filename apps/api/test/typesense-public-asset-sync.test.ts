import assert from "node:assert/strict"
import { describe, it, mock } from "node:test"
import type { Env } from "../src/appTypes"
import {
  buildTypesenseDeleteByEventFilter,
  buildTypesenseDeleteDocumentsByEventUrl,
  buildTypesensePublicAssetDocument,
  parseTypesenseSyncConfig,
  syncTypesensePublicAsset,
  syncTypesensePublicAssetsForEvent,
  type TypesensePublicAssetRow,
} from "../src/lib/search/typesense-public-asset-sync"

const eventUuid = "8a17b123-1a8c-4d6c-8d21-6468dd742e21"

function eligibleRow(overrides: Partial<TypesensePublicAssetRow> = {}): TypesensePublicAssetRow {
  return {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    fotokey: "FC23041075",
    who_is_in_picture: "Salman Khan",
    headline: "Headline",
    caption: "Caption text",
    description: null,
    search_text: "search",
    keywords: ["sports"],
    event_keywords: ["cricket"],
    image_date: "2023-04-10T00:00:00.000Z",
    created_at: "2023-04-10T12:00:00.000Z",
    updated_at: "2023-04-11T12:00:00.000Z",
    status: "ACTIVE",
    visibility: "PUBLIC",
    source: "LEGACY_IMPORT",
    media_type: "IMAGE",
    event_id: eventUuid,
    event_title: "IPL Final",
    event_date: "2023-04-10T00:00:00.000Z",
    event_location: "Mumbai",
    category_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567891",
    category_name: "Sports",
    contributor_id: null,
    contributor_display_name: null,
    thumb_storage_key: "previews/watermarked/thumb/a.webp",
    thumb_width: 120,
    thumb_height: 80,
    card_storage_key: "previews/watermarked/card/a.webp",
    card_width: 480,
    card_height: 320,
    detail_storage_key: "previews/watermarked/detail/a.webp",
    detail_width: 1200,
    detail_height: 800,
    ...overrides,
  }
}

describe("Typesense public asset sync", () => {
  it("builds an upsert document with indexed search fields", () => {
    const document = buildTypesensePublicAssetDocument(eligibleRow())

    assert.equal(document.id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    assert.equal(document.event_id, eventUuid)
    assert.equal(document.event_title, "IPL Final")
    assert.deepEqual(document.keywords, ["sports"])
    assert.deepEqual(document.people, ["Salman Khan"])
    assert.equal(document.preview_card_url, "/api/media/assets/a1b2c3d4-e5f6-7890-abcd-ef1234567890/preview/card")
  })

  it("returns null Typesense config when env is incomplete", () => {
    const config = parseTypesenseSyncConfig({} as Env)
    assert.equal(config, null)
  })

  it("builds delete-by-event filter and URL with quoted UUID", () => {
    assert.equal(
      buildTypesenseDeleteByEventFilter(eventUuid),
      `event_id:=\`${eventUuid}\``,
    )

    const url = buildTypesenseDeleteDocumentsByEventUrl(
      { host: "https://search.example.test", collection: "public_assets_current" },
      eventUuid,
    )
    assert.equal(url.pathname, "/collections/public_assets_current/documents")
    assert.equal(url.searchParams.get("filter_by"), `event_id:=\`${eventUuid}\``)
  })

  it("upserts eligible assets and deletes ineligible assets by id", async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn(async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      return new Response("", { status: 200 })
    }) as typeof fetch

    const db = {
      callCount: 0,
      async execute() {
        this.callCount += 1
        if (this.callCount === 1) return [eligibleRow()]
        return []
      },
    }

    const env = {
      TYPESENSE_HOST: "https://search.example.test",
      TYPESENSE_API_KEY: "test-key",
      TYPESENSE_COLLECTION_ALIAS: "public_assets_current",
    } as Env

    try {
      const upsertResult = await syncTypesensePublicAsset(db as never, env, eligibleRow().id)
      assert.equal(upsertResult.action, "upserted")
      assert.equal(requests.length, 1)
      assert.match(requests[0]!.url, /documents\/import/)
      assert.match(requests[0]!.body ?? "", /"event_title":"IPL Final"/)

      requests.length = 0
      const deleteDb = {
        async execute() {
          return []
        },
      }
      const deleteResult = await syncTypesensePublicAsset(deleteDb as never, env, "missing-asset-id")
      assert.equal(deleteResult.action, "deleted")
      assert.match(requests[0]!.url, /documents\/missing-asset-id/)
      assert.equal(requests[0]!.method, "DELETE")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("syncs all eligible event assets in batches and deletes stale ids", async () => {
    const requests: Array<{ url: string; method: string }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn(async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? "GET" })
      return new Response("", { status: 200 })
    }) as typeof fetch

    const rows = [eligibleRow(), eligibleRow({ id: "b2b2c3d4-e5f6-7890-abcd-ef1234567890" })]
    const db = {
      callCount: 0,
      async execute() {
        this.callCount += 1
        if (this.callCount === 1) return rows
        if (this.callCount === 2) {
          return [
            { id: rows[0]!.id },
            { id: rows[1]!.id },
            { id: "c3b2c3d4-e5f6-7890-abcd-ef1234567890" },
          ]
        }
        return []
      },
    }

    const env = {
      TYPESENSE_HOST: "https://search.example.test",
      TYPESENSE_API_KEY: "test-key",
      TYPESENSE_COLLECTION_ALIAS: "public_assets_current",
    } as Env

    try {
      const result = await syncTypesensePublicAssetsForEvent(db as never, env, eventUuid)
      assert.equal(result.action, "synced")
      assert.equal(result.upsertedCount, 2)
      assert.equal(result.deletedCount, 1)
      assert.equal(requests.filter((request) => request.url.includes("/import")).length, 1)
      assert.equal(requests.filter((request) => request.method === "DELETE").length, 1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("no-ops when Typesense env is missing", async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = mock.fn(async () => {
      fetchCalled = true
      return new Response("", { status: 200 })
    }) as typeof fetch

    const db = { async execute() { return [eligibleRow()] } }

    try {
      const result = await syncTypesensePublicAsset(db as never, {} as Env, eligibleRow().id)
      assert.equal(result.action, "skipped")
      assert.equal(fetchCalled, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
