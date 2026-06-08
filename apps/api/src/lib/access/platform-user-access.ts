import { desc, eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { customerAccessInquiries } from "../../db/schema"
import { AppError } from "../errors"

export const SUBSCRIBER_ACCESS_APPROVED_INQUIRY_STATUS = "ACCESS_GRANTED" as const

export function isSubscriberAccessInquiryApproved(status: string | null | undefined): boolean {
  if (!status) return true
  return status === SUBSCRIBER_ACCESS_APPROVED_INQUIRY_STATUS
}

export async function findLatestUserAccessInquiryStatus(
  db: DrizzleClient,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ status: customerAccessInquiries.status })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.userId, userId))
    .orderBy(desc(customerAccessInquiries.createdAt))
    .limit(1)

  return rows[0]?.status ?? null
}

export async function assertPlatformUserMaySignIn(db: DrizzleClient, userId: string): Promise<void> {
  const status = await findLatestUserAccessInquiryStatus(db, userId)
  if (isSubscriberAccessInquiryApproved(status)) return

  throw new AppError(
    403,
    "ACCESS_PENDING_REVIEW",
    "Your access request is still under review. We will email you when your account is approved.",
  )
}
