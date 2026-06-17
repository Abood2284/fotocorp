import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { getTrackedDisplayName } from "@/lib/upload-wizard-resume"
import { isPhuploadLegacyCode } from "@/lib/catalog-asset-identity"

export type ImportedMetadataRow = {
  sourceRowNumber: number
  imageCodes: string[]
  caption: string
  keywords: string
  whoIsInPicture: string
}

export type MetadataImportSkippedField = {
  fileName: string
  field: "caption" | "keywords" | "whoIsInPicture"
  reason: "existing_value" | "empty_import_value"
}

export type MetadataImportNotFoundCode = {
  imageCode: string
  sourceRowNumber: number
}

export type MetadataImportDuplicateCode = {
  imageCode: string
  sourceRowNumbers: number[]
}

export type MetadataImportAmbiguousCode = {
  imageCode: string
  matchedFileNames: string[]
  sourceRowNumber: number
}

export type MetadataImportSummary = {
  fileName: string
  totalRows: number
  matchedImageCount: number
  updatedImageCount: number
  unchangedImageCount: number
  skippedFields: MetadataImportSkippedField[]
  notFoundCodes: MetadataImportNotFoundCode[]
  duplicateCodes: MetadataImportDuplicateCode[]
  ambiguousCodes: MetadataImportAmbiguousCode[]
  invalidRows: Array<{
    sourceRowNumber: number
    reason: string
  }>
  savedCount: number
  saveFailureCount: number
}

type MetadataField = "caption" | "keywords" | "whoIsInPicture"

export type MetadataImportMatch = {
  trackedKey: string
  fileName: string
  sourceRowNumber: number
  caption: string
  keywords: string
  whoIsInPicture: string
}

export interface MetadataImportDraft {
  caption: string
  keywords: string
  whoIsInPicture: string
}

const REQUIRED_COLUMNS = ["image_codes", "caption", "keywords", "who_is_in_picture"] as const
const METADATA_IMPORT_SAVE_CONCURRENCY = 5

/** How imported spreadsheet values merge with existing asset metadata. */
export type ImportOverwritePolicy = "fill_empty_only" | "overwrite"

export type MetadataImportMatchKey = "filename" | "fotokey_with_filename_fallback" | "original_filename_first"

export const DEFAULT_IMPORT_OVERWRITE_POLICY: ImportOverwritePolicy = "fill_empty_only"

export const DEFAULT_METADATA_IMPORT_MATCH_KEY: MetadataImportMatchKey = "filename"

/** Legacy rushed-upload placeholder; treated as empty when `treatPlaceholdersAsEmpty` is true. */
export const METADATA_IMPORT_PLACEHOLDER_VALUES = ["Coming Soon"] as const

function isFieldEmpty(value: string): boolean {
  return value.trim().length === 0
}

export type ImportOverwriteOptions = {
  overwritePolicy?: ImportOverwritePolicy
  /** When true, placeholder values (e.g. Coming Soon) count as empty under fill_empty_only. */
  treatPlaceholdersAsEmpty?: boolean
  /** How spreadsheet `image_codes` map to selected assets. */
  matchKey?: MetadataImportMatchKey
}

export function isMetadataImportPlaceholderValue(
  value: string,
  placeholders: readonly string[] = METADATA_IMPORT_PLACEHOLDER_VALUES,
): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const normalized = trimmed.toLowerCase()
  return placeholders.some((placeholder) => placeholder.trim().toLowerCase() === normalized)
}

export function isMetadataFieldEmptyForImport(
  value: string,
  options: Pick<ImportOverwriteOptions, "overwritePolicy" | "treatPlaceholdersAsEmpty"> = {},
): boolean {
  const policy = options.overwritePolicy ?? DEFAULT_IMPORT_OVERWRITE_POLICY
  if (isFieldEmpty(value)) return true
  if (policy === "overwrite") return false
  if (options.treatPlaceholdersAsEmpty && isMetadataImportPlaceholderValue(value)) return true
  return false
}

