import { LibraryShell } from "@/components/library/library-shell"

export const metadata = {
  title: "Downloads — Fotocorp",
  description: "Fixture-backed user download library shell.",
}

export default function DownloadsPage() {
  return <LibraryShell mode="downloads" />
}
