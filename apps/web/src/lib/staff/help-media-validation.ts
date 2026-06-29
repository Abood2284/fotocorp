import {
  HELP_IMAGE_MAX_BYTES,
  HELP_VIDEO_MAX_BYTES,
  HELP_VIDEO_MAX_DURATION_SECONDS,
} from "@/lib/staff/help-media"

const HELP_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const HELP_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

export type HelpMediaValidationResult =
  | { ok: true; mediaType: "IMAGE" | "VIDEO" }
  | { ok: false; message: string }

interface NormalizeHelpMediaUploadFileOptions {
  fallbackMimeType?: string
}

export function extensionForHelpMediaMime(mimeType: string) {
  switch (mimeType.trim().toLowerCase()) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "video/mp4":
      return "mp4"
    case "video/webm":
      return "webm"
    default:
      return null
  }
}

export function inferHelpMediaMimeType(file: Pick<File, "name" | "type">, fallbackMimeType?: string) {
  const mimeType = file.type.trim().toLowerCase()
  if (mimeType) return mimeType

  const extension = file.name.trim().toLowerCase().split(".").pop() ?? ""
  switch (extension) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "mp4":
      return "video/mp4"
    case "webm":
      return "video/webm"
    default:
      return fallbackMimeType?.trim().toLowerCase() || null
  }
}

export function normalizeHelpMediaUploadFile(file: File, options: NormalizeHelpMediaUploadFileOptions = {}) {
  const resolvedMime = inferHelpMediaMimeType(file, options.fallbackMimeType)
  if (!resolvedMime) return file

  const extension = extensionForHelpMediaMime(resolvedMime) ?? "bin"
  const resolvedName = file.name.trim() || `pasted-${Date.now()}.${extension}`
  const currentMime = file.type.trim().toLowerCase()

  if (file.name.trim() === resolvedName && currentMime === resolvedMime) return file

  return new File([file], resolvedName, {
    type: resolvedMime,
    lastModified: file.lastModified || Date.now(),
  })
}

export function validateHelpMediaFile(file: File): HelpMediaValidationResult {
  const mimeType = inferHelpMediaMimeType(file) ?? ""

  if (HELP_IMAGE_MIME_TYPES.has(mimeType)) {
    if (file.size > HELP_IMAGE_MAX_BYTES) {
      return { ok: false, message: "Image files must be under 10 MB." }
    }
    return { ok: true, mediaType: "IMAGE" }
  }

  if (HELP_VIDEO_MIME_TYPES.has(mimeType)) {
    if (file.size > HELP_VIDEO_MAX_BYTES) {
      return { ok: false, message: "Video files must be under 100 MB." }
    }
    return { ok: true, mediaType: "VIDEO" }
  }

  return {
    ok: false,
    message: "Only PNG, JPG, WEBP, MP4, and WEBM files are supported.",
  }
}

export function readHelpImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image dimensions."))
    }
    image.src = url
  })
}

export function readHelpVideoMetadata(file: File) {
  return new Promise<{ width: number; height: number; durationSeconds: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : 0
      if (durationSeconds < 1 || durationSeconds > HELP_VIDEO_MAX_DURATION_SECONDS) {
        reject(new Error("Videos should be 5 minutes or shorter."))
        return
      }
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read video metadata."))
    }
    video.src = url
  })
}

export function defaultHelpMediaTitle(file: File) {
  const base = file.name.replace(/\.[^.]+$/, "")
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function nextHelpMediaSortOrder(items: Array<{ sortOrder: number }>) {
  const max = items.reduce((current, item) => Math.max(current, item.sortOrder), 0)
  return max + 10
}