export function normalizeFotokey(value: string): string {
  return value.trim().toUpperCase()
}

export function normalizeColumnHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

export function normalizeFileName(value: string): string {
  return value.trim().toLowerCase()
}

export function getBaseName(value: string): string {
  const trimmed = value.trim()
  const lastDot = trimmed.lastIndexOf(".")
  if (lastDot <= 0) return normalizeFileName(trimmed)
  return normalizeFileName(trimmed.slice(0, lastDot))
}

export async function parseUploadMetadataFile(file: File): Promise<ImportedMetadataRow[]> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("The file has no sheets.")

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error("The file has no readable sheet.")

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  })

  if (rawRows.length === 0) throw new Error("The file has no data rows.")

  const headerMap = new Map<string, string>()
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      if (!headerMap.has(key)) headerMap.set(key, normalizeColumnHeader(key))
    }
  }

  const normalizedColumns = new Set(headerMap.values())
  const missing = REQUIRED_COLUMNS.filter((column) => !normalizedColumns.has(column))
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`)
  }

  const normToOrig = new Map<string, string>()
  for (const [original, normalized] of headerMap) {
    if (!normToOrig.has(normalized)) normToOrig.set(normalized, original)
  }

  const rows: ImportedMetadataRow[] = []

  rawRows.forEach((raw, index) => {
    const sourceRowNumber = index + 2
    const imageCodesRaw = String(raw[normToOrig.get("image_codes")!] ?? "").trim()
    if (!imageCodesRaw) return

    const imageCodes = imageCodesRaw
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean)
    if (imageCodes.length === 0) return

    rows.push({
      sourceRowNumber,
      imageCodes,
      caption: String(raw[normToOrig.get("caption")!] ?? ""),
      keywords: String(raw[normToOrig.get("keywords")!] ?? ""),
      whoIsInPicture: String(raw[normToOrig.get("who_is_in_picture")!] ?? ""),
    })
  })

  return rows
}

export function detectDuplicateImageCodes(rows: ImportedMetadataRow[]): MetadataImportDuplicateCode[] {
  const codeToRows = new Map<string, { imageCode: string; sourceRowNumbers: number[]; count: number }>()

  for (const row of rows) {
    for (const code of row.imageCodes) {
      const normalized = normalizeFileName(code)
      const entry = codeToRows.get(normalized) ?? { imageCode: code, sourceRowNumbers: [], count: 0 }
      entry.count += 1
      if (!entry.sourceRowNumbers.includes(row.sourceRowNumber)) {
        entry.sourceRowNumbers.push(row.sourceRowNumber)
      }
      codeToRows.set(normalized, entry)
    }
  }

  return Array.from(codeToRows.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      imageCode: entry.imageCode,
      sourceRowNumbers: [...entry.sourceRowNumbers].sort((a, b) => a - b),
    }))
}

function buildTrackedFileMaps(trackedFiles: TrackedFile[]) {
  const exactMap = new Map<string, TrackedFile[]>()
  const baseMap = new Map<string, TrackedFile[]>()
  const fotokeyMap = new Map<string, TrackedFile[]>()
  const originalFileNameMap = new Map<string, TrackedFile[]>()
  const originalBaseMap = new Map<string, TrackedFile[]>()
  const legacyCodeMap = new Map<string, TrackedFile[]>()

  for (const file of trackedFiles) {
    const displayName = getTrackedDisplayName(file)
    const exactKey = normalizeFileName(displayName)
    const exactList = exactMap.get(exactKey) ?? []
    exactList.push(file)
    exactMap.set(exactKey, exactList)

    const baseKey = getBaseName(displayName)
    const baseList = baseMap.get(baseKey) ?? []
    baseList.push(file)
    baseMap.set(baseKey, baseList)

    if (file.fotokey?.trim()) {
      const fotokey = normalizeFotokey(file.fotokey)
      const fotokeyList = fotokeyMap.get(fotokey) ?? []
      fotokeyList.push(file)
      fotokeyMap.set(fotokey, fotokeyList)
    }

    if (file.originalFileName?.trim()) {
      const originalKey = normalizeFileName(file.originalFileName)
      const originalList = originalFileNameMap.get(originalKey) ?? []
      originalList.push(file)
      originalFileNameMap.set(originalKey, originalList)

      const originalBaseKey = getBaseName(file.originalFileName)
      const originalBaseList = originalBaseMap.get(originalBaseKey) ?? []
      originalBaseList.push(file)
      originalBaseMap.set(originalBaseKey, originalBaseList)
    }

    if (file.legacyImageCode?.trim() && !isPhuploadLegacyCode(file.legacyImageCode)) {
      const legacyKey = normalizeFileName(file.legacyImageCode)
      const legacyList = legacyCodeMap.get(legacyKey) ?? []
      legacyList.push(file)
      legacyCodeMap.set(legacyKey, legacyList)
    }
  }

  return { exactMap, baseMap, fotokeyMap, originalFileNameMap, originalBaseMap, legacyCodeMap }
}

function matchImageCode(
  imageCode: string,
  exactMap: Map<string, TrackedFile[]>,
  baseMap: Map<string, TrackedFile[]>,
  fotokeyMap: Map<string, TrackedFile[]>,
  originalFileNameMap: Map<string, TrackedFile[]>,
  originalBaseMap: Map<string, TrackedFile[]>,
  legacyCodeMap: Map<string, TrackedFile[]>,
  matchKey: MetadataImportMatchKey,
):
  | { type: "found"; file: TrackedFile }
  | { type: "not_found" }
  | { type: "ambiguous"; matchedFileNames: string[] } {
  function resolveSingle(matches: TrackedFile[] | undefined, matchedFileNames: string[]) {
    if (!matches || matches.length === 0) return { type: "not_found" as const }
    if (matches.length === 1) return { type: "found" as const, file: matches[0]! }
    return { type: "ambiguous" as const, matchedFileNames }
  }

  if (matchKey === "filename") {
    const exactMatches = exactMap.get(normalizeFileName(imageCode))
    if (exactMatches?.length === 1) return { type: "found", file: exactMatches[0]! }
    if (exactMatches && exactMatches.length > 1) {
      return { type: "ambiguous", matchedFileNames: exactMatches.map((file) => getTrackedDisplayName(file)) }
    }

    const baseMatches = baseMap.get(getBaseName(imageCode))
    if (!baseMatches || baseMatches.length === 0) return { type: "not_found" }
    if (baseMatches.length === 1) return { type: "found", file: baseMatches[0]! }
    return { type: "ambiguous", matchedFileNames: baseMatches.map((file) => getTrackedDisplayName(file)) }
  }

  if (matchKey === "original_filename_first") {
    const originalMatches = originalFileNameMap.get(normalizeFileName(imageCode))
    const originalResult = resolveSingle(
      originalMatches,
      originalMatches?.map((file) => file.originalFileName ?? getTrackedDisplayName(file)) ?? [],
    )
    if (originalResult.type !== "not_found") return originalResult

    const originalBaseMatches = originalBaseMap.get(getBaseName(imageCode))
    const originalBaseResult = resolveSingle(
      originalBaseMatches,
      originalBaseMatches?.map((file) => file.originalFileName ?? getTrackedDisplayName(file)) ?? [],
    )
    if (originalBaseResult.type !== "not_found") return originalBaseResult

    const legacyMatches = legacyCodeMap.get(normalizeFileName(imageCode))
    const legacyResult = resolveSingle(
      legacyMatches,
      legacyMatches?.map((file) => file.legacyImageCode ?? getTrackedDisplayName(file)) ?? [],
    )
    if (legacyResult.type !== "not_found") return legacyResult

    const fotokeyMatches = fotokeyMap.get(normalizeFotokey(imageCode))
    const fotokeyResult = resolveSingle(
      fotokeyMatches,
      fotokeyMatches?.map((file) => file.fotokey ?? getTrackedDisplayName(file)) ?? [],
    )
    if (fotokeyResult.type !== "not_found") return fotokeyResult

    const exactMatches = exactMap.get(normalizeFileName(imageCode))
    if (exactMatches?.length === 1) return { type: "found", file: exactMatches[0]! }
    if (exactMatches && exactMatches.length > 1) {
      return { type: "ambiguous", matchedFileNames: exactMatches.map((file) => getTrackedDisplayName(file)) }
    }

    const baseMatches = baseMap.get(getBaseName(imageCode))
    return resolveSingle(
      baseMatches,
      baseMatches?.map((file) => getTrackedDisplayName(file)) ?? [],
    )
  }

  const fotokeyMatches = fotokeyMap.get(normalizeFotokey(imageCode))
  const fotokeyResult = resolveSingle(
    fotokeyMatches,
    fotokeyMatches?.map((file) => file.fotokey ?? getTrackedDisplayName(file)) ?? [],
  )
  if (fotokeyResult.type !== "not_found") return fotokeyResult

  const originalMatches = originalFileNameMap.get(normalizeFileName(imageCode))
  const originalResult = resolveSingle(
    originalMatches,
    originalMatches?.map((file) => file.originalFileName ?? getTrackedDisplayName(file)) ?? [],
  )
  if (originalResult.type !== "not_found") return originalResult

  const originalBaseMatches = originalBaseMap.get(getBaseName(imageCode))
  const originalBaseResult = resolveSingle(
    originalBaseMatches,
    originalBaseMatches?.map((file) => file.originalFileName ?? getTrackedDisplayName(file)) ?? [],
  )
  if (originalBaseResult.type !== "not_found") return originalBaseResult

  const legacyMatches = legacyCodeMap.get(normalizeFileName(imageCode))
  const legacyResult = resolveSingle(
    legacyMatches,
    legacyMatches?.map((file) => file.legacyImageCode ?? getTrackedDisplayName(file)) ?? [],
  )
  if (legacyResult.type !== "not_found") return legacyResult

  const exactMatches = exactMap.get(normalizeFileName(imageCode))
  if (exactMatches?.length === 1) return { type: "found", file: exactMatches[0]! }
  if (exactMatches && exactMatches.length > 1) {
    return { type: "ambiguous", matchedFileNames: exactMatches.map((file) => getTrackedDisplayName(file)) }
  }

  const baseMatches = baseMap.get(getBaseName(imageCode))
  return resolveSingle(
    baseMatches,
    baseMatches?.map((file) => getTrackedDisplayName(file)) ?? [],
  )
}

export function buildMetadataImportMatches(
  rows: ImportedMetadataRow[],
  trackedFiles: TrackedFile[],
  options: ImportOverwriteOptions = {},
): {
  matches: MetadataImportMatch[]
  notFoundCodes: MetadataImportNotFoundCode[]
  ambiguousCodes: MetadataImportAmbiguousCode[]
} {
  const overwritePolicy = options.overwritePolicy ?? DEFAULT_IMPORT_OVERWRITE_POLICY
  const matchKey = options.matchKey ?? DEFAULT_METADATA_IMPORT_MATCH_KEY
  const eligible = trackedFiles.filter((row) => row.status === "done" && row.imageAssetId)
  const { exactMap, baseMap, fotokeyMap, originalFileNameMap, originalBaseMap, legacyCodeMap } =
    buildTrackedFileMaps(eligible)

  const matches: MetadataImportMatch[] = []
  const notFoundCodes: MetadataImportNotFoundCode[] = []
  const ambiguousCodes: MetadataImportAmbiguousCode[] = []
  const matchedKeys = new Set<string>()

  for (const row of rows) {
    for (const imageCode of row.imageCodes) {
      const result = matchImageCode(
        imageCode,
        exactMap,
        baseMap,
        fotokeyMap,
        originalFileNameMap,
        originalBaseMap,
        legacyCodeMap,
        matchKey,
      )
      if (result.type === "not_found") {
        notFoundCodes.push({ imageCode, sourceRowNumber: row.sourceRowNumber })
        continue
      }
      if (result.type === "ambiguous") {
        ambiguousCodes.push({
          imageCode,
          matchedFileNames: result.matchedFileNames,
          sourceRowNumber: row.sourceRowNumber,
        })
        continue
      }

      if (matchedKeys.has(result.file.key)) {
        const existing = matches.find((match) => match.trackedKey === result.file.key)
        if (existing) {
          existing.caption = mergeImportedMatchField(existing.caption, row.caption, overwritePolicy)
          existing.keywords = mergeImportedMatchField(existing.keywords, row.keywords, overwritePolicy)
          existing.whoIsInPicture = mergeImportedMatchField(
            existing.whoIsInPicture,
            row.whoIsInPicture,
            overwritePolicy,
          )
        }
        continue
      }

      matchedKeys.add(result.file.key)
      matches.push({
        trackedKey: result.file.key,
        fileName: getTrackedDisplayName(result.file),
        sourceRowNumber: row.sourceRowNumber,
        caption: row.caption,
        keywords: row.keywords,
        whoIsInPicture: row.whoIsInPicture,
      })
    }
  }

  return { matches, notFoundCodes, ambiguousCodes }
}

function mergeImportedMatchField(
  existing: string,
  incoming: string,
  overwritePolicy: ImportOverwritePolicy,
): string {
  if (isFieldEmpty(incoming)) return existing
  if (overwritePolicy === "overwrite") return incoming
  if (isFieldEmpty(existing)) return incoming
  return existing
}

function applyFieldImport(options: {
  fileName: string
  field: MetadataField
  currentValue: string
  importedValue: string
  skippedFields: MetadataImportSkippedField[]
  overwritePolicy: ImportOverwritePolicy
  treatPlaceholdersAsEmpty: boolean
}): string | null {
  const {
    fileName,
    field,
    currentValue,
    importedValue,
    skippedFields,
    overwritePolicy,
    treatPlaceholdersAsEmpty,
  } = options

  if (isFieldEmpty(importedValue)) {
    return null
  }

  if (overwritePolicy === "overwrite") {
    if (importedValue === currentValue) return null
    return importedValue
  }

  const currentIsEmpty = isMetadataFieldEmptyForImport(currentValue, {
    overwritePolicy,
    treatPlaceholdersAsEmpty,
  })

  if (!currentIsEmpty) {
    skippedFields.push({ fileName, field, reason: "existing_value" })
    return null
  }

  return importedValue
}

export function applyImportedMetadataToTracked(
  tracked: TrackedFile[],
  matches: MetadataImportMatch[],
  options: ImportOverwriteOptions = {},
): {
  nextTracked: TrackedFile[]
  skippedFields: MetadataImportSkippedField[]
  updatedImageCount: number
  unchangedImageCount: number
  saveDrafts: Array<{ key: string; draft: MetadataImportDraft }>
} {
  const overwritePolicy = options.overwritePolicy ?? DEFAULT_IMPORT_OVERWRITE_POLICY
  const treatPlaceholdersAsEmpty = options.treatPlaceholdersAsEmpty ?? false
  const skippedFields: MetadataImportSkippedField[] = []
  const matchByKey = new Map(matches.map((match) => [match.trackedKey, match]))
  let updatedImageCount = 0
  let unchangedImageCount = 0
  const saveDrafts: Array<{ key: string; draft: MetadataImportDraft }> = []

  const nextTracked = tracked.map((row) => {
    const match = matchByKey.get(row.key)
    if (!match || row.status !== "done" || !row.imageAssetId) return row

    const nextCaption =
      applyFieldImport({
        fileName: getTrackedDisplayName(row),
        field: "caption",
        currentValue: row.caption,
        importedValue: match.caption,
        skippedFields,
        overwritePolicy,
        treatPlaceholdersAsEmpty,
      }) ?? row.caption
    const nextKeywords =
      applyFieldImport({
        fileName: getTrackedDisplayName(row),
        field: "keywords",
        currentValue: row.keywords,
        importedValue: match.keywords,
        skippedFields,
        overwritePolicy,
        treatPlaceholdersAsEmpty,
      }) ?? row.keywords
    const nextWhoIsInPicture =
      applyFieldImport({
        fileName: getTrackedDisplayName(row),
        field: "whoIsInPicture",
        currentValue: row.whoIsInPicture,
        importedValue: match.whoIsInPicture,
        skippedFields,
        overwritePolicy,
        treatPlaceholdersAsEmpty,
      }) ?? row.whoIsInPicture

    const changed =
      nextCaption !== row.caption ||
      nextKeywords !== row.keywords ||
      nextWhoIsInPicture !== row.whoIsInPicture

    if (!changed) {
      unchangedImageCount += 1
      return row
    }

    updatedImageCount += 1
    const draft = {
      caption: nextCaption,
      keywords: nextKeywords,
      whoIsInPicture: nextWhoIsInPicture,
    }
    saveDrafts.push({ key: row.key, draft })

    return {
      ...row,
      ...draft,
      metadataRevision: (row.metadataRevision ?? 0) + 1,
      saveState: "saving" as const,
      saveHint: null,
    }
  })

  return { nextTracked, skippedFields, updatedImageCount, unchangedImageCount, saveDrafts }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  const queue = [...items]
  const poolSize = Math.min(limit, queue.length)

  await Promise.all(
    Array.from({ length: poolSize }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break
        await worker(item)
      }
    }),
  )
}

export async function executeMetadataImport(options: {
  file: File
  tracked: TrackedFile[]
  saveItem: (key: string, draft: MetadataImportDraft) => Promise<void>
  onSaveSuccess: (key: string) => void
  onSaveFailure: (key: string, message: string) => void
  onTrackedUpdate: (updater: (prev: TrackedFile[]) => TrackedFile[]) => void
  overwritePolicy?: ImportOverwritePolicy
  treatPlaceholdersAsEmpty?: boolean
  matchKey?: MetadataImportMatchKey
}): Promise<MetadataImportSummary> {
  const importOptions: ImportOverwriteOptions = {
    overwritePolicy: options.overwritePolicy ?? DEFAULT_IMPORT_OVERWRITE_POLICY,
    treatPlaceholdersAsEmpty: options.treatPlaceholdersAsEmpty ?? false,
    matchKey: options.matchKey ?? DEFAULT_METADATA_IMPORT_MATCH_KEY,
  }
  const rows = await parseUploadMetadataFile(options.file)
  const duplicateCodes = detectDuplicateImageCodes(rows)
  const { matches, notFoundCodes, ambiguousCodes } = buildMetadataImportMatches(
    rows,
    options.tracked,
    importOptions,
  )
  const { nextTracked, skippedFields, updatedImageCount, unchangedImageCount, saveDrafts } =
    applyImportedMetadataToTracked(options.tracked, matches, importOptions)

  options.onTrackedUpdate(() => nextTracked)

  let savedCount = 0
  let saveFailureCount = 0

  await runWithConcurrency(saveDrafts, METADATA_IMPORT_SAVE_CONCURRENCY, async ({ key, draft }) => {
    try {
      await options.saveItem(key, draft)
      savedCount += 1
      options.onSaveSuccess(key)
    } catch (e) {
      saveFailureCount += 1
      const message = e instanceof Error ? e.message : "Save failed."
      options.onSaveFailure(key, message)
    }
  })

  const matchedImageCount = matches.length
  const invalidRows =
    rows.length === 0
      ? [{ sourceRowNumber: 2, reason: "All rows are missing image_codes." }]
      : []

  return {
    fileName: options.file.name,
    totalRows: rows.length,
    matchedImageCount,
    updatedImageCount,
    unchangedImageCount,
    skippedFields,
    notFoundCodes,
    duplicateCodes,
    ambiguousCodes,
    invalidRows,
    savedCount,
    saveFailureCount,
  }
}
