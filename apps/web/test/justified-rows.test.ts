import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  computeJustifiedRows,
  getPreviewAspectRatio,
  getRowContentWidth,
  type JustifiedLayoutItem,
} from "../src/lib/layout/justified-rows"

const BASE_OPTIONS = {
  gap: 8,
  targetRowHeight: 200,
  minRowHeight: 120,
  maxRowHeight: 320,
  justifyLastRow: true,
}

function item(id: string, aspectRatio: number): JustifiedLayoutItem {
  return { id, aspectRatio }
}

describe("getPreviewAspectRatio", () => {
  it("returns width divided by height when both are positive", () => {
    assert.equal(getPreviewAspectRatio(1600, 900), 1600 / 900)
  })

  it("falls back to 4/3 when dimensions are missing", () => {
    assert.equal(getPreviewAspectRatio(null, 900), 4 / 3)
    assert.equal(getPreviewAspectRatio(100, 0), 4 / 3)
  })
})

describe("computeJustifiedRows", () => {
  it("returns no rows when container width is zero", () => {
    assert.deepEqual(
      computeJustifiedRows([item("a", 1)], 0, BASE_OPTIONS),
      [],
    )
  })

  it("keeps a single leftover item at natural width on the last row", () => {
    const rows = computeJustifiedRows([item("a", 1.5)], 900, BASE_OPTIONS)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].items.length, 1)
    assert.equal(rows[0].justified, false)
    assert.equal(rows[0].items[0].width, 300)
    assert.equal(rows[0].items[0].height, BASE_OPTIONS.targetRowHeight)
    assert.ok(getRowContentWidth(rows[0], BASE_OPTIONS.gap) < 900)
  })

  it("gives every tile in a row the same height", () => {
    const rows = computeJustifiedRows(
      [item("p", 0.67), item("l", 1.5), item("s", 1)],
      1200,
      BASE_OPTIONS,
    )
    assert.ok(rows.length >= 1)
    for (const row of rows) {
      const heights = row.items.map((tile) => tile.height)
      assert.ok(heights.every((height) => height === row.height))
    }
  })

  it("fills every row edge-to-edge with no trailing gap", () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      item(`i${index}`, index % 3 === 0 ? 1.5 : 0.65),
    )
    const containerWidth = 1280
    const rows = computeJustifiedRows(items, containerWidth, BASE_OPTIONS)

    for (const row of rows) {
      if (row.justified) {
        assert.equal(getRowContentWidth(row, BASE_OPTIONS.gap), containerWidth)
      }
    }
  })

  it("fills row width for mixed portrait and landscape tiles", () => {
    const rows = computeJustifiedRows(
      [
        item("p1", 0.67),
        item("p2", 0.75),
        item("l1", 1.6),
        item("p3", 0.8),
        item("l2", 1.5),
        item("p4", 0.7),
        item("l5", 0.8),
      ],
      1000,
      BASE_OPTIONS,
    )
    const fullRow = rows.find((row) => row.justified)
    assert.ok(fullRow)
    const totalWidth = fullRow.items.reduce((sum, tile) => sum + tile.width, 0)
    const gaps = (fullRow.items.length - 1) * BASE_OPTIONS.gap
    assert.ok(Math.abs(totalWidth + gaps - 1000) < 1)
  })

  it("justifies the last row to container width when justifyLastRow is true and it fills the row", () => {
    const rows = computeJustifiedRows(
      [
        item("a", 1.5),
        item("b", 1.5),
        item("c", 1.5),
        item("d", 1.5),
        item("e", 1.5),
      ],
      800,
      { ...BASE_OPTIONS, justifyLastRow: true, targetRowHeight: 120 },
    )
    const lastRow = rows[rows.length - 1]
    assert.equal(lastRow.justified, true)
    const totalWidth = lastRow.items.reduce((sum, tile) => sum + tile.width, 0)
    const gaps = (lastRow.items.length - 1) * BASE_OPTIONS.gap
    assert.ok(Math.abs(totalWidth + gaps - 800) < 1)
  })

  it("does not stretch leftover items on a partial last row", () => {
    const rows = computeJustifiedRows(
      [item("a", 1), item("b", 1.2)],
      1200,
      { ...BASE_OPTIONS, justifyLastRow: false },
    )
    const lastRow = rows[rows.length - 1]
    assert.equal(lastRow.height, BASE_OPTIONS.targetRowHeight)
    assert.equal(lastRow.justified, false)
    assert.ok(getRowContentWidth(lastRow, BASE_OPTIONS.gap) < 1200)
  })

  it("creates additional rows on a narrow container", () => {
    const rows = computeJustifiedRows(
      [item("a", 1.5), item("b", 1.5), item("c", 1.5), item("d", 1.5)],
      320,
      BASE_OPTIONS,
    )
    assert.ok(rows.length > 1)
  })

  it("splits rows when tiles would be narrower than minTileWidth", () => {
    const items = Array.from({ length: 12 }, (_, index) => item(`i${index}`, 0.55))
    const minTileWidth = 150
    const rows = computeJustifiedRows(items, 1200, {
      ...BASE_OPTIONS,
      minTileWidth,
    })

    assert.ok(rows.length > 1)
    for (const row of rows) {
      if (!row.justified) continue
      const narrowestWidth = Math.min(...row.items.map((tile) => tile.width))
      assert.ok(narrowestWidth >= minTileWidth - 1)
    }
  })
})
