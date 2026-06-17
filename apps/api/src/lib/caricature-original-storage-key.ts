const ALLOWED_CARICATURE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"])

export const CARICATURE_ORIGINALS_BUCKET_NAME = "fotocorp-caricature-originals"

export function isAllowedCaricatureUploadExtension(ext: string): boolean {
  return ALLOWED_CARICATURE_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ""))
}

export function extensionFromCaricatureFileNameAndMime(fileName: string, mimeType: string): string | null {
  const fromName = extractExtensionFromFileName(fileName)
  if (fromName && isAllowedCaricatureUploadExtension(fromName)) return normalizeCaricatureExtension(fromName)
  const fromMime = extensionFromCaricatureMime(mimeType)
  return fromMime
}

export function buildCaricatureOriginalStorageKey(input: { assetId: string; extension: string }): string {
  const ext = normalizeCaricatureExtension(input.extension.replace(/^\./, ""))
  if (!isAllowedCaricatureUploadExtension(ext)) throw new Error("INVALID_CARICATURE_UPLOAD_EXTENSION")
  return `caricatures/${input.assetId}/original.${ext}`
}

function normalizeCaricatureExtension(ext: string): string {
  const lower = ext.toLowerCase()
  if (lower === "jpeg") return "jpg"
  return lower
}

function extractExtensionFromFileName(fileName: string): string | null {
  const base = fileName.trim().split(/[/\\]/).pop() ?? ""
  const match = base.match(/\.([A-Za-z0-9]{1,8})$/i)
  if (!match) return null
  return match[1]!.toLowerCase()
}

function extensionFromCaricatureMime(mime: string): string | null {
  const m = mime.trim().toLowerCase()
  if (m === "image/jpeg") return "jpg"
  if (m === "image/png") return "png"
  if (m === "image/webp") return "webp"
  return null
}
