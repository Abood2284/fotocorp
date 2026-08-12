import { HomeHeroBackdropLoader } from "@/components/marketing/home-hero-backdrop-loader"
import { HomeAnniversaryBanner } from "@/components/marketing/home-anniversary-banner"
import { HomeCategorySection } from "@/components/marketing/home-category-section"

export default async function HomePage() {
  return (
    <>
      <HomeAnniversaryBanner />
      <HomeHeroBackdropLoader />
      <HomeCategorySection />
    </>
  )
}
