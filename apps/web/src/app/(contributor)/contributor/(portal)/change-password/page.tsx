import { KeyRound } from "lucide-react"
import { ChangeContributorPasswordForm } from "@/components/contributor/change-password-form"
import { requireContributorPortalSession } from "@/lib/contributor-session"

export const metadata = {
  title: "Change Contributor Password",
}

export default async function ContributorChangePasswordPage() {
  const session = await requireContributorPortalSession()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-wash text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contributor security</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Change your password</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {session.account.mustChangePassword
                ? "Your temporary password must be changed before you can continue to the dashboard."
                : "You can update your contributor portal password at any time."}
            </p>
          </div>
        </div>
        <div className="mt-8">
          <ChangeContributorPasswordForm />
        </div>
      </div>
    </div>
  )
}
