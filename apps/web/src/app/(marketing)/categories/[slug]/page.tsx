import { redirect } from "next/navigation"
import { getPublicAssetFilters } from "@/lib/api/fotocorp-api"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

interface CategoryDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CategoryDetailPageProps) {
  const { slug } = await params
  return {
    title: `${slug} — Categories — Fotocorp`,
  }
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params
  const categories = await getPublicAssetFilters()
    .then((result) => result.categories)
    .catch(() => [])

  const category = categories.find((item) => toSlug(item.name) === slug)
  if (category) {
    redirect(`/search?categoryId=${encodeURIComponent(category.id)}`)
  }

  return (
    <PlaceholderPage
      eyebrow="Category"
      title="Category not found."
      description={`We could not find a category for "${slug}". Continue browsing from the full archive search.`}
      actions={[{ label: "Search archive", href: "/search" }, { label: "Browse categories", href: "/categories" }]}
    />
  )
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
