export interface CaricatureCategorySeed {
  name: string
  slug: string
  sortOrder: number
}

export const CARICATURE_CATEGORY_SEEDS: CaricatureCategorySeed[] = [
  { name: "Politics", slug: "politics", sortOrder: 1 },
  { name: "Society", slug: "society", sortOrder: 2 },
  { name: "Culture", slug: "culture", sortOrder: 3 },
  { name: "Sports", slug: "sports", sortOrder: 4 },
  { name: "Entertainment", slug: "entertainment", sortOrder: 5 },
  { name: "International", slug: "international", sortOrder: 6 },
  { name: "Business", slug: "business", sortOrder: 7 },
  { name: "General", slug: "general", sortOrder: 8 },
]

export function slugifyCaricatureCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildCaricatureCategorySeeds(names: string[]): CaricatureCategorySeed[] {
  return names.map((name, index) => ({
    name,
    slug: slugifyCaricatureCategoryName(name),
    sortOrder: index + 1,
  }))
}
