import { Suspense } from "react"
import { ResetPasswordForm } from "@/components/auth/password-reset-forms"

export const metadata = {
  title: "Reset password",
}

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolved = await searchParams
  const token = readQueryParam(resolved, "token")

  return (
    <Suspense fallback={null}>
      <ResetPasswordForm token={token} />
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
