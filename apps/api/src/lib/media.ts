export function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildPreviewPath(key: string): string {
  return `/media/preview/${encodeObjectKey(key)}`;
}

export function buildOriginalPath(key: string): string {
  return `/media/original/${encodeObjectKey(key)}`;
}
