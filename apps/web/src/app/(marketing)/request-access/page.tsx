import Link from "next/link"

export const metadata = {
  title: "Request Access — Fotocorp",
  description:
    "Fotocorp offers tailored subscription-based licensing solutions for images, video, caricatures, and custom creative content.",
}

export default function RequestAccessPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="fc-caption text-muted-foreground">Tell us what you need</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Request Access
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Fotocorp offers tailored subscription-based licensing solutions for images, video, caricatures, and
        custom creative content. Create an account, share your requirements, and our team will contact you to
        discuss access options, licensing plans, and the next steps.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/sign-in?tab=register"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create account
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-medium hover:bg-muted"
        >
          Sign in
        </Link>
      </div>
    </main>
  )
}
