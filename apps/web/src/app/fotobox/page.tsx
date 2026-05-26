import { FotoboxClientPage } from "@/components/fotobox/fotobox-client-page"
import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { listFotoboxBoards } from "@/lib/api/account-api"
import type { FotoboxBoard } from "@/lib/api/account-api"

export const metadata = {
  title: "Fotobox",
}

export default async function FotoboxPage() {
  const authUser = await getCurrentAuthUser()
  let boards: FotoboxBoard[] = []
  let isSubscriber = false

  if (authUser) {
    const appUser = await getOrCreateAppUser(authUser)
    isSubscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
    const result = await listFotoboxBoards(appUser.authUserId).catch(() => ({
      ok: true as const,
      boards: [] as FotoboxBoard[],
    }))
    boards = result.boards ?? []
  }

  return <FotoboxClientPage initialServerBoards={boards} isSubscriber={isSubscriber} />
}
