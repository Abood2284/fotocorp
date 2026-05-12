import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getContributorMe, type ContributorAuthResponse } from "@/lib/api/contributor-api"

export async function getContributorCookieHeader() {
  const cookieStore = await cookies()
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

export async function getOptionalContributorSession(): Promise<ContributorAuthResponse | null> {
  try {
    return await getContributorMe({ cookieHeader: await getContributorCookieHeader() })
  } catch {
    return null
  }
}

export async function requireContributorPortalSession() {
  const session = await getOptionalContributorSession()
  if (!session) redirect("/contributor/login")
  return session
}

export async function requireContributorPasswordReady() {
  return requireContributorPortalSession()
}
