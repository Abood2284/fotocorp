/**
 * Canonical originals bucket convention: `<FOTOKEY>.<ext>` at root, e.g. `FC010126001.jpg`.
 *
 * The Fotokey IS the filename. UUIDs and photographer staging folder paths must NEVER be used
 * as canonical original keys. The originals bucket holds Fotokey originals only.
 */

const ALLOWED_CANONICAL_EXTENSIONS = new Set(["jpg", "png", "webp"] as const);

export type CanonicalOriginalExtension = "jpg" | "png" | "webp";

/**
 * Normalizes an upload-side extension/filename to the canonical extension stored alongside the
 * Fotokey original. JPEG inputs (whether `jpeg` extension or `image/jpeg` mime) collapse to `jpg`.
 *
 * Returns `null` when the extension is unsupported by the canonical originals bucket.
 */
export function normalizeCanonicalExtension(input: string | null | undefined): CanonicalOriginalExtension | null {
  if (!input) return null;
  const ext = input.trim().toLowerCase().replace(/^\./, "");
  if (ext === "jpeg") return "jpg";
  if (ALLOWED_CANONICAL_EXTENSIONS.has(ext as CanonicalOriginalExtension)) return ext as CanonicalOriginalExtension;
  return null;
}

/** Builds the canonical originals bucket object key for a Fotokey + extension pair. */
export function buildCanonicalOriginalKey(fotokey: string, extension: CanonicalOriginalExtension): string {
  if (!/^FC[0-9]{6}[0-9]{3,}$/.test(fotokey)) {
    throw new Error(`Invalid Fotokey shape: ${fotokey}`);
  }
  return `${fotokey}.${extension}`;
}
