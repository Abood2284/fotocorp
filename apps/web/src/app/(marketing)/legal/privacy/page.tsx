import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "Privacy — Fotocorp",
}

export default function PrivacyPage() {
  return (
    <PlaceholderPage
      eyebrow="Legal"
      title="Privacy policy is being prepared."
      description="This route is reserved for Fotocorp privacy information."
      actions={[{ label: "Contact us", href: "/contact" }]}
    />
  )
}
