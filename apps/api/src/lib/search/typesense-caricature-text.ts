export const CARICATURE_SEARCH_PLACEHOLDER_VALUES = new Set([
  "n/a",
  "na",
  "null",
  "none",
  "-",
  "--",
  "no text",
  "not applicable",
]);

export function isCaricatureSearchPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return CARICATURE_SEARCH_PLACEHOLDER_VALUES.has(normalized);
}

export function sanitizeCaricatureSearchableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || isCaricatureSearchPlaceholder(trimmed)) return null;
  return trimmed;
}

export function sanitizeCaricatureSearchableStringList(value: unknown): string[] {
  return unique(
    normalizeStringList(value).filter((entry) => !isCaricatureSearchPlaceholder(entry)),
  );
}

function normalizeStringList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return unique(value.flatMap((item) => normalizeStringList(item)));
  if (typeof value === "object") return normalizeStringList(Object.values(value));

  const raw = String(value).trim();
  if (!raw) return [];

  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return normalizeStringList(JSON.parse(raw));
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return unique(
    raw
      .split(/[,;|\n\r]+/g)
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
