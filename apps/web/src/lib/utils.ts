import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const integerFormatter = new Intl.NumberFormat("en-US")

/** Locale-stable integer formatting for SSR + hydration (avoids en-IN vs en-US mismatches). */
export function formatInteger(value: number) {
  return integerFormatter.format(value)
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** Format price in dollars */
export function formatPrice(cents: number | null, currency = "USD"): string {
  if (cents === null) return "Custom"
  if (cents === 0) return "Free"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents)
}

/** Derive orientation from asset dimensions */
export function getOrientation(
  width?: number,
  height?: number,
): "landscape" | "portrait" | "square" {
  if (!width || !height) return "landscape"
  const ratio = width / height
  if (ratio > 1.1) return "landscape"
  if (ratio < 0.9) return "portrait"
  return "square"
}
