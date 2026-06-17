/** Temporary contributor-upload placeholder — not a real Fotokey. */
export function isPhuploadLegacyCode(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return value.trim().toUpperCase().startsWith("PHUPLOAD")
}

export function formatCatalogFotokeyDisplay(fotokey: string | null | undefined): string {
  return fotokey?.trim() || "Not assigned"
}

export interface CatalogImportMatchNameInput {
  uploadOriginalFileName?: string | null
  originalFileName?: string | null
  legacyImageCode?: string | null
  fotokey?: string | null
}

/** Spreadsheet / bulk-import match name shown in catalog UI. */
export function getCatalogImportMatchName(input: CatalogImportMatchNameInput): string | null {
  if (input.uploadOriginalFileName?.trim()) return input.uploadOriginalFileName.trim()
  if (input.originalFileName?.trim()) return input.originalFileName.trim()
  if (input.legacyImageCode?.trim() && !isPhuploadLegacyCode(input.legacyImageCode)) {
    return input.legacyImageCode.trim()
  }
  if (input.fotokey?.trim()) return input.fotokey.trim()
  return null
}
