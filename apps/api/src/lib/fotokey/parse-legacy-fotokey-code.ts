/**
 * Parses legacy-import Fotokey strings (FC + DD + MM + YY + sequence).
 *
 * Legacy sequence length varies:
 * - FC0703191    -> sequence 1
 * - FC08051427   -> sequence 27
 * - FC180316154  -> sequence 154
 *
 * Canonical Fotokey output pads the sequence to a minimum of 3 digits:
 * - FC0703191    -> FC070319001
 * - FC08051427   -> FC080514027
 * - FC180316154  -> FC180316154
 */
export interface ParsedLegacyFotokey {
  fotokey: string;
  fotokeyDate: string;
  fotokeySequence: number;
}

const LEGACY_FOTOKEY_PATTERN = /^FC(\d{2})(\d{2})(\d{2})(\d+)$/i;

export function isLegacyImportFotokeyShape(value: string): boolean {
  return LEGACY_FOTOKEY_PATTERN.test(value.trim());
}

export function parseLegacyFotokeyCode(
  raw: string,
): ParsedLegacyFotokey | null {
  const value = raw.trim().toUpperCase();
  const match = LEGACY_FOTOKEY_PATTERN.exec(value);
  if (!match) return null;

  const [, dayDigits, monthDigits, yearDigits, sequenceDigits] = match;

  const day = Number(dayDigits);
  const month = Number(monthDigits);
  const yearTwoDigit = Number(yearDigits);
  const fotokeySequence = Number(sequenceDigits);

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
    return null;
  }

  const fullYear =
    yearTwoDigit <= 30 ? 2000 + yearTwoDigit : 1900 + yearTwoDigit;
  const fotokeyDate = `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const parsedDate = new Date(`${fotokeyDate}T12:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return null;

  if (
    parsedDate.getUTCDate() !== day ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCFullYear() !== fullYear
  ) {
    return null;
  }

  const fotokey = `FC${dayDigits}${monthDigits}${yearDigits}${String(fotokeySequence).padStart(3, "0")}`;

  return {
    fotokey,
    fotokeyDate,
    fotokeySequence,
  };
}
