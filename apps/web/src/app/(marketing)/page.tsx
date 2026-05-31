import { HomeHeroBackdropLoader } from "@/components/marketing/home-hero-backdrop-loader"
import { HomeCategorySection } from "@/components/marketing/home-category-section"

export const metadata = {
  title: "Fotocorp — India's Premier News Photo Agency",
  description:
    "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai.",
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const initialTab = params.tab?.trim().toLowerCase() === "royalty-free" ? "Creative" : "Editorial"

  return (
    <>
      <HomeHeroBackdropLoader />
      <HomeCategorySection initialTab={initialTab} />
    </>
  )
}
