import {
  HELP_IMAGE_MIME_TYPES,
  HELP_VIDEO_MIME_TYPES,
  type HelpMediaType,
} from "./constants"

export const HELP_CENTER_BUCKET_NAME = "fotocorp-help-center"

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"])
const VIDEO_EXTENSIONS = new Set(["mp4", "webm"])

export function sanitizeHelpMediaFilename(filename: string) {
  const base = filename.trim().split(/[/\\]/).pop() ?? "upload"
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return cleaned || "upload"
}

export function extensionFromHelpMediaFileNameAndMime(fileName: string, mimeType: string) {
  const lowerName = fileName.trim().toLowerCase()
  const extFromName = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : ""

  switch (mimeType) {
    case "image/png":
      return extFromName === "png" || !extFromName ? "png" : null
    case "image/jpeg":
      return extFromName === "jpg" || extFromName === "jpeg" || !extFromName ? "jpg" : null
    case "image/webp":
      return extFromName === "webp" || !extFromName ? "webp" : null
    case "video/mp4":
      return extFromName === "mp4" || !extFromName ? "mp4" : null
    case "video/webm":
      return extFromName === "webm" || !extFromName ? "webm" : null
    default:
      return null
  }
}

export function resolveHelpMediaType(mimeType: string): HelpMediaType | null {
  if ((HELP_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "IMAGE"
  if ((HELP_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return "VIDEO"
  return null
}

export function isAllowedHelpMediaExtension(ext: string, mediaType: HelpMediaType) {
  if (mediaType === "IMAGE") return IMAGE_EXTENSIONS.has(ext)
  return VIDEO_EXTENSIONS.has(ext)
}

export function buildHelpMediaStorageKey(articleId: string, mediaId: string, fileName: string, mimeType: string) {
  const ext = extensionFromHelpMediaFileNameAndMime(fileName, mimeType)
  if (!ext) throw new Error("Unsupported help media file extension.")

  const safeName = sanitizeHelpMediaFilename(fileName).replace(/\.[^.]+$/, "")
  return `help-media/articles/${articleId}/${mediaId}/${safeName}.${ext}`
}

export function humanizeHelpMediaFilenameTitle(fileName: string) {
  const base = sanitizeHelpMediaFilename(fileName).replace(/\.[^.]+$/, "")
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
