/* ── Asset ──────────────────────────────────────────────────── */

export interface AssetListItem {
  id: string
  filename: string
  title: string | null
  thumbnailUrl: string
  previewUrl: string
  keywords: string[]
  width?: number
  height?: number
  /** Provisional — may come from backend later */
  category?: string
  /** Orientation derived from width/height */
  orientation?: "landscape" | "portrait" | "square"
}

/* ── Pricing ────────────────────────────────────────────────── */

export type PlanInterval = "monthly" | "annual"

export interface PlanFeature {
  label: string
  included: boolean
  note?: string
}

export interface Plan {
  id: string
  name: string
  tagline: string
  priceMonthly: number | null
  priceAnnual: number | null
  currency: string
  popular?: boolean
  features: PlanFeature[]
  ctaLabel: string
}

/* ── Category ───────────────────────────────────────────────── */

export interface Category {
  id: string
  label: string
  slug: string
  /** Emoji or icon identifier */
  icon?: string
}

/* ── Admin stats (provisional) ──────────────────────────────── */

export interface AdminStat {
  label: string
  value: string
  delta?: string
  deltaPositive?: boolean
}
