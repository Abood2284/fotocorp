export function parseWhoIsInPicture(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return Array.from(new Set(value.split(",").map((segment) => segment.trim()).filter(Boolean)))
}
