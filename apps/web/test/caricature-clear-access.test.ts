import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCaricatureClearPreviewUrl,
  hasActiveCaricatureEntitlement,
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
