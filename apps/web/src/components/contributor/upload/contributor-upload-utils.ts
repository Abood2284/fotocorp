import { MAX_FILE_BYTES } from "@/components/contributor/contributor-upload-types"

const ALLOWED_EXT = new Set(["jpg", "jpeg"])

export interface FileValidationResult {
  accepted: File[]
  rejected: { file: File; reason: string }[]
}

export function extensionOf(name: string) {
  const base = name.trim().split(/[/\\]/).pop() ?? ""
  const m = base.match(/\.([A-Za-z0-9]{1,8})$/)
  return m ? m[1]!.toLowerCase() : ""
}

export function mimeForJpegUpload(file: File): "image/jpeg" | null {
  const ext = extensionOf(file.name)
  const t = file.type.trim().toLowerCase()
  if (t === "image/jpeg") return "image/jpeg"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  return null
}

export function validateJpegFiles(files: File[]): FileValidationResult {
  const accepted: File[] = []
  const rejected: { file: File; reason: string }[] = []

  for (const file of files) {
    const ext = extensionOf(file.name)
    if (!ALLOWED_EXT.has(ext)) {
      rejected.push({ file, reason: "Only JPG files are accepted." })
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ file, reason: "Exceeds 50 MB." })
      continue
    }
    if (file.size < 1) {
      rejected.push({ file, reason: "File is empty." })
      continue
    }
    if (!mimeForJpegUpload(file)) {
      rejected.push({ file, reason: "Must be a JPEG image." })
      continue
    }
    accepted.push(file)
  }

  return { accepted, rejected }
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes > 0) return `${(bytes / 1024).toFixed(1)} KB`
  return "0 KB"
}

export function labelForStatus(s: string) {
  if (s === "queued") return "Queued"
  if (s === "preparing") return "Preparing"
  if (s === "ready") return "Waiting"
  if (s === "uploading") return "Uploading"
  if (s === "finalizing") return "Finalizing"
  if (s === "done") return "Done"
  if (s === "failed") return "Failed"
  return s
}
