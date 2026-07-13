import Link from "next/link"

export const metadata = {
  title: "We've Received Your Request — Fotocorp",
}

export default function AccessPendingPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-serif text-2xl font-semibold text-foreground">
        We&apos;ve Received Your Request
      </h1>
      <div className="mt-4 space-y-4 text-muted-foreground">
        <p>
          Thank you for registering with Fotocorp. Your request is currently under review. We&apos;ll contact you
          once the review is complete.
        </p>
        <p>
          In the meantime, you&apos;re welcome to explore our image collections. Once your registration and
          subscription have been approved, you can sign in to your account and download licensed content.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Browse catalog
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Sign in
        </Link>
      </div>
    </main>
  )
}
