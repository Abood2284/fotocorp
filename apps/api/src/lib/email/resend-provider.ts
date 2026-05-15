import type { IntendedEmailEvent } from "./types"

/**
 * Placeholder Resend integration — does not send network traffic.
 * Wire `RESEND_API_KEY` and real delivery in a follow-up; callers use `emailService` instead.
 */
export function createResendEmailProvider() {
  return {
    async send(_event: IntendedEmailEvent): Promise<{ ok: false; skipped: "resend_not_configured" }> {
      return { ok: false, skipped: "resend_not_configured" }
    },
  }
}
