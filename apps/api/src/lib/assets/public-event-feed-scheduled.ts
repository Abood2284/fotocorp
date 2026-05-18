import type { Env } from "../../appTypes"
import { createHttpDb } from "../../db/http"
import {
  deleteOldPublicEventFeedItems,
  reconcilePublicEventFeedProjectionDrift,
} from "./public-event-feed-projection"

export async function runPublicEventFeedCleanup(env: Env): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error(
      JSON.stringify({
        event: "public_event_feed_cleanup",
        status: "error",
        errorMessage: "DATABASE_URL_MISSING",
      }),
    )
    return
  }

  const startedAt = Date.now()
  const db = createHttpDb(env.DATABASE_URL)
  try {
    const result = await deleteOldPublicEventFeedItems(db)
    console.info(
      JSON.stringify({
        event: "public_event_feed_cleanup",
        windowDays: result.windowDays,
        deletedOldRows: result.deletedOldRows,
        durationMs: result.durationMs,
        status: result.status,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        event: "public_event_feed_cleanup",
        windowDays: 30,
        deletedOldRows: 0,
        durationMs: Date.now() - startedAt,
        status: "error",
        errorMessage: message,
      }),
    )
    return
  }

  const reconcileStartedAt = Date.now()
  try {
    const reconcile = await reconcilePublicEventFeedProjectionDrift(db)
    console.info(
      JSON.stringify({
        event: "public_event_feed_projection_reconcile",
        candidateEventCount: reconcile.candidateEventCount,
        upsertedPublicCount: reconcile.upsertedPublicCount,
        hiddenOrDeletedCount: reconcile.hiddenOrDeletedCount,
        errorCount: reconcile.errorCount,
        durationMs: reconcile.durationMs,
        status: reconcile.status,
        totalDurationMs: Date.now() - reconcileStartedAt,
      }),
    )
    if (reconcile.status === "error") {
      console.error(
        JSON.stringify({
          event: "public_event_feed_projection_reconcile",
          status: "error",
          errorMessage: reconcile.errorMessage ?? "UNKNOWN",
          durationMs: Date.now() - reconcileStartedAt,
        }),
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        event: "public_event_feed_projection_reconcile",
        status: "error",
        errorMessage: message,
        durationMs: Date.now() - reconcileStartedAt,
      }),
    )
  }
}
