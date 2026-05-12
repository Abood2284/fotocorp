/**
 * Namespace for photographer pre-approval staging objects in the photographer uploads bucket.
 * The key is opaque and must NOT collide with canonical Fotokey originals (which live at the
 * root of the originals bucket as FCddmmyyNNN.<ext>).
 */
export function buildPhotographerOriginalStorageKey(input: {
  photographerId: string;
  eventId: string;
  batchId: string;
  itemId: string;
  extension: string;
}): string {
  const ext = input.extension.toLowerCase().replace(/^\./, "");
  if (!isAllowedUploadExtension(ext)) throw new Error("INVALID_UPLOAD_EXTENSION");
  return `staging/${input.photographerId}/${input.eventId}/${input.batchId}/${input.itemId}.${ext}`;
}

export function isAllowedUploadExtension(ext: string): boolean {
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
}

export function extensionFromFileNameAndMime(fileName: string, mimeType: string): string | null {
  const fromName = extractExtensionFromFileName(fileName);
  if (fromName && isAllowedUploadExtension(fromName)) return normalizeJpeg(fromName);
  const fromMime = extensionFromMime(mimeType);
  return fromMime;
}

function normalizeJpeg(ext: string) {
  return ext === "jpeg" ? "jpg" : ext;
}

function extractExtensionFromFileName(fileName: string): string | null {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "";
  const match = base.match(/\.([A-Za-z0-9]{1,8})$/);
  if (!match) return null;
  return match[1]!.toLowerCase();
}

function extensionFromMime(mime: string): string | null {
  const m = mime.trim().toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

export function photographerUploadLegacyImageCode(itemId: string): string {
  const compact = itemId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `PHUPLOAD-${compact}`;
}
