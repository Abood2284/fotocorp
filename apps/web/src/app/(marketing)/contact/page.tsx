import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "Contact — Fotocorp",
}

export default function ContactPage() {
  return (
    <PlaceholderPage
      eyebrow="Contact"
      title="Contact Fotocorp for access, licensing, and archive support."
      description="Use this page as the public contact destination while full inquiry workflows are finalized."
      actions={[{ label: "Search archive", href: "/search" }]}
    />
  )
}
