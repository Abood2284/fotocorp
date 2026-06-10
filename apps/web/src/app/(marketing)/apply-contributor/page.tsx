import Link from "next/link"

import { ContributorApplicationForm } from "@/components/marketing/contributor-application-form"

export const metadata = {
  title: "Apply as a contributor — Fotocorp",
}

export default function ApplyContributorPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Apply as a contributor
      </h1>
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
