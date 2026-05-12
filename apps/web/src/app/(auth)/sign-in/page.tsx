import { Suspense } from "react"
import { redirect } from "next/navigation"
import { resolveAuthRedirectCandidate } from "@/lib/auth-redirect"
import { getCurrentAuthUser } from "@/lib/app-user"
import { SplitAuthPage } from "@/components/auth/split-auth-page"

export const metadata = {
  title: "Sign in",
}

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const authUser = await getCurrentAuthUser()
  const resolvedSearchParams = await searchParams
  const callbackUrl = readQueryParam(resolvedSearchParams, "callbackUrl")
  const redirectTo = readQueryParam(resolvedSearchParams, "redirectTo")

  if (authUser) redirect(resolveAuthRedirectCandidate(callbackUrl ?? redirectTo))

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
