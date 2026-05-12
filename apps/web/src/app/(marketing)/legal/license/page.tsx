import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "License — Fotocorp",
}

export default function LicensePage() {
  return (
    <PlaceholderPage
      eyebrow="Legal"
      title="License terms are being prepared."
      description="This route is reserved for Fotocorp image licensing terms."
      actions={[{ label: "Contact us", href: "/contact" }]}
    />
  )
}
