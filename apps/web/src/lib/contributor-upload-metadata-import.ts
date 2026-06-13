import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { getTrackedDisplayName } from "@/lib/upload-wizard-resume"

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
  }

  return { exactMap, baseMap }
}

function matchImageCode(
  imageCode: string,
  exactMap: Map<string, TrackedFile[]>,
  baseMap: Map<string, TrackedFile[]>,
):
  | { type: "found"; file: TrackedFile }
  | { type: "not_found" }
  | { type: "ambiguous"; matchedFileNames: string[] } {
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

export function buildMetadataImportMatches(
  rows: ImportedMetadataRow[],
  trackedFiles: TrackedFile[],
): {
  matches: MetadataImportMatch[]
  notFoundCodes: MetadataImportNotFoundCode[]
  ambiguousCodes: MetadataImportAmbiguousCode[]
} {
  const eligible = trackedFiles.filter((row) => row.status === "done" && row.imageAssetId)
  const { exactMap, baseMap } = buildTrackedFileMaps(eligible)

  const matches: MetadataImportMatch[] = []
  const notFoundCodes: MetadataImportNotFoundCode[] = []
  const ambiguousCodes: MetadataImportAmbiguousCode[] = []
  const matchedKeys = new Set<string>()

  for (const row of rows) {
    for (const imageCode of row.imageCodes) {
      const result = matchImageCode(imageCode, exactMap, baseMap)
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
          if (!existing.caption.trim() && row.caption.trim()) existing.caption = row.caption
          if (!existing.keywords.trim() && row.keywords.trim()) existing.keywords = row.keywords
          if (!existing.whoIsInPicture.trim() && row.whoIsInPicture.trim()) {
            existing.whoIsInPicture = row.whoIsInPicture
          }
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

function isFieldEmpty(value: string): boolean {
  return value.trim().length === 0
}

function applyFieldImport(options: {
  fileName: string
  field: MetadataField
  currentValue: string
  importedValue: string
  skippedFields: MetadataImportSkippedField[]
}): string | null {
  const { fileName, field, currentValue, importedValue, skippedFields } = options
  if (isFieldEmpty(importedValue)) {
    if (!isFieldEmpty(currentValue)) return null
    return null
  }
  if (!isFieldEmpty(currentValue)) {
    skippedFields.push({ fileName, field, reason: "existing_value" })
    return null
  }
  return importedValue
}

export function applyImportedMetadataToTracked(
  tracked: TrackedFile[],
  matches: MetadataImportMatch[],
): {
  nextTracked: TrackedFile[]
  skippedFields: MetadataImportSkippedField[]
  updatedImageCount: number
  unchangedImageCount: number
  saveDrafts: Array<{ key: string; draft: MetadataImportDraft }>
} {
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
      }) ?? row.caption
    const nextKeywords =
      applyFieldImport({
        fileName: getTrackedDisplayName(row),
        field: "keywords",
        currentValue: row.keywords,
        importedValue: match.keywords,
        skippedFields,
      }) ?? row.keywords
    const nextWhoIsInPicture =
      applyFieldImport({
        fileName: getTrackedDisplayName(row),
        field: "whoIsInPicture",
        currentValue: row.whoIsInPicture,
        importedValue: match.whoIsInPicture,
        skippedFields,
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
}): Promise<MetadataImportSummary> {
  const rows = await parseUploadMetadataFile(options.file)
  const duplicateCodes = detectDuplicateImageCodes(rows)
  const { matches, notFoundCodes, ambiguousCodes } = buildMetadataImportMatches(rows, options.tracked)
  const { nextTracked, skippedFields, updatedImageCount, unchangedImageCount, saveDrafts } =
    applyImportedMetadataToTracked(options.tracked, matches)

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
