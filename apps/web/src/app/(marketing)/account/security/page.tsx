import Link from "next/link"
import { KeyRound } from "lucide-react"

import { ChangePlatformPasswordForm } from "@/components/account/change-platform-password-form"
import { AccountShell } from "@/components/account/account-shell"
import { AccountSection } from "@/components/account/account-section"
import { requireAuth } from "@/lib/app-user"
import { formatAccountDisplayName } from "@/lib/account-access-summary"

export const metadata = {
  title: "Security",
}

export default async function AccountSecurityPage() {
  const appUser = await requireAuth()
  const displayName = formatAccountDisplayName(appUser)

  return (
    <AccountShell
      title="Security"
      description="Manage how you sign in to Fotocorp."
    >
      <AccountSection
        eyebrow="Password"
        title="Change your password"
        description={`Signed in as ${displayName} (${appUser.email}). Use your current password to set a new one.`}
      >
        <div className="max-w-lg">
          <ChangePlatformPasswordForm />
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          If you cannot sign in, use{" "}
          <Link href="/forgot-password" className="font-bold text-foreground underline-offset-4 hover:underline">
            forgot password
          </Link>{" "}
          to receive a reset link by email.
        </p>
        <div className="mt-4 flex items-start gap-3 border border-border bg-secondary/30 p-4">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-foreground" aria-hidden />
          <p className="text-xs leading-5 text-muted-foreground">
            Password changes apply to both your email and username sign-in. Contributor and staff accounts use separate
            sign-in flows.
          </p>
        </div>
      </AccountSection>
    </AccountShell>
  )
}
