export function isLandscapePreview(width?: number | null, height?: number | null) {
  if (!width || !height || width <= 0 || height <= 0) return false
  return width > height
}
