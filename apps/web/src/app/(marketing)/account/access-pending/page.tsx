import Link from "next/link"
import { requireAuth } from "@/lib/app-user"

export const metadata = {
  title: "Access pending — Fotocorp",
}

export default async function AccessPendingPage() {
  await requireAuth()

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Thanks — we have your request</h1>
      <p className="mt-4 text-muted-foreground">
        Your account is ready. Our team will email you at your company address after we review what you need. You can browse the catalog and save work to Fotobox while you wait.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Browse catalog
        </Link>
        <Link href="/account" className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
          Account home
        </Link>
      </div>
    </main>
  )
}
