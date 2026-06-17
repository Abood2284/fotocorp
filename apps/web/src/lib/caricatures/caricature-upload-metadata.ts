import type { UploadBatchAssetType } from "@/components/contributor/contributor-upload-types"

export type CaricatureLanguage =
  | "NO_VISIBLE_TEXT"
  | "ENGLISH"
  | "HINDI"
  | "MARATHI"
  | "URDU"
  | "MIXED"
  | "OTHER"

export type CaricatureAssetStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED"

export type CaricaturePreviewGenerationStatus =
  | "NONE"
  | "QUEUED"
  | "GENERATING"
  | "READY"
  | "FAILED"

export interface CaricatureCategoryOption {
  id: string
  name: string
  slug: string
}

export interface CaricatureAssetMetadataPayload {
  headline: string
  description: string
  credit: string
  categoryId: string
  language: CaricatureLanguage
  languageOther?: string | null
  visibleText?: string | null
  visibleTextTranslationEn?: string | null
  keywords: string[]
  depictedSubjects: string[]
  publishedAt: string
  status: CaricatureAssetStatus
}

export interface CaricatureAssetRecord extends CaricatureAssetMetadataPayload {
  id: string
  hasOriginalFile: boolean
  hasReadyPreviewDerivatives?: boolean
  previewGenerationStatus?: CaricaturePreviewGenerationStatus
  hasVisibleText: boolean
  categoryName: string
  visibility: string
  createdAt: string
  updatedAt: string
}

export const CARICATURE_LANGUAGE_OPTIONS: { value: CaricatureLanguage; label: string }[] = [
  { value: "NO_VISIBLE_TEXT", label: "No Visible Text" },
  { value: "ENGLISH", label: "English" },
  { value: "HINDI", label: "Hindi" },
  { value: "MARATHI", label: "Marathi" },
  { value: "URDU", label: "Urdu" },
  { value: "MIXED", label: "Mixed" },
  { value: "OTHER", label: "Other" },
]

export const CARICATURE_STATUS_OPTIONS: { value: CaricatureAssetStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
]

export function caricatureLanguageRequiresVisibleText(language: CaricatureLanguage): boolean {
  return language !== "NO_VISIBLE_TEXT"
}

export function caricatureLanguageShowsTranslation(language: CaricatureLanguage): boolean {
  return language !== "NO_VISIBLE_TEXT" && language !== "ENGLISH"
}

export function caricatureLanguageRequiresOther(language: CaricatureLanguage): boolean {
  return language === "OTHER"
}

export function parseCaricatureStringList(value: string): string[] {
  return value
    .split(/[,;\n\r]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function formatCaricatureStringList(values: string[]): string {
  return values.join(", ")
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 16)
}

export function isCaricatureUpload(assetType: UploadBatchAssetType): boolean {
  return assetType === "CARICATURE"
}

export const CARICATURE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024

export function validateCaricatureUploadFile(file: File): { ok: true } | { ok: false; reason: string } {
  const mime = file.type.trim().toLowerCase()
  const name = file.name.trim().toLowerCase()
  const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"])
  const allowedExt = /\.(jpe?g|png|webp)$/
  if (!allowedMime.has(mime) && !allowedExt.test(name)) {
    return { ok: false, reason: `${file.name}: use JPG, PNG, or WebP.` }
  }
  if (file.size > CARICATURE_UPLOAD_MAX_BYTES) {
    return { ok: false, reason: `${file.name}: exceeds 50 MB.` }
  }
  return { ok: true }
}

export function buildDefaultCaricatureMetadata(credit: string): CaricatureAssetMetadataPayload {
  return {
    headline: "",
    description: "",
    credit,
    categoryId: "",
    language: "NO_VISIBLE_TEXT",
    keywords: [],
    depictedSubjects: [],
    publishedAt: new Date().toISOString(),
    status: "DRAFT",
  }
}
