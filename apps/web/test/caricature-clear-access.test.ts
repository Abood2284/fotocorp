import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCaricatureClearPreviewUrl,
  canShowCaricatureClearPreview,
  hasActiveCaricatureEntitlement,
  parseCaricatureClearAccessPayload,
  type CaricatureEntitlementLike,
} from "../src/lib/caricatures/caricature-clear-access-shared"

function entitlement(overrides: Partial<CaricatureEntitlementLike>): CaricatureEntitlementLike {
  return {
    assetType: "CARICATURE",
    status: "ACTIVE",
    validFrom: null,
    validUntil: null,
    ...overrides,
  }
}

test("hasActiveCaricatureEntitlement accepts active caricature rows", () => {
  assert.equal(hasActiveCaricatureEntitlement([entitlement({})]), true)
})

test("hasActiveCaricatureEntitlement rejects draft and non-caricature rows", () => {
  assert.equal(hasActiveCaricatureEntitlement([entitlement({ status: "DRAFT" })]), false)
  assert.equal(hasActiveCaricatureEntitlement([entitlement({ assetType: "EDITORIAL" })]), false)
})

test("hasActiveCaricatureEntitlement rejects expired validity windows", () => {
  const now = new Date("2026-07-30T12:00:00.000Z")
  assert.equal(
    hasActiveCaricatureEntitlement(
      [entitlement({ validUntil: new Date("2026-07-01T00:00:00.000Z") })],
      now,
    ),
    false,
  )
})

test("buildCaricatureClearPreviewUrl encodes asset id", () => {
  assert.equal(
    buildCaricatureClearPreviewUrl("11111111-1111-4111-8111-111111111111"),
    "/api/media/caricatures/11111111-1111-4111-8111-111111111111/clear-preview",
  )
})

test("canShowCaricatureClearPreview is global for entitled users and per-asset for owners", () => {
  const ownedId = "11111111-1111-4111-8111-111111111111"
  const otherId = "22222222-2222-4222-8222-222222222222"

  assert.equal(
    canShowCaricatureClearPreview(
      { hasClearAccess: true, ownedAssetIds: [], isContributor: false },
      otherId,
    ),
    true,
  )
  assert.equal(
    canShowCaricatureClearPreview(
      { hasClearAccess: false, ownedAssetIds: [ownedId], isContributor: false },
      ownedId,
    ),
    true,
  )
  assert.equal(
    canShowCaricatureClearPreview(
      { hasClearAccess: false, ownedAssetIds: [ownedId], isContributor: false },
      otherId,
    ),
    false,
  )
  assert.equal(
    canShowCaricatureClearPreview(
      { hasClearAccess: false, ownedAssetIds: [], isContributor: true },
      otherId,
    ),
    true,
  )
})

test("parseCaricatureClearAccessPayload reads owned ids without granting global access", () => {
  const parsed = parseCaricatureClearAccessPayload({
    hasClearAccess: false,
    ownedAssetIds: ["11111111-1111-4111-8111-111111111111", 12, ""],
    isContributor: true,
  })
  assert.deepEqual(parsed, {
    hasClearAccess: false,
    ownedAssetIds: ["11111111-1111-4111-8111-111111111111"],
    isContributor: true,
  })
})
