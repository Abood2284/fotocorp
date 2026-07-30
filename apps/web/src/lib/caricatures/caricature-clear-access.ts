import "server-only"

import {
  listSubscriberEntitlements,
} from "@/lib/app-user-profile-store"
import { hasActiveCaricatureEntitlement } from "@/lib/caricatures/caricature-clear-access-shared"

export {
  buildCaricatureClearPreviewUrl,
  hasActiveCaricatureEntitlement,
} from "@/lib/caricatures/caricature-clear-access-shared"

export async function resolveSubscriberHasCaricatureClearAccess(authUserId: string): Promise<boolean> {
  const entitlements = await listSubscriberEntitlements(authUserId)
  return hasActiveCaricatureEntitlement(entitlements)
}
