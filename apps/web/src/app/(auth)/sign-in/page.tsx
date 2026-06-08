import { Suspense } from "react"
import { redirect } from "next/navigation"
import { SplitAuthPage } from "@/components/auth/split-auth-page"
import { resolveSignedInPageRedirect } from "@/lib/auth-post-login"
import { getCurrentAuthUser } from "@/lib/app-user"
import { getOptionalContributorSession } from "@/lib/contributor-session"
import { getOptionalStaffSession } from "@/lib/staff-session"

export const metadata = {
  title: "Sign in",
}

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams
  const callbackUrl = readQueryParam(resolvedSearchParams, "callbackUrl")
    ?? readQueryParam(resolvedSearchParams, "redirectTo")

  const authUser = await getCurrentAuthUser()
  if (authUser) {
    redirect(
      resolveSignedInPageRedirect({
        kind: "user",
        callbackUrl,
        accessInquiryStatus: authUser.accessInquiryStatus,
      }),
    )
  }

  const contributorSession = await getOptionalContributorSession()
  if (contributorSession) {
    redirect(resolveSignedInPageRedirect({ kind: "contributor", callbackUrl }))
  }

  const staffSession = await getOptionalStaffSession()
  if (staffSession) {
    redirect(
      resolveSignedInPageRedirect({
        kind: "staff",
        staffRole: staffSession.staff.role,
        callbackUrl,
      }),
    )
  }

  return (
    <Suspense fallback={null}>
      <SplitAuthPage />
    </Suspense>
  )
}

function readQueryParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
