/**
 * Parses legacy-import Fotokey strings (FC + DD + MM + YY + sequence).
 * Sequence length varies in legacy data; new allocator keys use the same date prefix
 * with a minimum 3-digit sequence.
 */
export interface ParsedLegacyFotokey {
  fotokey: string
  fotokeyDate: string
  fotokeySequence: number
}

const LEGACY_FOTOKEY_PATTERN = /^FC[0-9]{8,}$/i

export function isLegacyImportFotokeyShape(value: string): boolean {
  return LEGACY_FOTOKEY_PATTERN.test(value.trim())
}

export function parseLegacyFotokeyCode(raw: string): ParsedLegacyFotokey | null {
  const fotokey = raw.trim().toUpperCase()
  if (!LEGACY_FOTOKEY_PATTERN.test(fotokey)) return null

  const digits = fotokey.slice(2)
  const dateDigits = digits.slice(0, 6)
  const sequenceDigits = digits.slice(6)
  if (!sequenceDigits) return null

  const day = Number(dateDigits.slice(0, 2))
  const month = Number(dateDigits.slice(2, 4))
  const yearTwoDigit = Number(dateDigits.slice(4, 6))
  const fotokeySequence = Number(sequenceDigits)

  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(yearTwoDigit) ||
    !Number.isInteger(fotokeySequence) ||
    fotokeySequence < 1
  ) {
    return null
  }

  const fullYear = yearTwoDigit <= 30 ? 2000 + yearTwoDigit : 1900 + yearTwoDigit
  const fotokeyDate = `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  const parsed = new Date(`${fotokeyDate}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getUTCDate() !== day || parsed.getUTCMonth() + 1 !== month) return null

  return { fotokey, fotokeyDate, fotokeySequence }
}
