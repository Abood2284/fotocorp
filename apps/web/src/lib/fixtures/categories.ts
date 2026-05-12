/**
 * Fixture categories — provisional frontend contract.
 * Replace with API adapter when taxonomy is finalized.
 */
import type { Category } from "@/types"

export const FIXTURE_CATEGORIES: Category[] = [
  { id: "cat-all", label: "All", slug: "all", icon: "✦" },
  { id: "cat-nature", label: "Nature", slug: "nature", icon: "🌿" },
  { id: "cat-architecture", label: "Architecture", slug: "architecture", icon: "🏛️" },
  { id: "cat-business", label: "Business", slug: "business", icon: "💼" },
  { id: "cat-people", label: "People", slug: "people", icon: "👤" },
  { id: "cat-food", label: "Food & Drink", slug: "food", icon: "🍃" },
  { id: "cat-abstract", label: "Abstract", slug: "abstract", icon: "◈" },
  { id: "cat-travel", label: "Travel", slug: "travel", icon: "✈️" },
  { id: "cat-technology", label: "Technology", slug: "technology", icon: "⚡" },
]
