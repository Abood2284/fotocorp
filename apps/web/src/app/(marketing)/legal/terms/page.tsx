import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "Terms — Fotocorp",
}

export default function TermsPage() {
  return (
    <PlaceholderPage
      eyebrow="Legal"
      title="Terms of use are being prepared."
      description="This route is reserved for Fotocorp platform terms."
      actions={[{ label: "Contact us", href: "/contact" }]}
    />
  )
}
