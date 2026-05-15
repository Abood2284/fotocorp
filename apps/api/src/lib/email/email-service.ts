import { createResendEmailProvider } from "./resend-provider"
import type { IntendedEmailEvent } from "./types"

const resend = createResendEmailProvider()

/** In-memory ring buffer for local inspection; not a durable queue. */
const recentEvents: IntendedEmailEvent[] = []
const MAX_EVENTS = 50

export function recordIntendedEmailEvent(event: IntendedEmailEvent): void {
  recentEvents.unshift(event)
  if (recentEvents.length > MAX_EVENTS) recentEvents.length = MAX_EVENTS
  console.info("email_intended_event", {
    templateId: event.templateId,
    to: event.to,
    subject: event.subject,
    createdAt: event.createdAt,
  })
  void resend.send(event)
}

export function peekRecentIntendedEmailEvents(): readonly IntendedEmailEvent[] {
  return recentEvents
}
