import { getCurrentAuthUser } from "@/lib/app-user"
import {
  getOptionalContributorClearPreviewIdentity,
  listPublishedCaricatureIdsForContributor,
  resolveSubscriberHasCaricatureClearAccess,
} from "@/lib/caricatures/caricature-clear-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

export const CARICATURE_ACCESS_SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function GET() {
  const staff = await getOptionalStaffSession()
  if (staff) {
    return Response.json(
      { hasClearAccess: true, ownedAssetIds: [], isContributor: false },
      { headers: CARICATURE_ACCESS_SAFE_HEADERS },
    )
  }

  const authUser = await getCurrentAuthUser()
  if (authUser) {
    const hasClearAccess = await resolveSubscriberHasCaricatureClearAccess(authUser.id)
    return Response.json(
      { hasClearAccess, ownedAssetIds: [], isContributor: false },
      { headers: CARICATURE_ACCESS_SAFE_HEADERS },
    )
  }

  const contributor = await getOptionalContributorClearPreviewIdentity()
  if (contributor) {
    let ownedAssetIds: string[] = []
    try {
      ownedAssetIds = await listPublishedCaricatureIdsForContributor(contributor.id)
    } catch {
      ownedAssetIds = []
    }
    return Response.json(
      { hasClearAccess: false, ownedAssetIds, isContributor: true },
      { headers: CARICATURE_ACCESS_SAFE_HEADERS },
    )
  }

  return Response.json(
    { hasClearAccess: false, ownedAssetIds: [], isContributor: false },
    { status: 401, headers: CARICATURE_ACCESS_SAFE_HEADERS },
  )
}
