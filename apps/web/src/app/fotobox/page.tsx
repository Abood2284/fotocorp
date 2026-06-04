import { redirect } from "next/navigation"

import { FotoboxClientPage } from "@/components/fotobox/fotobox-client-page"
import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { listFotoboxBoards } from "@/lib/api/account-api"
import type { FotoboxBoard } from "@/lib/api/account-api"

export const metadata = {
  title: "Fotobox",
}

export default async function FotoboxPage() {
  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    redirect(buildSignInHref({ callbackUrl: "/account/fotobox" }))
  }

  const appUser = await getOrCreateAppUser(authUser)
  const isSubscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const result = await listFotoboxBoards(appUser.authUserId).catch(() => ({
    ok: true as const,
    boards: [] as FotoboxBoard[],
  }))
  const boards = result.boards ?? []

  return <FotoboxClientPage initialServerBoards={boards} isSubscriber={isSubscriber} />
}
