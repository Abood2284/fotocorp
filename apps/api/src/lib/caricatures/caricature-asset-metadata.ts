import {
  CARICATURE_ASSET_STATUSES,
  CARICATURE_LANGUAGES,
} from "../../db/schema/caricature-assets"
import { AppError } from "../errors"
import {
  isCaricatureSearchPlaceholder,
  sanitizeCaricatureSearchableStringList,
  sanitizeCaricatureSearchableText,
} from "../search/typesense-caricature-text"

export const CARICATURE_LANGUAGE_VALUES = CARICATURE_LANGUAGES
export type CaricatureLanguage = (typeof CARICATURE_LANGUAGES)[number]

export const CARICATURE_STATUS_VALUES = CARICATURE_ASSET_STATUSES
export type CaricatureAssetStatus = (typeof CARICATURE_ASSET_STATUSES)[number]

export interface CaricatureMetadataInput {
  headline: string
  description: string
  credit: string
  categoryId: string
  language: string
  languageOther?: string | null
  visibleText?: string | null
  visibleTextTranslationEn?: string | null
  keywords: unknown
  depictedSubjects: unknown
  publishedAt: string | Date
  status: string
}

export interface NormalizedCaricatureMetadata {
  headline: string
  description: string
  credit: string
  categoryId: string
  language: CaricatureLanguage
  languageOther: string | null
  visibleText: string | null
  visibleTextTranslationEn: string | null
  hasVisibleText: boolean
  keywords: string[]
  depictedSubjects: string[]
  publishedAt: Date
  status: CaricatureAssetStatus
}

export interface ValidateCaricatureMetadataOptions {
  hasOriginalFile?: boolean
  hasReadyPreviewDerivatives?: boolean
}

export function normalizeCaricatureMetadataInput(
  input: CaricatureMetadataInput,
  options: ValidateCaricatureMetadataOptions = {},
): NormalizedCaricatureMetadata {
  const headline = requireNonPlaceholderText(input.headline, "headline", "Headline")
  const description = requireNonPlaceholderText(input.description, "description", "Description")
  const credit = requireNonPlaceholderText(input.credit, "credit", "Credit")
  const categoryId = requireUuid(input.categoryId, "categoryId")

  const language = parseLanguage(input.language)
  const keywords = requireNonEmptyStringList(input.keywords, "keywords", "Keywords")
  const depictedSubjects = requireNonEmptyStringList(
    input.depictedSubjects,
    "depictedSubjects",
    "Depicted subjects",
  )
  const publishedAt = parsePublishedAt(input.publishedAt)
  const status = parseStatus(input.status)

  if (status === "PUBLISHED" && !options.hasOriginalFile) {
    throw new AppError(
      400,
      "CARICATURE_PUBLISH_REQUIRES_FILE",
      "Publishing requires an uploaded caricature image. Save as draft until the image is attached.",
    )
  }

  if (status === "PUBLISHED" && !options.hasReadyPreviewDerivatives) {
    throw new AppError(
      400,
      "CARICATURE_PUBLISH_REQUIRES_PREVIEWS",
      "Publishing requires generated blurred previews. Approve the caricature and run preview generation first.",
    )
  }

  const visibleFields = resolveVisibleTextFields(language, {
    languageOther: input.languageOther,
    visibleText: input.visibleText,
    visibleTextTranslationEn: input.visibleTextTranslationEn,
  })

  return {
    headline,
    description,
    credit,
    categoryId,
    language,
    languageOther: visibleFields.languageOther,
    visibleText: visibleFields.visibleText,
    visibleTextTranslationEn: visibleFields.visibleTextTranslationEn,
    hasVisibleText: visibleFields.hasVisibleText,
    keywords,
    depictedSubjects,
    publishedAt,
    status,
  }
}

