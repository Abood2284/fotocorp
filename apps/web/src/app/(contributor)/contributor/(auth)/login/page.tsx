import Link from "next/link"
import { redirect } from "next/navigation"
import { Camera } from "lucide-react"
import { ContributorLoginForm } from "@/components/contributor/contributor-login-form"
import { getOptionalContributorSession } from "@/lib/contributor-session"

export const metadata = {
  title: "Contributor Login",
}

export default async function ContributorLoginPage() {
  const session = await getOptionalContributorSession()
  if (session) redirect("/contributor/dashboard")

  return (
    <main className="min-h-screen bg-[var(--surface-warm)] px-4 py-10">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden rounded-[2rem] border border-border bg-background p-8 shadow-sm lg:block">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-accent" />
            <span className="fc-brand text-2xl font-semibold">
              foto<span className="text-accent">corp</span>
            </span>
          </div>
          <div className="mt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Contributor portal</p>
            <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Review the images linked to your contributor account.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
              This portal is separate from Fotocorp customer and admin accounts. Use the portal-only username and temporary password issued by Fotocorp.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-background p-6 shadow-sm sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-accent" />
              <span className="fc-brand text-xl font-semibold">
                foto<span className="text-accent">corp</span>
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Secure sign in</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Contributor login</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your `ph_` username and password. Contact Fotocorp if you cannot access your account.
          </p>
          <div className="mt-8">
            <ContributorLoginForm />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Looking for public image search?{" "}
            <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
              Return to Fotocorp
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
