export interface JustifiedLayoutItem {
  id: string
  aspectRatio: number
}

export interface JustifiedRowsOptions {
  gap: number
  targetRowHeight: number
  minRowHeight: number
  maxRowHeight: number
  justifyLastRow?: boolean
  /** End the row early when the narrowest tile would be narrower than this (px). */
  minTileWidth?: number
}

export interface JustifiedLayoutTile {
  id: string
  width: number
  height: number
}

export interface JustifiedLayoutRow {
  key: string
  height: number
  items: JustifiedLayoutTile[]
}

const DEFAULT_ASPECT_RATIO = 4 / 3
const DEFAULT_MIN_TILE_WIDTH = 150

export function getPreviewAspectRatio(width?: number | null, height?: number | null) {
  if (width && height && width > 0 && height > 0) return width / height
  return DEFAULT_ASPECT_RATIO
}

export function computeJustifiedRows(
  items: JustifiedLayoutItem[],
  containerWidth: number,
  options: JustifiedRowsOptions,
): JustifiedLayoutRow[] {
  if (containerWidth <= 0 || items.length === 0) return []

  const {
    gap,
    targetRowHeight,
    minRowHeight,
    maxRowHeight,
    justifyLastRow = true,
    minTileWidth = DEFAULT_MIN_TILE_WIDTH,
  } = options
  const rows: JustifiedLayoutRow[] = []
  let index = 0

  while (index < items.length) {
    const rowItems: JustifiedLayoutItem[] = []
    let aspectRatioSum = 0

    while (index < items.length) {
      const candidate = items[index]

      if (rowItems.length > 0 && wouldNarrowestTileBeTooSmall(rowItems, candidate, containerWidth, gap, minTileWidth)) {
        break
      }

      rowItems.push(candidate)
      aspectRatioSum += candidate.aspectRatio
      index++

      const justifiedHeight = getJustifiedRowHeight(aspectRatioSum, rowItems.length, containerWidth, gap)
      const rowWidthAtTarget = aspectRatioSum * targetRowHeight + (rowItems.length - 1) * gap

      if (justifiedHeight <= maxRowHeight && rowWidthAtTarget >= containerWidth) break
      if (index >= items.length) break
    }

    const isLastRow = index >= items.length
    rows.push(buildJustifiedRow(rowItems, containerWidth, gap, isLastRow, {
      targetRowHeight,
      minRowHeight,
      justifyLastRow,
    }))
  }

  return rows
}

function getJustifiedRowHeight(
  aspectRatioSum: number,
  itemCount: number,
  containerWidth: number,
  gap: number,
) {
  if (aspectRatioSum <= 0) return 0
  const gaps = Math.max(0, itemCount - 1) * gap
  return Math.max(0, containerWidth - gaps) / aspectRatioSum
}

function wouldNarrowestTileBeTooSmall(
  rowItems: JustifiedLayoutItem[],
  candidate: JustifiedLayoutItem,
  containerWidth: number,
  gap: number,
  minTileWidth: number,
) {
  const nextItems = [...rowItems, candidate]
  const aspectRatioSum = nextItems.reduce((sum, item) => sum + item.aspectRatio, 0)
  const minAspectRatio = Math.min(...nextItems.map((item) => item.aspectRatio))
  const rowHeight = getJustifiedRowHeight(aspectRatioSum, nextItems.length, containerWidth, gap)
  return minAspectRatio * rowHeight < minTileWidth
}

/**
 * Sizes every row edge-to-edge: sum(tile widths) + gaps === containerWidth.
 * Height is derived from aspect ratios only (no clamping that leaves trailing space).
 */
function buildJustifiedRow(
  rowItems: JustifiedLayoutItem[],
  containerWidth: number,
  gap: number,
  isLastRow: boolean,
  options: Pick<JustifiedRowsOptions, "targetRowHeight" | "minRowHeight" | "justifyLastRow">,
) {
  const itemCount = rowItems.length
  const gaps = Math.max(0, itemCount - 1) * gap
  const availableWidth = Math.max(0, containerWidth - gaps)
  const aspectRatioSum = rowItems.reduce((sum, item) => sum + item.aspectRatio, 0)

  let height =
    aspectRatioSum > 0
      ? availableWidth / aspectRatioSum
      : options.targetRowHeight

  if (isLastRow && !options.justifyLastRow) {
    height = options.targetRowHeight
  } else {
    height = Math.max(options.minRowHeight, height)
  }

  const tiles: JustifiedLayoutTile[] = []
  let usedWidth = 0

  for (let index = 0; index < itemCount; index++) {
    const item = rowItems[index]
    const isLastTile = index === itemCount - 1
    const width = isLastTile
      ? Math.max(0, availableWidth - usedWidth)
      : Math.round((item.aspectRatio / aspectRatioSum) * availableWidth)

    usedWidth += width
    tiles.push({ id: item.id, width, height })
  }

  return {
    key: rowItems.map((item) => item.id).join("-"),
    height,
    items: tiles,
  }
}

/** Sum of tile widths + gaps for a laid-out row (for tests). */
export function getRowContentWidth(row: JustifiedLayoutRow, gap: number) {
  const tileWidth = row.items.reduce((sum, tile) => sum + tile.width, 0)
  const gaps = Math.max(0, row.items.length - 1) * gap
  return tileWidth + gaps
}
