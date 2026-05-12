import { LibraryShell } from "@/components/library/library-shell"

export const metadata = {
  title: "Favorites — Fotocorp",
  description: "Fixture-backed saved assets shell.",
}

export default function FavoritesPage() {
  return <LibraryShell mode="favorites" />
}
