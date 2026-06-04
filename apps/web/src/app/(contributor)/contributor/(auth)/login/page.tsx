import { redirect } from "next/navigation"

import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import { getOptionalContributorSession } from "@/lib/contributor-session"

interface ContributorLoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function ContributorLoginPage({ searchParams }: ContributorLoginPageProps) {
  const session = await getOptionalContributorSession()
  if (session) redirect("/contributor/dashboard")

  const params = await searchParams
  redirect(
    buildSignInHref({
      callbackUrl: params.callbackUrl ?? null,
    }),
  )
}
