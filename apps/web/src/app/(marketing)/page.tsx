import { HomeHeroBackdropLoader } from "@/components/marketing/home-hero-backdrop-loader"
import { HomeCategorySection } from "@/components/marketing/home-category-section"

export default async function HomePage() {
  return (
    <>
      <HomeHeroBackdropLoader />
      <HomeCategorySection />
    </>
  )
}
