import Link from "next/link"

import { ContributorApplicationForm } from "@/components/marketing/contributor-application-form"

export const metadata = {
  title: "Apply to contribute — Fotocorp",
}

export default function ApplyContributorPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="fc-caption text-muted-foreground">Contributor portal</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Apply to contribute
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Share your details and preferred username. Our team reviews applications before issuing portal credentials.
      </p>
      <div className="mt-10">
        <ContributorApplicationForm />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Already have credentials?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in to the contributor portal
        </Link>
        .
      </p>
    </main>
  )
}
