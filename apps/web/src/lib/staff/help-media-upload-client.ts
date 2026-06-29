import type { HelpArticleMediaItem } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import {
  defaultHelpMediaTitle,
  nextHelpMediaSortOrder,
  normalizeHelpMediaUploadFile,
  readHelpImageDimensions,
  readHelpVideoMetadata,
  validateHelpMediaFile,
} from "@/lib/staff/help-media-validation"
import { staffHelpClientJson } from "@/lib/staff/help-client"

interface UploadHelpMediaInput {
  articleId: string
  file: File
  title?: string
  description?: string | null
  sortOrder?: number
  existingSortOrders?: Array<{ sortOrder: number }>
  onProgress?: (percent: number) => void
  fallbackMimeType?: string
}

interface PutHelpMediaResult {
  ok: boolean
  status: number
}

export async function uploadHelpArticleMedia({
  articleId,
  file,
  title,
  description,
  sortOrder,
  existingSortOrders = [],
  onProgress,
  fallbackMimeType,
}: UploadHelpMediaInput): Promise<HelpArticleMediaItem> {
  const normalizedFile = normalizeHelpMediaUploadFile(file, { fallbackMimeType })
  const validation = validateHelpMediaFile(normalizedFile)
  if (!validation.ok) {
    throw new StaffApiError(400, "HELP_MEDIA_INVALID", validation.message)
  }

  const resolvedSortOrder =
    typeof sortOrder === "number" ? sortOrder : nextHelpMediaSortOrder(existingSortOrders)

  const intent = await staffHelpClientJson<{
    ok: true
    mediaId: string
    uploadUrl: string
    requiredHeaders: { "Content-Type": string }
  }>(`/articles/${articleId}/media/upload-intent`, {
    method: "POST",
    body: {
      filename: normalizedFile.name,
      mimeType: normalizedFile.type,
      fileSizeBytes: normalizedFile.size,
      mediaType: validation.mediaType,
      title: title?.trim() || defaultHelpMediaTitle(normalizedFile),
      description: description?.trim() || null,
      sortOrder: resolvedSortOrder,
    },
  })

  const putResult = await putHelpMediaViaStaffBff({
    articleId,
    mediaId: intent.mediaId,
    file: normalizedFile,
    contentType: intent.requiredHeaders["Content-Type"],
    onProgress,
  })

  if (!putResult.ok) {
    let message = "Upload to storage failed."
    try {
      const body = JSON.parse(putResult.errorBody) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      // ignore parse errors
    }
    throw new StaffApiError(putResult.status, "HELP_MEDIA_UPLOAD_FAILED", message)
  }

  let confirmBody: { width: number; height: number; durationSeconds?: number }
  try {
    confirmBody =
      validation.mediaType === "IMAGE"
        ? await readHelpImageDimensions(normalizedFile)
        : await readHelpVideoMetadata(normalizedFile)
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not read uploaded media metadata."
    throw new StaffApiError(400, "HELP_MEDIA_METADATA_FAILED", message)
  }

  const confirmResponse = await staffHelpClientJson<{ ok: true; media: HelpArticleMediaItem }>(
    `/articles/${articleId}/media/${intent.mediaId}/confirm`,
    {
      method: "POST",
      body: confirmBody,
    },
  )

  return confirmResponse.media
}

interface PutHelpMediaViaStaffBffInput {
  articleId: string
  mediaId: string
  file: Blob
  contentType: string
  onProgress?: (percent: number) => void
}

async function putHelpMediaViaStaffBff({
  articleId,
  mediaId,
  file,
  contentType,
  onProgress,
}: PutHelpMediaViaStaffBffInput): Promise<PutHelpMediaResult & { errorBody: string }> {
  const uploadUrl = `/api/staff/help/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/upload`

  if (typeof XMLHttpRequest === "undefined") {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": contentType },
      body: file,
    })
    const errorBody = response.ok ? "" : await response.text()
    return { ok: response.ok, status: response.status, errorBody }
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.withCredentials = true
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return
      onProgress(Math.min(100, Math.round((100 * event.loaded) / event.total)))
    })
    xhr.addEventListener("load", () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        errorBody: xhr.responseText ?? "",
      })
    })
    xhr.addEventListener("error", () => {
      reject(new Error("Could not upload help media. Check your connection and try again."))
    })
    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled."))
    })
    try {
      xhr.send(file)
    } catch (caught) {
      reject(caught instanceof Error ? caught : new Error("Could not upload help media."))
    }
  })
}