export function resolveVisibleTextFields(
  language: CaricatureLanguage,
  input: {
    languageOther?: string | null
    visibleText?: string | null
    visibleTextTranslationEn?: string | null
  },
): {
  languageOther: string | null
  visibleText: string | null
  visibleTextTranslationEn: string | null
  hasVisibleText: boolean
} {
  if (language === "NO_VISIBLE_TEXT") {
    if (input.visibleText?.trim() || input.visibleTextTranslationEn?.trim()) {
      throw new AppError(
        400,
        "CARICATURE_VISIBLE_TEXT_NOT_ALLOWED",
        "Visible text fields must be empty when language is No Visible Text.",
      )
    }
    if (input.languageOther?.trim()) {
      throw new AppError(
        400,
        "CARICATURE_LANGUAGE_OTHER_NOT_ALLOWED",
        "Specify Language is only required when language is Other.",
      )
    }
    return {
      languageOther: null,
      visibleText: null,
      visibleTextTranslationEn: null,
      hasVisibleText: false,
    }
  }

  const visibleText = requireNonPlaceholderText(input.visibleText, "visibleText", "Visible text")
  const visibleTextTranslationEn = optionalNonPlaceholderText(input.visibleTextTranslationEn)

  if (language === "ENGLISH" && visibleTextTranslationEn) {
    throw new AppError(
      400,
      "CARICATURE_TRANSLATION_NOT_NEEDED",
      "English translation is not needed when the visible text language is English.",
    )
  }

  let languageOther: string | null = null
  if (language === "OTHER") {
    languageOther = requireNonPlaceholderText(
      input.languageOther,
      "languageOther",
      "Specify language",
    )
  } else if (input.languageOther?.trim()) {
    throw new AppError(
      400,
      "CARICATURE_LANGUAGE_OTHER_NOT_ALLOWED",
      "Specify Language is only required when language is Other.",
    )
  }

  return {
    languageOther,
    visibleText,
    visibleTextTranslationEn,
    hasVisibleText: true,
  }
}

function parseLanguage(value: string): CaricatureLanguage {
  const normalized = value.trim().toUpperCase()
  if (!CARICATURE_LANGUAGE_VALUES.includes(normalized as CaricatureLanguage)) {
    throw new AppError(400, "CARICATURE_LANGUAGE_INVALID", "Language is invalid.")
  }
  return normalized as CaricatureLanguage
}

function parseStatus(value: string): CaricatureAssetStatus {
  const normalized = value.trim().toUpperCase()
  if (!CARICATURE_STATUS_VALUES.includes(normalized as CaricatureAssetStatus)) {
    throw new AppError(400, "CARICATURE_STATUS_INVALID", "Status is invalid.")
  }
  return normalized as CaricatureAssetStatus
}

function parsePublishedAt(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "CARICATURE_PUBLISHED_AT_INVALID", "Published date is invalid.")
  }
  return date
}

function requireUuid(value: string, field: string): string {
  const trimmed = value.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new AppError(400, "CARICATURE_FIELD_INVALID", `${field} must be a valid UUID.`)
  }
  return trimmed
}

function requireNonPlaceholderText(
  value: string | null | undefined,
  field: string,
  label: string,
): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    throw new AppError(400, "CARICATURE_FIELD_REQUIRED", `${label} is required.`)
  }
  if (isCaricatureSearchPlaceholder(trimmed)) {
    throw new AppError(
      400,
      "CARICATURE_PLACEHOLDER_NOT_ALLOWED",
      `${label} cannot use placeholder values such as N/A or none.`,
    )
  }
  return trimmed
}

function optionalNonPlaceholderText(value: string | null | undefined): string | null {
  return sanitizeCaricatureSearchableText(value ?? null)
}

function requireNonEmptyStringList(value: unknown, field: string, label: string): string[] {
  const normalized = sanitizeCaricatureSearchableStringList(value)
  if (normalized.length === 0) {
    throw new AppError(400, "CARICATURE_FIELD_REQUIRED", `${label} must include at least one value.`)
  }
  if (field === "keywords" && normalized.length > 50) {
    throw new AppError(400, "CARICATURE_KEYWORDS_TOO_MANY", "Keywords cannot exceed 50 entries.")
  }
  if (field === "depictedSubjects" && normalized.length > 50) {
    throw new AppError(
      400,
      "CARICATURE_DEPICTED_SUBJECTS_TOO_MANY",
      "Depicted subjects cannot exceed 50 entries.",
    )
  }
  return normalized
}
