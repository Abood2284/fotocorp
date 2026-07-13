import { ContributorApplicationForm } from "@/components/marketing/contributor-application-form"

export const metadata = {
  title: "Contributor Submission Form — Fotocorp",
}

export default function ApplyContributorPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Contributor Submission Form
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        We appreciate your interest in Fotocorp and joining the contributor network. We work with
        photographers, illustrators, cartoonists, and visual content creators. To be considered for
        representation, please complete the form below.
      </p>
      <div className="mt-10">
        <ContributorApplicationForm />
      </div>
    </main>
  )
}
